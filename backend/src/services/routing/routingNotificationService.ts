/**
 * Routing Notification Service
 * Handles all Serbian-language notifications and messaging for ticket routing events
 */

import { logger } from '../../utils/logger';
import agentProfileService from './agentProfileService';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Notification types for routing events
export type RoutingNotificationType = 
  | 'ticket_assigned'
  | 'ticket_reassigned'
  | 'manual_override_requested'
  | 'manual_override_approved'
  | 'manual_override_rejected'
  | 'load_balance_performed'
  | 'emergency_escalation'
  | 'agent_overloaded'
  | 'routing_failed'
  | 'capacity_warning'
  | 'performance_alert';

// Notification delivery channels
export type NotificationChannel = 'email' | 'in_app' | 'websocket' | 'sms';

// Notification priority levels
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

// Main notification interface
export interface RoutingNotification {
  id: string;
  type: RoutingNotificationType;
  priority: NotificationPriority;
  
  // Recipients
  recipientId: string;
  recipientType: 'agent' | 'supervisor' | 'admin';
  
  // Message content (all in Serbian)
  title: string;
  message: string;
  details?: string;
  actionRequired?: boolean;
  actionUrl?: string;
  actionButtonText?: string;
  
  // Context data
  ticketId?: string;
  agentId?: string;
  supervisorId?: string;
  overrideId?: string;
  loadBalanceActionId?: string;
  
  // Metadata
  createdAt: string;
  scheduledFor?: string;
  deliveredAt?: string;
  readAt?: string;
  
  // Delivery configuration
  channels: NotificationChannel[];
  isDelivered: boolean;
  deliveryAttempts: number;
  maxDeliveryAttempts: number;
  
  // Localization
  language: 'sr' | 'sr-Latn' | 'sr-Cyrl';
  
  // Additional context for templates
  context?: Record<string, any>;
}

// Email template interface
export interface EmailTemplate {
  id: string;
  type: RoutingNotificationType;
  language: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[]; // List of variables that can be replaced
}

// In-app notification interface
export interface InAppNotification {
  id: string;
  type: RoutingNotificationType;
  title: string;
  message: string;
  icon: string;
  color: 'info' | 'success' | 'warning' | 'error';
  persistent: boolean;
  autoClose: number; // milliseconds, 0 for no auto-close
}

export class RoutingNotificationService {
  private dataDir: string;
  private notificationsPath: string;
  private templatesPath: string;
  private queuePath: string;

  constructor() {
    this.dataDir = path.join(__dirname, '../../../..', 'data/notifications');
    this.notificationsPath = path.join(this.dataDir, 'routing-notifications.json');
    this.templatesPath = path.join(this.dataDir, 'notification-templates.json');
    this.queuePath = path.join(this.dataDir, 'notification-queue.json');
    this.ensureDirectoriesExist();
    this.initializeTemplates();
  }

  /**
   * Ensure notification data directories exist
   */
  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating notification directories:', error);
    }
  }

  /**
   * Load data from JSON file with default fallback
   */
  private async loadData<T>(filePath: string, defaultValue: T[] = []): Promise<T[]> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Save data to JSON file
   */
  private async saveData<T>(filePath: string, data: T[]): Promise<void> {
    const jsonData = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonData, 'utf-8');
  }

  /**
   * Initialize default Serbian notification templates
   */
  private async initializeTemplates(): Promise<void> {
    try {
      const templates = await this.loadData<EmailTemplate>(this.templatesPath);
      
      if (templates.length > 0) {
        return; // Templates already initialized
      }

      const defaultTemplates: EmailTemplate[] = [
        {
          id: 'ticket_assigned_sr',
          type: 'ticket_assigned',
          language: 'sr',
          subject: 'Нови тикет вам је додељен - #{ticketId}',
          htmlBody: `
            <h2>Здраво {agentName},</h2>
            <p>Додељен вам је нови тикет за решавање:</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Детаљи тикета:</h3>
              <p><strong>ID тикета:</strong> {ticketId}</p>
              <p><strong>Наслов:</strong> {ticketTitle}</p>
              <p><strong>Приоритет:</strong> {ticketPriority}</p>
              <p><strong>Категорија:</strong> {ticketCategory}</p>
              <p><strong>Корисник:</strong> {requesterName}</p>
            </div>
            
            <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Разлог доделе:</h3>
              <p>{routingReason}</p>
              <p><em>Поверење у AI категоризацију: {aiConfidence}%</em></p>
            </div>
            
            <p><a href="{ticketUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Преглед тикета</a></p>
            
            <p>Хвала,<br>PIO Help Desk систем</p>
          `,
          textBody: `
Здраво {agentName},

Додељен вам је нови тикет за решавање:

Детаљи тикета:
- ID тикета: {ticketId}
- Наслов: {ticketTitle}  
- Приоритет: {ticketPriority}
- Категорија: {ticketCategory}
- Корисник: {requesterName}

Разлог доделе: {routingReason}
Поверење у AI категоризацију: {aiConfidence}%

Линк до тикета: {ticketUrl}

Хвала,
PIO Help Desk систем
          `,
          variables: ['agentName', 'ticketId', 'ticketTitle', 'ticketPriority', 'ticketCategory', 'requesterName', 'routingReason', 'aiConfidence', 'ticketUrl']
        },
        {
          id: 'ticket_reassigned_sr',
          type: 'ticket_reassigned',
          language: 'sr',
          subject: 'Тикет #{ticketId} вам је поново додељен',
          htmlBody: `
            <h2>Здраво {agentName},</h2>
            <p>Тикет који је претходно био додељен другом агенту сада је пребачен на вас:</p>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Детаљи тикета:</h3>
              <p><strong>ID тикета:</strong> {ticketId}</p>
              <p><strong>Наслов:</strong> {ticketTitle}</p>
              <p><strong>Претходни агент:</strong> {previousAgentName}</p>
              <p><strong>Разлог преусмеравања:</strong> {reassignmentReason}</p>
            </div>
            
            <div style="background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Разлог доделе вама:</h3>
              <p>{routingReason}</p>
            </div>
            
            <p><a href="{ticketUrl}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Преглед тикета</a></p>
            
            <p>Хвала,<br>PIO Help Desk систем</p>
          `,
          textBody: `
Здраво {agentName},

Тикет који је претходно био додељен другом агенту сада је пребачен на вас:

Детаљи тикета:
- ID тикета: {ticketId}
- Наслов: {ticketTitle}
- Претходни агент: {previousAgentName}
- Разлог преусмеравања: {reassignmentReason}

Разлог доделе вама: {routingReason}

Линк до тикета: {ticketUrl}

Хвала,
PIO Help Desk систем
          `,
          variables: ['agentName', 'ticketId', 'ticketTitle', 'previousAgentName', 'reassignmentReason', 'routingReason', 'ticketUrl']
        },
        {
          id: 'manual_override_requested_sr',
          type: 'manual_override_requested',
          language: 'sr',
          subject: 'Захтев за мануелно преусмеравање тикета #{ticketId}',
          htmlBody: `
            <h2>Захтев за одобрење преусмеравања</h2>
            <p>Супервизор {supervisorName} је захтевао мануелно преусмеравање тикета:</p>
            
            <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Детаљи захтева:</h3>
              <p><strong>ID тикета:</strong> {ticketId}</p>
              <p><strong>Тренутни агент:</strong> {currentAgentName}</p>
              <p><strong>Нови агент:</strong> {newAgentName}</p>
              <p><strong>Тип преусмеравања:</strong> {overrideType}</p>
              <p><strong>Приоритет:</strong> {priority}</p>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Образложење:</h3>
              <p>{reason}</p>
            </div>
            
            <p>
              <a href="{approveUrl}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Одобри</a>
              <a href="{rejectUrl}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Одбаци</a>
            </p>
            
            <p>Хвала,<br>PIO Help Desk систем</p>
          `,
          textBody: `
Захтев за одобрење преусмеравања

Супервизор {supervisorName} је захтевао мануелно преусмеравање тикета:

Детаљи захтева:
- ID тикета: {ticketId}
- Тренутни агент: {currentAgentName}
- Нови агент: {newAgentName}
- Тип преусмеравања: {overrideType}
- Приоритет: {priority}

Образложење: {reason}

За одобравање: {approveUrl}
За одбацивање: {rejectUrl}

Хвала,
PIO Help Desk систем
          `,
          variables: ['supervisorName', 'ticketId', 'currentAgentName', 'newAgentName', 'overrideType', 'priority', 'reason', 'approveUrl', 'rejectUrl']
        },
        {
          id: 'load_balance_performed_sr',
          type: 'load_balance_performed',
          language: 'sr',
          subject: 'Извршено распоређивање оптерећења тикета',
          htmlBody: `
            <h2>Распоређивање оптерећења завршено</h2>
            <p>Аутоматско распоређивање оптерећења је успешно извршено:</p>
            
            <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Резултати:</h3>
              <p><strong>Укупно премештених тикета:</strong> {totalMoved}</p>
              <p><strong>Успешно:</strong> {successfulMoves}</p>
              <p><strong>Неуспешно:</strong> {failedMoves}</p>
              <p><strong>Побољшање:</strong> {improvementPercent}%</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Детаљи операције:</h3>
              <p><strong>Покренуо:</strong> {triggeredBy}</p>
              <p><strong>Разлог:</strong> {reason}</p>
              <p><strong>Време извршавања:</strong> {processingTime}ms</p>
            </div>
            
            <p><a href="{detailsUrl}" style="background: #17a2b8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Преглед детаља</a></p>
            
            <p>Хвала,<br>PIO Help Desk систем</p>
          `,
          textBody: `
Распоређивање оптерећења завршено

Аутоматско распоређивање оптерећења је успешно извршено:

Резултати:
- Укупно премештених тикета: {totalMoved}
- Успешно: {successfulMoves}
- Неуспешно: {failedMoves}  
- Побољшање: {improvementPercent}%

Детаљи операције:
- Покренуо: {triggeredBy}
- Разлог: {reason}
- Време извршавања: {processingTime}ms

Детаљи: {detailsUrl}

Хвала,
PIO Help Desk систем
          `,
          variables: ['totalMoved', 'successfulMoves', 'failedMoves', 'improvementPercent', 'triggeredBy', 'reason', 'processingTime', 'detailsUrl']
        },
        {
          id: 'agent_overloaded_sr',
          type: 'agent_overloaded',
          language: 'sr',
          subject: 'УПОЗОРЕЊЕ: Агент {agentName} је преоптерећен',
          htmlBody: `
            <h2 style="color: #dc3545;">Упозорење о преоптерећености агента</h2>
            <p>Агент {agentName} је достигао критичан ниво оптерећености:</p>
            
            <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 5px solid #dc3545;">
              <h3>Статистике оптерећености:</h3>
              <p><strong>Тренутна искоришћеност:</strong> {utilizationPercent}%</p>
              <p><strong>Активних тикета:</strong> {activeTickets}</p>
              <p><strong>Хитних тикета:</strong> {urgentTickets}</p>
              <p><strong>Ниво стреса:</strong> {stressLevel}</p>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Препоручене акције:</h3>
              <ul>
                <li>Размотрити преусмеравање нехитних тикета</li>
                <li>Привремено зауставити додељивање нових тикета</li>
                <li>Проверити доступност других агената</li>
                <li>Активирати резервне ресурсе</li>
              </ul>
            </div>
            
            <p>
              <a href="{rebalanceUrl}" style="background: #ffc107; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Покрени распоређивање</a>
              <a href="{agentUrl}" style="background: #17a2b8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Преглед агента</a>
            </p>
            
            <p>Хвала,<br>PIO Help Desk систем</p>
          `,
          textBody: `
УПОЗОРЕЊЕ: Агент преоптерећен

Агент {agentName} је достигао критичан ниво оптерећености:

Статистике оптерећености:
- Тренутна искоришћеност: {utilizationPercent}%
- Активних тикета: {activeTickets}
- Хитних тикета: {urgentTickets}
- Ниво стреса: {stressLevel}

Препоручене акције:
- Размотрити преусмеравање нехитних тикета
- Привремено зауставити додељивање нових тикета
- Проверити доступност других агената
- Активирати резервне ресурсе

Распоређивање: {rebalanceUrl}
Преглед агента: {agentUrl}

Хвала,
PIO Help Desk систем
          `,
          variables: ['agentName', 'utilizationPercent', 'activeTickets', 'urgentTickets', 'stressLevel', 'rebalanceUrl', 'agentUrl']
        }
      ];

      await this.saveData(this.templatesPath, defaultTemplates);
      logger.info('Serbian routing notification templates initialized');
    } catch (error) {
      logger.error('Error initializing notification templates:', error);
    }
  }

  /**
   * Send notification about ticket assignment
   */
  async notifyTicketAssigned(params: {
    ticketId: string;
    agentId: string;
    ticketTitle: string;
    ticketPriority: string;
    ticketCategory: string;
    requesterName: string;
    routingReason: string;
    aiConfidence: number;
    channels?: NotificationChannel[];
  }): Promise<{ success: boolean; notificationId: string; message: string }> {
    try {
      const agent = await agentProfileService.getAgentProfile(params.agentId);
      if (!agent) {
        return {
          success: false,
          notificationId: '',
          message: 'Агент није пронађен'
        };
      }

      const notificationId = uuidv4();
      const notification: RoutingNotification = {
        id: notificationId,
        type: 'ticket_assigned',
        priority: params.ticketPriority === 'urgent' ? 'urgent' : 'medium',
        recipientId: params.agentId,
        recipientType: 'agent',
        title: `Нови тикет #${params.ticketId}`,
        message: `Додељен вам је нови тикет: ${params.ticketTitle}`,
        details: `Категорија: ${params.ticketCategory}\nПриоритет: ${params.ticketPriority}\nРазлог доделе: ${params.routingReason}`,
        actionRequired: true,
        actionUrl: `/tickets/${params.ticketId}`,
        actionButtonText: 'Преглед тикета',
        ticketId: params.ticketId,
        agentId: params.agentId,
        createdAt: new Date().toISOString(),
        channels: params.channels || ['email', 'in_app'],
        isDelivered: false,
        deliveryAttempts: 0,
        maxDeliveryAttempts: 3,
        language: 'sr',
        context: {
          agentName: agent.displayName,
          ticketId: params.ticketId,
          ticketTitle: params.ticketTitle,
          ticketPriority: this.translatePriority(params.ticketPriority),
          ticketCategory: params.ticketCategory,
          requesterName: params.requesterName,
          routingReason: params.routingReason,
          aiConfidence: Math.round(params.aiConfidence * 100),
          ticketUrl: `/tickets/${params.ticketId}`
        }
      };

      // Save notification
      const notifications = await this.loadData<RoutingNotification>(this.notificationsPath);
      notifications.push(notification);
      await this.saveData(this.notificationsPath, notifications);

      // Queue for delivery
      await this.queueNotification(notification);

      logger.info(`Ticket assignment notification created: ${notificationId} for agent ${params.agentId}`);

      return {
        success: true,
        notificationId,
        message: 'Нотификација о додели тикета је успешно креирана'
      };

    } catch (error) {
      logger.error('Error creating ticket assignment notification:', error);
      return {
        success: false,
        notificationId: '',
        message: 'Грешка при креирању нотификације'
      };
    }
  }

  /**
   * Send notification about manual override request
   */
  async notifyManualOverrideRequested(params: {
    overrideId: string;
    ticketId: string;
    supervisorId: string;
    currentAgentId?: string;
    newAgentId: string;
    overrideType: string;
    priority: string;
    reason: string;
    recipients: string[]; // Supervisor/admin IDs who can approve
  }): Promise<{ success: boolean; notificationIds: string[]; message: string }> {
    try {
      const notificationIds: string[] = [];

      for (const recipientId of params.recipients) {
        const notificationId = uuidv4();
        const notification: RoutingNotification = {
          id: notificationId,
          type: 'manual_override_requested',
          priority: 'high',
          recipientId,
          recipientType: 'supervisor',
          title: `Захтев за преусмеравање тикета #${params.ticketId}`,
          message: `Супервизор захтева мануелно преусмеравање тикета`,
          details: `Тип: ${this.translateOverrideType(params.overrideType)}\nРазлог: ${params.reason}`,
          actionRequired: true,
          actionUrl: `/overrides/${params.overrideId}`,
          actionButtonText: 'Преглед захтева',
          ticketId: params.ticketId,
          overrideId: params.overrideId,
          supervisorId: params.supervisorId,
          createdAt: new Date().toISOString(),
          channels: ['email', 'in_app'],
          isDelivered: false,
          deliveryAttempts: 0,
          maxDeliveryAttempts: 3,
          language: 'sr',
          context: {
            ticketId: params.ticketId,
            overrideType: this.translateOverrideType(params.overrideType),
            priority: this.translatePriority(params.priority),
            reason: params.reason,
            approveUrl: `/overrides/${params.overrideId}/approve`,
            rejectUrl: `/overrides/${params.overrideId}/reject`
          }
        };

        // Save notification
        const notifications = await this.loadData<RoutingNotification>(this.notificationsPath);
        notifications.push(notification);
        await this.saveData(this.notificationsPath, notifications);

        // Queue for delivery
        await this.queueNotification(notification);

        notificationIds.push(notificationId);
      }

      logger.info(`Manual override request notifications created: ${notificationIds.length} recipients`);

      return {
        success: true,
        notificationIds,
        message: 'Нотификације о захтеву за преусмеравање су успешно креиране'
      };

    } catch (error) {
      logger.error('Error creating manual override notifications:', error);
      return {
        success: false,
        notificationIds: [],
        message: 'Грешка при креирању нотификација'
      };
    }
  }

  /**
   * Send notification about agent overload
   */
  async notifyAgentOverloaded(params: {
    agentId: string;
    utilizationPercent: number;
    activeTickets: number;
    urgentTickets: number;
    stressLevel: string;
    recipients: string[]; // Supervisor IDs
  }): Promise<{ success: boolean; notificationIds: string[]; message: string }> {
    try {
      const agent = await agentProfileService.getAgentProfile(params.agentId);
      if (!agent) {
        return {
          success: false,
          notificationIds: [],
          message: 'Агент није пронађен'
        };
      }

      const notificationIds: string[] = [];

      for (const recipientId of params.recipients) {
        const notificationId = uuidv4();
        const notification: RoutingNotification = {
          id: notificationId,
          type: 'agent_overloaded',
          priority: 'urgent',
          recipientId,
          recipientType: 'supervisor',
          title: `УПОЗОРЕЊЕ: ${agent.displayName} преоптерećen`,
          message: `Агент ${agent.displayName} је достигао критичан ниво оптерећености (${params.utilizationPercent}%)`,
          details: `Стрес ниво: ${this.translateStressLevel(params.stressLevel)}\nАктивних тикета: ${params.activeTickets}\nХитних тикета: ${params.urgentTickets}`,
          actionRequired: true,
          actionUrl: `/agents/${params.agentId}/workload`,
          actionButtonText: 'Преглед агента',
          agentId: params.agentId,
          createdAt: new Date().toISOString(),
          channels: ['email', 'in_app', 'websocket'],
          isDelivered: false,
          deliveryAttempts: 0,
          maxDeliveryAttempts: 3,
          language: 'sr',
          context: {
            agentName: agent.displayName,
            utilizationPercent: params.utilizationPercent,
            activeTickets: params.activeTickets,
            urgentTickets: params.urgentTickets,
            stressLevel: this.translateStressLevel(params.stressLevel),
            rebalanceUrl: `/overrides/load-balance?agent=${params.agentId}`,
            agentUrl: `/agents/${params.agentId}`
          }
        };

        // Save notification
        const notifications = await this.loadData<RoutingNotification>(this.notificationsPath);
        notifications.push(notification);
        await this.saveData(this.notificationsPath, notifications);

        // Queue for delivery
        await this.queueNotification(notification);

        notificationIds.push(notificationId);
      }

      logger.warn(`Agent overload notifications sent for ${agent.displayName}: ${notificationIds.length} recipients`);

      return {
        success: true,
        notificationIds,
        message: 'Упозорења о преоптерећености агента су послата'
      };

    } catch (error) {
      logger.error('Error creating agent overload notifications:', error);
      return {
        success: false,
        notificationIds: [],
        message: 'Грешка при креирању упозорења'
      };
    }
  }

  /**
   * Queue notification for delivery
   */
  private async queueNotification(notification: RoutingNotification): Promise<void> {
    try {
      const queue = await this.loadData<RoutingNotification>(this.queuePath);
      queue.push(notification);
      await this.saveData(this.queuePath, queue);
    } catch (error) {
      logger.error('Error queuing notification:', error);
    }
  }

  /**
   * Translate priority to Serbian
   */
  private translatePriority(priority: string): string {
    const translations: Record<string, string> = {
      'low': 'Низак',
      'medium': 'Средњи',
      'high': 'Висок',
      'urgent': 'Хитан',
      'critical': 'Критичан'
    };
    return translations[priority] || priority;
  }

  /**
   * Translate override type to Serbian
   */
  private translateOverrideType(type: string): string {
    const translations: Record<string, string> = {
      'manual_reassign': 'Мануелно преусмеравање',
      'emergency_escalation': 'Хитна ескалација',
      'supervisor_decision': 'Супервизорска одлука',
      'load_balancing': 'Распоређивање оптерећења'
    };
    return translations[type] || type;
  }

  /**
   * Translate stress level to Serbian
   */
  private translateStressLevel(level: string): string {
    const translations: Record<string, string> = {
      'low': 'Низак',
      'medium': 'Средњи',
      'high': 'Висок',
      'critical': 'Критичан'
    };
    return translations[level] || level;
  }

  /**
   * Get notifications for a specific recipient
   */
  async getNotifications(
    recipientId: string,
    filters?: {
      type?: RoutingNotificationType;
      unreadOnly?: boolean;
      limit?: number;
    }
  ): Promise<{
    success: boolean;
    notifications?: RoutingNotification[];
    message: string;
  }> {
    try {
      let notifications = await this.loadData<RoutingNotification>(this.notificationsPath);
      
      // Filter by recipient
      notifications = notifications.filter(n => n.recipientId === recipientId);
      
      // Apply additional filters
      if (filters) {
        if (filters.type) {
          notifications = notifications.filter(n => n.type === filters.type);
        }
        if (filters.unreadOnly) {
          notifications = notifications.filter(n => !n.readAt);
        }
      }
      
      // Sort by creation date (newest first)
      notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Apply limit
      if (filters?.limit) {
        notifications = notifications.slice(0, filters.limit);
      }

      return {
        success: true,
        notifications,
        message: `Пронађено ${notifications.length} нотификација`
      };

    } catch (error) {
      logger.error('Error getting notifications:', error);
      return {
        success: false,
        message: 'Грешка при учитавању нотификација'
      };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const notifications = await this.loadData<RoutingNotification>(this.notificationsPath);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (!notification) {
        return {
          success: false,
          message: 'Нотификација није пронађена'
        };
      }
      
      notification.readAt = new Date().toISOString();
      await this.saveData(this.notificationsPath, notifications);
      
      return {
        success: true,
        message: 'Нотификација означена као прочитана'
      };

    } catch (error) {
      logger.error('Error marking notification as read:', error);
      return {
        success: false,
        message: 'Грешка при означавању нотификације'
      };
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(recipientId?: string): Promise<{
    success: boolean;
    stats?: {
      total: number;
      unread: number;
      byType: Record<RoutingNotificationType, number>;
      byPriority: Record<NotificationPriority, number>;
    };
    message: string;
  }> {
    try {
      let notifications = await this.loadData<RoutingNotification>(this.notificationsPath);
      
      if (recipientId) {
        notifications = notifications.filter(n => n.recipientId === recipientId);
      }
      
      const stats = {
        total: notifications.length,
        unread: notifications.filter(n => !n.readAt).length,
        byType: {} as Record<RoutingNotificationType, number>,
        byPriority: {} as Record<NotificationPriority, number>
      };
      
      // Count by type
      notifications.forEach(n => {
        stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
        stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
      });
      
      return {
        success: true,
        stats,
        message: 'Статистике нотификација учитане'
      };

    } catch (error) {
      logger.error('Error getting notification stats:', error);
      return {
        success: false,
        message: 'Грешка при учитавању статистика'
      };
    }
  }
}

export default new RoutingNotificationService(); 