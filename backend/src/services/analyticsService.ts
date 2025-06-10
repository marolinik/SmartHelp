import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { sr } from 'date-fns/locale';

const prisma = new PrismaClient();

export interface AnalyticsQuery {
  startDate?: Date;
  endDate?: Date;
  categoryIds?: string[];
  userIds?: string[];
  priorities?: string[];
  statuses?: string[];
  departments?: string[];
}

export interface TicketMetrics {
  totalTickets: number;
  resolvedTickets: number;
  pendingTickets: number;
  averageResolutionTime: number; // in minutes
  averageFirstResponseTime: number; // in minutes
  slaCompliance: number; // percentage
  ticketsByPriority: Record<string, number>;
  ticketsByStatus: Record<string, number>;
  ticketsByCategory: Record<string, number>;
  trendsData: TrendDataPoint[];
}

export interface TrendDataPoint {
  date: string;
  count: number;
  label: string; // in Serbian
}

export interface SlaMetrics {
  responseTimeCompliance: number; // percentage
  resolutionTimeCompliance: number; // percentage
  averageResponseTime: number; // in minutes
  averageResolutionTime: number; // in minutes
  breachedTickets: number;
  complianceByCategory: Record<string, number>;
  complianceTrends: TrendDataPoint[];
}

export interface UserPerformanceMetrics {
  userId: string;
  userName: string;
  ticketsAssigned: number;
  ticketsResolved: number;
  averageResolutionTime: number;
  slaCompliance: number;
  kbArticlesCreated: number;
  performanceRating: number; // calculated score
}

export interface SystemUsageMetrics {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  averageSessionTime: number;
  peakUsageHours: number[];
  usageByDepartment: Record<string, number>;
  popularFeatures: Record<string, number>;
}

class AnalyticsService {
  /**
   * Generate comprehensive ticket analytics with Serbian language support
   */
  async getTicketMetrics(query: AnalyticsQuery): Promise<TicketMetrics> {
    const { startDate, endDate, categoryIds, userIds, priorities, statuses, departments } = query;
    
    const whereClause = this.buildWhereClause(query);

    // Get basic ticket counts
    const [totalTickets, resolvedTickets, pendingTickets] = await Promise.all([
      prisma.ticket.count({ where: whereClause }),
      prisma.ticket.count({ 
        where: { 
          ...whereClause, 
          status: { in: ['resolved', 'closed'] } 
        } 
      }),
      prisma.ticket.count({ 
        where: { 
          ...whereClause, 
          status: { notIn: ['resolved', 'closed'] } 
        } 
      })
    ]);

    // Get tickets with resolution times
    const ticketsWithTimes = await prisma.ticket.findMany({
      where: {
        ...whereClause,
        resolvedAt: { not: null }
      },
      select: {
        id: true,
        createdAt: true,
        firstResponseAt: true,
        resolvedAt: true,
        priority: true,
        status: true,
        category: {
          select: {
            name: true
          }
        }
      }
    });

    // Calculate average times
    const resolutionTimes = ticketsWithTimes
      .filter(t => t.resolvedAt)
      .map(t => {
        const createdAt = new Date(t.createdAt);
        const resolvedAt = new Date(t.resolvedAt!);
        return Math.floor((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60)); // minutes
      });

    const firstResponseTimes = ticketsWithTimes
      .filter(t => t.firstResponseAt)
      .map(t => {
        const createdAt = new Date(t.createdAt);
        const firstResponseAt = new Date(t.firstResponseAt!);
        return Math.floor((firstResponseAt.getTime() - createdAt.getTime()) / (1000 * 60)); // minutes
      });

    const averageResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length 
      : 0;

    const averageFirstResponseTime = firstResponseTimes.length > 0 
      ? firstResponseTimes.reduce((sum, time) => sum + time, 0) / firstResponseTimes.length 
      : 0;

    // Get SLA compliance
    const slaCompliantTickets = await prisma.ticket.count({
      where: {
        ...whereClause,
        slaStatus: 'on_track'
      }
    });

    const slaCompliance = totalTickets > 0 ? (slaCompliantTickets / totalTickets) * 100 : 0;

    // Group by priority
    const ticketsByPriority = await this.groupTicketsBy('priority', whereClause);
    
    // Group by status
    const ticketsByStatus = await this.groupTicketsBy('status', whereClause);
    
    // Group by category
    const ticketsByCategory = await this.groupTicketsByCategory(whereClause);

    // Get trends data
    const trendsData = await this.getTicketTrends(query);

    return {
      totalTickets,
      resolvedTickets,
      pendingTickets,
      averageResolutionTime,
      averageFirstResponseTime,
      slaCompliance,
      ticketsByPriority,
      ticketsByStatus,
      ticketsByCategory,
      trendsData
    };
  }

  /**
   * Generate SLA analytics with Serbian translations
   */
  async getSlaMetrics(query: AnalyticsQuery): Promise<SlaMetrics> {
    const whereClause = this.buildWhereClause(query);

    // Get SLA events data
    const slaEvents = await prisma.slaEvent.findMany({
      where: {
        ticket: whereClause,
        eventType: { in: ['response_due', 'resolution_due'] }
      },
      include: {
        ticket: {
          include: {
            category: true
          }
        }
      }
    });

    // Calculate compliance rates
    const responseEvents = slaEvents.filter(e => e.eventType === 'response_due');
    const resolutionEvents = slaEvents.filter(e => e.eventType === 'resolution_due');

    const responseCompliantCount = responseEvents.filter(e => e.status === 'resolved').length;
    const resolutionCompliantCount = resolutionEvents.filter(e => e.status === 'resolved').length;

    const responseTimeCompliance = responseEvents.length > 0 
      ? (responseCompliantCount / responseEvents.length) * 100 
      : 0;

    const resolutionTimeCompliance = resolutionEvents.length > 0 
      ? (resolutionCompliantCount / resolutionEvents.length) * 100 
      : 0;

    // Calculate average response and resolution times
    const ticketsWithSla = await prisma.ticket.findMany({
      where: {
        ...whereClause,
        firstResponseAt: { not: null },
        resolvedAt: { not: null }
      },
      select: {
        createdAt: true,
        firstResponseAt: true,
        resolvedAt: true
      }
    });

    const averageResponseTime = this.calculateAverageTime(
      ticketsWithSla,
      'createdAt',
      'firstResponseAt'
    );

    const averageResolutionTime = this.calculateAverageTime(
      ticketsWithSla,
      'createdAt',
      'resolvedAt'
    );

    // Count breached tickets
    const breachedTickets = await prisma.ticket.count({
      where: {
        ...whereClause,
        slaStatus: 'breached'
      }
    });

    // Get compliance by category
    const complianceByCategory = await this.getSlaComplianceByCategory(query);

    // Get compliance trends
    const complianceTrends = await this.getSlaComplianceTrends(query);

    return {
      responseTimeCompliance,
      resolutionTimeCompliance,
      averageResponseTime,
      averageResolutionTime,
      breachedTickets,
      complianceByCategory,
      complianceTrends
    };
  }

  /**
   * Generate user performance metrics
   */
  async getUserPerformanceMetrics(query: AnalyticsQuery): Promise<UserPerformanceMetrics[]> {
    const { userIds, startDate, endDate } = query;
    
    const userFilter = userIds ? { id: { in: userIds } } : {};
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const users = await prisma.user.findMany({
      where: userFilter,
      include: {
        assignedTickets: {
          where: dateFilter,
          include: {
            category: true
          }
        },
        resolvedTickets: {
          where: {
            ...dateFilter,
            resolvedAt: { not: null }
          }
        },
        kbArticles: {
          where: {
            createdAt: dateFilter.createdAt
          }
        }
      }
    });

    const performanceMetrics = await Promise.all(
      users.map(async (user) => {
        const ticketsAssigned = user.assignedTickets.length;
        const ticketsResolved = user.resolvedTickets.length;

        // Calculate average resolution time
        const resolutionTimes = user.resolvedTickets
          .filter(t => t.resolvedAt)
          .map(t => {
            const createdAt = new Date(t.createdAt);
            const resolvedAt = new Date(t.resolvedAt!);
            return Math.floor((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60));
          });

        const averageResolutionTime = resolutionTimes.length > 0
          ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
          : 0;

        // Calculate SLA compliance
        const slaCompliantTickets = user.assignedTickets.filter(t => t.slaStatus === 'on_track').length;
        const slaCompliance = ticketsAssigned > 0 ? (slaCompliantTickets / ticketsAssigned) * 100 : 0;

        const kbArticlesCreated = user.kbArticles.length;

        // Calculate performance rating (weighted score)
        const performanceRating = this.calculatePerformanceRating({
          ticketsResolved,
          averageResolutionTime,
          slaCompliance,
          kbArticlesCreated
        });

        return {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          ticketsAssigned,
          ticketsResolved,
          averageResolutionTime,
          slaCompliance,
          kbArticlesCreated,
          performanceRating
        };
      })
    );

    return performanceMetrics.sort((a, b) => b.performanceRating - a.performanceRating);
  }

  /**
   * Generate system usage metrics
   */
  async getSystemUsageMetrics(query: AnalyticsQuery): Promise<SystemUsageMetrics> {
    const { startDate, endDate } = query;
    const dateFilter = this.buildDateFilter(startDate, endDate);

    // Get user statistics
    const [totalUsers, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          lastLogin: dateFilter.createdAt
        }
      })
    ]);

    // Mock data for session statistics (would be tracked by session middleware)
    const totalSessions = Math.floor(activeUsers * 1.5); // Approximate
    const averageSessionTime = 45; // minutes

    // Get peak usage hours (mock data - would be tracked by analytics middleware)
    const peakUsageHours = [9, 10, 11, 14, 15]; // 9-11 AM and 2-3 PM

    // Get usage by department
    const usageByDepartment = await this.getUsageByDepartment(dateFilter);

    // Get popular features (mock data - would be tracked by feature usage analytics)
    const popularFeatures = {
      'Kreiranje tiketa': 150,
      'Pregled tiketa': 300,
      'Baza znanja': 200,
      'Izveštaji': 75,
      'Profil korisnika': 100
    };

    return {
      totalUsers,
      activeUsers,
      totalSessions,
      averageSessionTime,
      peakUsageHours,
      usageByDepartment,
      popularFeatures
    };
  }

  /**
   * Helper method to build WHERE clause for Prisma queries
   */
  private buildWhereClause(query: AnalyticsQuery) {
    const { startDate, endDate, categoryIds, userIds, priorities, statuses, departments } = query;
    
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = this.buildDateFilter(startDate, endDate).createdAt;
    }

    if (categoryIds && categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    }

    if (userIds && userIds.length > 0) {
      where.OR = [
        { requesterId: { in: userIds } },
        { assignedTo: { in: userIds } },
        { resolvedBy: { in: userIds } }
      ];
    }

    if (priorities && priorities.length > 0) {
      where.priority = { in: priorities };
    }

    if (statuses && statuses.length > 0) {
      where.status = { in: statuses };
    }

    if (departments && departments.length > 0) {
      where.OR = [
        ...(where.OR || []),
        {
          requester: {
            department: { in: departments }
          }
        }
      ];
    }

    return where;
  }

  /**
   * Helper method to build date filter
   */
  private buildDateFilter(startDate?: Date, endDate?: Date) {
    const filter: any = {};
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.gte = startOfDay(startDate);
      }
      if (endDate) {
        filter.createdAt.lte = endOfDay(endDate);
      }
    }

    return filter;
  }

  /**
   * Group tickets by a specific field
   */
  private async groupTicketsBy(field: string, whereClause: any): Promise<Record<string, number>> {
    const groups = await prisma.ticket.groupBy({
      by: [field as any],
      where: whereClause,
      _count: {
        id: true
      }
    });

    const result: Record<string, number> = {};
    groups.forEach(group => {
      const key = (group as any)[field] || 'Без категорије';
      result[key] = group._count.id;
    });

    return result;
  }

  /**
   * Group tickets by category with Serbian names
   */
  private async groupTicketsByCategory(whereClause: any): Promise<Record<string, number>> {
    const groups = await prisma.ticket.groupBy({
      by: ['categoryId'],
      where: whereClause,
      _count: {
        id: true
      }
    });

    const result: Record<string, number> = {};
    
    for (const group of groups) {
      if (group.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: group.categoryId },
          select: { name: true }
        });
        result[category?.name || 'Без категорије'] = group._count.id;
      } else {
        result['Без категорије'] = group._count.id;
      }
    }

    return result;
  }

  /**
   * Get ticket trends data with Serbian labels
   */
  private async getTicketTrends(query: AnalyticsQuery): Promise<TrendDataPoint[]> {
    const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = query;
    const whereClause = this.buildWhereClause(query);

    const tickets = await prisma.ticket.findMany({
      where: {
        ...whereClause,
        createdAt: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate)
        }
      },
      select: {
        createdAt: true
      }
    });

    // Group by day
    const dailyCounts: Record<string, number> = {};
    tickets.forEach(ticket => {
      const dateKey = format(ticket.createdAt, 'yyyy-MM-dd');
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    });

    // Convert to trend data points
    const trendData: TrendDataPoint[] = [];
    let currentDate = startOfDay(startDate);
    
    while (currentDate <= endOfDay(endDate)) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const label = format(currentDate, 'dd. MMM', { locale: sr });
      
      trendData.push({
        date: dateKey,
        count: dailyCounts[dateKey] || 0,
        label
      });
      
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }

    return trendData;
  }

  /**
   * Calculate average time between two date fields
   */
  private calculateAverageTime(
    records: Array<{ [key: string]: Date | null }>,
    startField: string,
    endField: string
  ): number {
    const times = records
      .filter(r => r[startField] && r[endField])
      .map(r => {
        const start = new Date(r[startField]!);
        const end = new Date(r[endField]!);
        return Math.floor((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
      });

    return times.length > 0 
      ? times.reduce((sum, time) => sum + time, 0) / times.length 
      : 0;
  }

  /**
   * Get SLA compliance by category
   */
  private async getSlaComplianceByCategory(query: AnalyticsQuery): Promise<Record<string, number>> {
    const whereClause = this.buildWhereClause(query);
    
    const categories = await prisma.category.findMany({
      include: {
        tickets: {
          where: whereClause,
          select: {
            slaStatus: true
          }
        }
      }
    });

    const compliance: Record<string, number> = {};
    
    categories.forEach(category => {
      const totalTickets = category.tickets.length;
      if (totalTickets > 0) {
        const compliantTickets = category.tickets.filter(t => t.slaStatus === 'on_track').length;
        compliance[category.name] = (compliantTickets / totalTickets) * 100;
      }
    });

    return compliance;
  }

  /**
   * Get SLA compliance trends
   */
  private async getSlaComplianceTrends(query: AnalyticsQuery): Promise<TrendDataPoint[]> {
    // Simplified implementation - would calculate daily/weekly compliance rates
    const trends: TrendDataPoint[] = [];
    const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = query;
    
    let currentDate = startOfWeek(startDate);
    while (currentDate <= endOfWeek(endDate)) {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      
      const weekQuery = { ...query, startDate: weekStart, endDate: weekEnd };
      const whereClause = this.buildWhereClause(weekQuery);
      
      const [totalTickets, compliantTickets] = await Promise.all([
        prisma.ticket.count({ where: whereClause }),
        prisma.ticket.count({ 
          where: { 
            ...whereClause, 
            slaStatus: 'on_track' 
          } 
        })
      ]);
      
      const compliance = totalTickets > 0 ? (compliantTickets / totalTickets) * 100 : 0;
      
      trends.push({
        date: format(weekStart, 'yyyy-MM-dd'),
        count: Math.round(compliance),
        label: `${format(weekStart, 'dd.MM', { locale: sr })} - ${format(weekEnd, 'dd.MM', { locale: sr })}`
      });
      
      currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    return trends;
  }

  /**
   * Get usage statistics by department
   */
  private async getUsageByDepartment(dateFilter: any): Promise<Record<string, number>> {
    const departmentStats = await prisma.user.groupBy({
      by: ['department'],
      where: {
        lastLogin: dateFilter.createdAt,
        department: { not: null }
      },
      _count: {
        id: true
      }
    });

    const result: Record<string, number> = {};
    departmentStats.forEach(stat => {
      if (stat.department) {
        result[stat.department] = stat._count.id;
      }
    });

    return result;
  }

  /**
   * Calculate user performance rating
   */
  private calculatePerformanceRating(metrics: {
    ticketsResolved: number;
    averageResolutionTime: number;
    slaCompliance: number;
    kbArticlesCreated: number;
  }): number {
    const {
      ticketsResolved,
      averageResolutionTime,
      slaCompliance,
      kbArticlesCreated
    } = metrics;

    // Weighted scoring algorithm
    let score = 0;
    
    // Tickets resolved (40% weight)
    score += Math.min(ticketsResolved / 10, 1) * 40;
    
    // SLA compliance (35% weight)
    score += (slaCompliance / 100) * 35;
    
    // Resolution time (15% weight) - faster is better
    const timeScore = averageResolutionTime > 0 
      ? Math.max(0, 1 - (averageResolutionTime / (24 * 60))) // normalize against 24 hours
      : 0;
    score += timeScore * 15;
    
    // KB articles (10% weight)
    score += Math.min(kbArticlesCreated / 5, 1) * 10;

    return Math.round(score);
  }
}

export const analyticsService = new AnalyticsService(); 