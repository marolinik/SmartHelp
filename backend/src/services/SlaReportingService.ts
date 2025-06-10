import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, subDays, subWeeks, subMonths } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { sr } from 'date-fns/locale';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
const BELGRADE_TIMEZONE = 'Europe/Belgrade';

export interface SlaMetrics {
  totalTickets: number;
  onTrackTickets: number;
  warningTickets: number;
  breachedTickets: number;
  complianceRate: number;
  averageResponseTime: number;
  averageResolutionTime: number;
}

export interface SlaBreachAnalysis {
  responseBreaches: number;
  resolutionBreaches: number;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  breachTrend: Array<{
    date: string;
    breaches: number;
  }>;
}

export interface SlaPerformanceTrend {
  period: string;
  complianceRate: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  totalTickets: number;
  breaches: number;
}

export interface SlaReport {
  period: {
    from: Date;
    to: Date;
    label: string;
  };
  metrics: SlaMetrics;
  breachAnalysis: SlaBreachAnalysis;
  performanceTrend: SlaPerformanceTrend[];
  topViolatingCategories: Array<{
    categoryName: string;
    violations: number;
    complianceRate: number;
  }>;
  escalationSummary: {
    totalEscalations: number;
    byLevel: Record<number, number>;
  };
}

export class SlaReportingService {
  
  /**
   * Генерише комплетан SLA извештај за дати период
   */
  async generateSlaReport(
    startDate: Date, 
    endDate: Date, 
    reportType: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<SlaReport> {
    try {
      const belgradeDateStart = toZonedTime(startOfDay(startDate), BELGRADE_TIMEZONE);
      const belgradeDateEnd = toZonedTime(endOfDay(endDate), BELGRADE_TIMEZONE);

      const [metrics, breachAnalysis, performanceTrend, topCategories, escalationSummary] = await Promise.all([
        this.calculateSlaMetrics(belgradeDateStart, belgradeDateEnd),
        this.analyzeSlaBreaches(belgradeDateStart, belgradeDateEnd),
        this.generatePerformanceTrend(belgradeDateStart, belgradeDateEnd, reportType),
        this.getTopViolatingCategories(belgradeDateStart, belgradeDateEnd),
        this.getEscalationSummary(belgradeDateStart, belgradeDateEnd)
      ]);

      const periodLabel = this.formatPeriodLabel(startDate, endDate, reportType);

      return {
        period: {
          from: belgradeDateStart,
          to: belgradeDateEnd,
          label: periodLabel
        },
        metrics,
        breachAnalysis,
        performanceTrend,
        topViolatingCategories: topCategories,
        escalationSummary
      };
    } catch (error) {
      logger.error('Грешка при генерисању SLA извештаја:', error);
      throw new Error('Грешка при генерисању SLA извештаја');
    }
  }

  /**
   * Рачуна основне SLA метрике
   */
  async calculateSlaMetrics(startDate: Date, endDate: Date): Promise<SlaMetrics> {
    const tickets = await prisma.ticket.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        category: true
      }
    });

    const totalTickets = tickets.length;
    const onTrackTickets = tickets.filter(t => t.slaStatus === 'on_track').length;
    const warningTickets = tickets.filter(t => t.slaStatus === 'warning').length;
    const breachedTickets = tickets.filter(t => t.slaStatus === 'breached').length;
    
    const complianceRate = totalTickets > 0 ? ((onTrackTickets + warningTickets) / totalTickets) * 100 : 100;

    // Рачунај просечна времена одзива и решавања
    const responseTimesMs = tickets
      .filter(t => t.firstResponseAt && t.createdAt)
      .map(t => new Date(t.firstResponseAt!).getTime() - new Date(t.createdAt).getTime());
    
    const resolutionTimesMs = tickets
      .filter(t => t.resolvedAt && t.createdAt)
      .map(t => new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime());

    const averageResponseTime = responseTimesMs.length > 0 
      ? responseTimesMs.reduce((sum, time) => sum + time, 0) / responseTimesMs.length / (1000 * 60 * 60) 
      : 0;

    const averageResolutionTime = resolutionTimesMs.length > 0 
      ? resolutionTimesMs.reduce((sum, time) => sum + time, 0) / resolutionTimesMs.length / (1000 * 60 * 60)
      : 0;

    return {
      totalTickets,
      onTrackTickets,
      warningTickets,
      breachedTickets,
      complianceRate: Math.round(complianceRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      averageResolutionTime: Math.round(averageResolutionTime * 100) / 100
    };
  }

  /**
   * Анализира SLA прекршаје
   */
  async analyzeSlaBreaches(startDate: Date, endDate: Date): Promise<SlaBreachAnalysis> {
    const breachEvents = await prisma.slaEvent.findMany({
      where: {
        eventType: {
          in: ['response_breach', 'resolution_breach']
        },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        ticket: {
          include: {
            category: true
          }
        }
      }
    });

    const responseBreaches = breachEvents.filter(e => e.eventType === 'response_breach').length;
    const resolutionBreaches = breachEvents.filter(e => e.eventType === 'resolution_breach').length;

    // Прекршаји по приоритету
    const byPriority: Record<string, number> = {};
    breachEvents.forEach(event => {
      const priority = event.ticket?.priority || 'unknown';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    });

    // Прекршаји по категорији
    const byCategory: Record<string, number> = {};
    breachEvents.forEach(event => {
      const categoryName = event.ticket?.category?.name || 'Без категорије';
      byCategory[categoryName] = (byCategory[categoryName] || 0) + 1;
    });

    // Тренд прекршаја (дневно)
    const breachTrend = await this.generateBreachTrend(startDate, endDate);

    return {
      responseBreaches,
      resolutionBreaches,
      byPriority,
      byCategory,
      breachTrend
    };
  }

  /**
   * Генерише тренд перформанси
   */
  async generatePerformanceTrend(
    startDate: Date, 
    endDate: Date, 
    reportType: 'daily' | 'weekly' | 'monthly'
  ): Promise<SlaPerformanceTrend[]> {
    const trends: SlaPerformanceTrend[] = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      let periodStart: Date;
      let periodEnd: Date;
      let periodLabel: string;

      switch (reportType) {
        case 'daily':
          periodStart = startOfDay(currentDate);
          periodEnd = endOfDay(currentDate);
          periodLabel = format(currentDate, 'dd.MM.yyyy', { locale: sr });
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          periodStart = startOfWeek(currentDate, { weekStartsOn: 1 });
          periodEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
          periodLabel = `${format(periodStart, 'dd.MM', { locale: sr })} - ${format(periodEnd, 'dd.MM.yyyy', { locale: sr })}`;
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          periodStart = startOfMonth(currentDate);
          periodEnd = endOfMonth(currentDate);
          periodLabel = format(currentDate, 'MMMM yyyy', { locale: sr });
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        default:
          throw new Error('Неподржан тип извештаја');
      }

      const metrics = await this.calculateSlaMetrics(periodStart, periodEnd);
      
      trends.push({
        period: periodLabel,
        complianceRate: metrics.complianceRate,
        averageResponseTime: metrics.averageResponseTime,
        averageResolutionTime: metrics.averageResolutionTime,
        totalTickets: metrics.totalTickets,
        breaches: metrics.breachedTickets
      });
    }

    return trends;
  }

  /**
   * Добија категорије са највише прекршаја
   */
  async getTopViolatingCategories(startDate: Date, endDate: Date, limit: number = 5) {
    const categories = await prisma.category.findMany({
      include: {
        tickets: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    });

    const categoryStats = categories.map(category => {
      const totalTickets = category.tickets.length;
      const violations = category.tickets.filter(t => t.slaStatus === 'breached').length;
      const complianceRate = totalTickets > 0 ? ((totalTickets - violations) / totalTickets) * 100 : 100;

      return {
        categoryName: category.name,
        violations,
        complianceRate: Math.round(complianceRate * 100) / 100
      };
    });

    return categoryStats
      .sort((a, b) => b.violations - a.violations)
      .slice(0, limit);
  }

  /**
   * Добија сажетак ескалација
   */
  async getEscalationSummary(startDate: Date, endDate: Date) {
    const escalations = await prisma.slaEvent.findMany({
      where: {
        eventType: 'escalation',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const totalEscalations = escalations.length;
    const byLevel: Record<number, number> = {};

    escalations.forEach(escalation => {
      try {
        const metadata = JSON.parse(escalation.metadata || '{}');
        const level = metadata.escalationLevel || 1;
        byLevel[level] = (byLevel[level] || 0) + 1;
      } catch (error) {
        // Игнориши грешке парсирања метаподатака
      }
    });

    return {
      totalEscalations,
      byLevel
    };
  }

  /**
   * Генерише тренд прекршаја по данима
   */
  private async generateBreachTrend(startDate: Date, endDate: Date) {
    const trend: Array<{ date: string; breaches: number }> = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayStart = startOfDay(currentDate);
      const dayEnd = endOfDay(currentDate);

      const breaches = await prisma.slaEvent.count({
        where: {
          eventType: {
            in: ['response_breach', 'resolution_breach']
          },
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      });

      trend.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        breaches
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return trend;
  }

  /**
   * Форматира лабел за период
   */
  private formatPeriodLabel(startDate: Date, endDate: Date, reportType: string): string {
    const start = format(startDate, 'dd.MM.yyyy', { locale: sr });
    const end = format(endDate, 'dd.MM.yyyy', { locale: sr });

    const typeLabels = {
      daily: 'Дневни извештај',
      weekly: 'Недељни извештај', 
      monthly: 'Месечни извештај'
    };

    return `${typeLabels[reportType as keyof typeof typeLabels]} (${start} - ${end})`;
  }

  /**
   * Експортује извештај у CSV формат
   */
  async exportReportToCsv(report: SlaReport): Promise<string> {
    const csvLines: string[] = [];
    
    // Header информације
    csvLines.push('SLA Извештај');
    csvLines.push(`Период,${report.period.label}`);
    csvLines.push('');
    
    // Основне метрике
    csvLines.push('Основне метрике');
    csvLines.push('Метрика,Вредност');
    csvLines.push(`Укупно тикета,${report.metrics.totalTickets}`);
    csvLines.push(`У року,${report.metrics.onTrackTickets}`);
    csvLines.push(`Упозорење,${report.metrics.warningTickets}`);
    csvLines.push(`Прекршено,${report.metrics.breachedTickets}`);
    csvLines.push(`Стопа усклађености,${report.metrics.complianceRate}%`);
    csvLines.push(`Просечно време одзива,${report.metrics.averageResponseTime} сати`);
    csvLines.push(`Просечно време решавања,${report.metrics.averageResolutionTime} сати`);
    csvLines.push('');

    // Тренд перформанси
    csvLines.push('Тренд перформанси');
    csvLines.push('Период,Усклађеност %,Просечан одзив (h),Просечно решавање (h),Укупно тикета,Прекршаји');
    report.performanceTrend.forEach(trend => {
      csvLines.push(`${trend.period},${trend.complianceRate},${trend.averageResponseTime},${trend.averageResolutionTime},${trend.totalTickets},${trend.breaches}`);
    });

    return csvLines.join('\n');
  }
}

export default new SlaReportingService(); 