import { PrismaClient } from '@prisma/client';
import { addMinutes, isBefore, isAfter } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { logger } from '../utils/logger.js';
import SlaService from './SlaService.js';
import WebSocketService from './WebSocketService.js';

const prisma = new PrismaClient();
const BELGRADE_TIMEZONE = 'Europe/Belgrade';

export interface SlaAlert {
  ticketId: string;
  ticketNumber: string;
  alertType: 'response_warning' | 'response_breach' | 'resolution_warning' | 'resolution_breach';
  message: string;
  escalationLevel?: number;
  escalateTo?: string;
  priority: string;
  category: string;
  dueDate: Date;
  timeRemaining: number; // minutes
}

export interface EscalationRule {
  level: number;
  hoursAfterDue: number;
  escalateTo: string;
}

export class SlaMonitoringService {
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 60000; // Проверава сваки минут

  /**
   * Покреће SLA мониторинг у позадини
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('SLA мониторинг је већ покренут');
      return;
    }

    this.isRunning = true;
    logger.info('🚨 Покретање SLA мониторинга...');

    // Почетна провера
    this.checkSlaViolations();

    // Периодична провера
    this.monitoringInterval = setInterval(() => {
      this.checkSlaViolations();
    }, this.checkIntervalMs);

    logger.info(`✅ SLA мониторинг покренут (провера сваки ${this.checkIntervalMs / 1000} секунди)`);
  }

  /**
   * Зауставља SLA мониторинг
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isRunning = false;
    logger.info('🛑 SLA мониторинг заустављен');
  }

  /**
   * Проверава SLA нарушавања за све активне тикете
   */
  private async checkSlaViolations(): Promise<void> {
    try {
      const activeTickets = await prisma.ticket.findMany({
        where: {
          status: {
            notIn: ['closed', 'cancelled', 'resolved']
          },
          OR: [
            { slaResponseDue: { not: null } },
            { slaResolutionDue: { not: null } }
          ]
        },
        include: {
          category: true,
          requester: {
            select: {
              id: true,
              displayName: true,
              email: true
            }
          },
          assignee: {
            select: {
              id: true,
              displayName: true,
              email: true
            }
          }
        }
      });

      const now = toZonedTime(new Date(), BELGRADE_TIMEZONE);
      const alerts: SlaAlert[] = [];

      for (const ticket of activeTickets) {
        const ticketAlerts = await this.checkTicketSla(ticket, now);
        alerts.push(...ticketAlerts);
      }

      if (alerts.length > 0) {
        logger.info(`🚨 Пронађено ${alerts.length} SLA алерата`);
        await this.processAlerts(alerts);
      }

    } catch (error) {
      logger.error('Грешка при провери SLA нарушавања:', error);
    }
  }

  /**
   * Проверава SLA за појединачни тикет
   */
  private async checkTicketSla(ticket: any, now: Date): Promise<SlaAlert[]> {
    const alerts: SlaAlert[] = [];

    // Провера одзива (response time)
    if (ticket.slaResponseDue && !ticket.firstResponseAt) {
      const responseDue = toZonedTime(ticket.slaResponseDue, BELGRADE_TIMEZONE);
      const responseAlert = this.checkSlaDeadline(
        ticket,
        now,
        responseDue,
        'response',
        'одзив'
      );
      if (responseAlert) alerts.push(responseAlert);
    }

    // Провера решавања (resolution time)
    if (ticket.slaResolutionDue && ticket.status !== 'resolved') {
      const resolutionDue = toZonedTime(ticket.slaResolutionDue, BELGRADE_TIMEZONE);
      const resolutionAlert = this.checkSlaDeadline(
        ticket,
        now,
        resolutionDue,
        'resolution',
        'решавање'
      );
      if (resolutionAlert) alerts.push(resolutionAlert);
    }

    return alerts;
  }

  /**
   * Проверава рок и генерише алерт ако је потребно
   */
  private checkSlaDeadline(
    ticket: any,
    now: Date,
    dueDate: Date,
    type: 'response' | 'resolution',
    typeName: string
  ): SlaAlert | null {
    const timeRemainingMs = dueDate.getTime() - now.getTime();
    const timeRemainingMinutes = Math.floor(timeRemainingMs / (1000 * 60));

    // Прекршај - рок је прошао
    if (timeRemainingMinutes < 0) {
      return {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        alertType: `${type}_breach` as any,
        message: `⚠️ SLA прекршај за ${typeName}! Тикет ${ticket.ticketNumber} је прекорачио рок за ${Math.abs(timeRemainingMinutes)} минута.`,
        priority: ticket.priority,
        category: ticket.category?.name || 'Непознато',
        dueDate,
        timeRemaining: timeRemainingMinutes
      };
    }

    // Упозорење - остало мање од 30 минута
    if (timeRemainingMinutes > 0 && timeRemainingMinutes <= 30) {
      return {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        alertType: `${type}_warning` as any,
        message: `⚠️ SLA упозорење за ${typeName}! Тикет ${ticket.ticketNumber} има још ${timeRemainingMinutes} минута до рока.`,
        priority: ticket.priority,
        category: ticket.category?.name || 'Непознато',
        dueDate,
        timeRemaining: timeRemainingMinutes
      };
    }

    return null;
  }

  /**
   * Обрађује алерте и шаље нотификације
   */
  private async processAlerts(alerts: SlaAlert[]): Promise<void> {
    for (const alert of alerts) {
      try {
        // Ажурирај SLA статус у бази
        await this.updateTicketSlaStatus(alert);

        // Добиј детаље тикета за WebSocket нотификацију
        const ticketDetails = await prisma.ticket.findUnique({
          where: { id: alert.ticketId },
          include: {
            category: true,
            requester: {
              select: {
                id: true,
                displayName: true,
                email: true
              }
            },
            assignee: {
              select: {
                id: true,
                displayName: true,
                email: true
              }
            }
          }
        });

        // Креирај SLA догађај
        await this.createSlaEvent(alert);

        // Пошаљи real-time нотификацију
        WebSocketService.sendSlaAlert(alert, ticketDetails);

        // Обради ескалацију ако је потребно
        if (alert.alertType.includes('breach')) {
          await this.handleEscalation(alert);
        }

        // Лог алерт
        logger.warn(`🚨 SLA Алерт: ${alert.message}`);

        // Овде би се додало слање email-а, SMS-а, push нотификација итд.
        // await this.sendAlert(alert);

      } catch (error) {
        logger.error(`Грешка при обради алерта за тикет ${alert.ticketNumber}:`, error);
      }
    }
  }

  /**
   * Ажурира SLA статус тикета у бази
   */
  private async updateTicketSlaStatus(alert: SlaAlert): Promise<void> {
    const newStatus = alert.alertType.includes('breach') ? 'breached' : 'warning';

    await prisma.ticket.update({
      where: { id: alert.ticketId },
      data: { slaStatus: newStatus }
    });
  }

  /**
   * Креира SLA догађај у бази
   */
  private async createSlaEvent(alert: SlaAlert): Promise<void> {
    // Пронађи одговарајућу SLA политику
    const ticket = await prisma.ticket.findUnique({
      where: { id: alert.ticketId },
      include: { category: true }
    });

    if (!ticket) return;

    const slaPolicy = await this.findSlaPolicy(ticket.categoryId, ticket.priority);

    await prisma.slaEvent.create({
      data: {
        ticketId: alert.ticketId,
        slaPolicyId: slaPolicy?.id || null,
        eventType: alert.alertType,
        status: 'triggered',
        dueDate: alert.dueDate,
        triggeredAt: new Date(),
        message: alert.message,
        metadata: JSON.stringify({
          timeRemaining: alert.timeRemaining,
          priority: alert.priority,
          category: alert.category,
          timezone: BELGRADE_TIMEZONE
        })
      }
    });
  }

  /**
   * Обрађује ескалацију за прекршај SLA
   */
  private async handleEscalation(alert: SlaAlert): Promise<void> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: alert.ticketId },
      include: { category: true }
    });

    if (!ticket) return;

    const slaPolicy = await this.findSlaPolicy(ticket.categoryId, ticket.priority);
    if (!slaPolicy) return;

    try {
      const escalationLevels: EscalationRule[] = JSON.parse(slaPolicy.escalationLevels);
      
      // Пронађи тренутни ниво ескалације
      const hoursOverdue = Math.abs(alert.timeRemaining) / 60;
      
      for (const rule of escalationLevels.sort((a, b) => a.level - b.level)) {
        if (hoursOverdue >= rule.hoursAfterDue) {
          await this.escalateTicket(alert, rule);
          break;
        }
      }
    } catch (error) {
      logger.error(`Грешка при парсирању ескалационих правила за тикет ${alert.ticketNumber}:`, error);
    }
  }

  /**
   * Ескалира тикет према правилу
   */
  private async escalateTicket(alert: SlaAlert, rule: EscalationRule): Promise<void> {
    // Пронађи корисника за ескалацију (ово би требало бити правила за мапирање улога)
    let escalatedTo: string | null = null;

    if (rule.escalateTo === 'admin') {
      const admin = await prisma.user.findFirst({
        where: { role: { name: 'admin' } }
      });
      escalatedTo = admin?.id || null;
    }

    const escalationMessage = `🔺 Ескалација нивоа ${rule.level}: Тикет ${alert.ticketNumber} ескалиран на ${rule.escalateTo}`;

    // Креирај ескалациони догађај
    await prisma.slaEvent.create({
      data: {
        ticketId: alert.ticketId,
        eventType: 'escalation',
        status: 'triggered',
        dueDate: alert.dueDate,
        triggeredAt: new Date(),
        escalatedTo,
        message: escalationMessage,
        metadata: JSON.stringify({
          escalationLevel: rule.level,
          escalateTo: rule.escalateTo,
          hoursAfterDue: rule.hoursAfterDue,
          originalAlert: alert.alertType
        })
      }
    });

    // Пошаљи real-time ескалациону нотификацију
    if (escalatedTo) {
      WebSocketService.sendEscalationAlert(
        alert.ticketNumber,
        rule.level,
        escalatedTo,
        escalationMessage
      );
    }

    logger.warn(`🔺 Ескалација: Тикет ${alert.ticketNumber} ескалиран на ниво ${rule.level} (${rule.escalateTo})`);
  }

  /**
   * Пронађи SLA политику за категорију и приоритет
   */
  private async findSlaPolicy(categoryId: string | null, priority: string) {
    // Исто као у SlaService
    let policy = await prisma.slaPolicy.findFirst({
      where: {
        categoryId: categoryId,
        priority: priority,
        isActive: true
      }
    });

    if (!policy) {
      policy = await prisma.slaPolicy.findFirst({
        where: {
          priority: priority,
          categoryId: null,
          isActive: true
        }
      });
    }

    if (!policy && categoryId) {
      policy = await prisma.slaPolicy.findFirst({
        where: {
          categoryId: categoryId,
          priority: null,
          isActive: true
        }
      });
    }

    if (!policy) {
      policy = await prisma.slaPolicy.findFirst({
        where: {
          name: 'Подразумевана SLA политика',
          isActive: true
        }
      });
    }

    return policy;
  }

  /**
   * Добија тренутни статус мониторинга
   */
  getStatus(): { isRunning: boolean; checkInterval: number } {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkIntervalMs
    };
  }

  /**
   * Форсира проверу SLA (за тестирање)
   */
  async forceCheck(): Promise<void> {
    logger.info('🔍 Форсирана провера SLA статуса...');
    await this.checkSlaViolations();
  }
}

export default new SlaMonitoringService(); 