import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, getYear, getMonth, getWeek, getDay, getHours, differenceInMinutes } from 'date-fns';
import cron from 'node-cron';

const prisma = new PrismaClient();

export interface ETLJobResult {
  jobName: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  errors: string[];
  duration: number; // in milliseconds
  timestamp: Date;
}

class ETLService {
  private isRunning = false;

  /**
   * Initialize ETL scheduled jobs
   */
  initializeScheduledJobs() {
    // Run daily ETL at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Pokretanje dnevnog ETL posla...');
      await this.runDailyETL();
    });

    // Run hourly ETL for system usage
    cron.schedule('0 * * * *', async () => {
      console.log('Pokretanje hourly ETL posla...');
      await this.runHourlyETL();
    });

    // Run weekly ETL on Sundays at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      console.log('Pokretanje weekly ETL posla...');
      await this.runWeeklyETL();
    });

    console.log('ETL scheduled jobs initialized');
  }

  /**
   * Run complete ETL process manually
   */
  async runCompleteETL(): Promise<ETLJobResult[]> {
    if (this.isRunning) {
      throw new Error('ETL već je u toku');
    }

    this.isRunning = true;
    const results: ETLJobResult[] = [];

    try {
      console.log('Pokretanje kompletnog ETL procesa...');

      // Extract and load ticket analytics
      results.push(await this.extractTicketAnalytics());

      // Extract and load SLA analytics
      results.push(await this.extractSlaAnalytics());

             // Extract and load user analytics
       results.push(await this.extractUserAnalytics('monthly'));

       // Extract and load system usage analytics
       results.push(await this.extractSystemUsageAnalytics('daily'));

      console.log('Kompletni ETL proces završen uspešno');
      return results;
    } catch (error) {
      console.error('Greška u ETL procesu:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Daily ETL job
   */
  async runDailyETL(): Promise<ETLJobResult[]> {
    const results: ETLJobResult[] = [];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    results.push(await this.extractTicketAnalytics(yesterday));
    results.push(await this.extractSlaAnalytics(yesterday));
    results.push(await this.extractUserAnalytics('daily', yesterday));

    return results;
  }

  /**
   * Hourly ETL job
   */
  async runHourlyETL(): Promise<ETLJobResult[]> {
    const results: ETLJobResult[] = [];
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    results.push(await this.extractSystemUsageAnalytics('hourly', lastHour));

    return results;
  }

  /**
   * Weekly ETL job
   */
  async runWeeklyETL(): Promise<ETLJobResult[]> {
    const results: ETLJobResult[] = [];
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    results.push(await this.extractUserAnalytics('weekly', lastWeek));

    return results;
  }

  /**
   * Extract and transform ticket data into analytics format
   */
  async extractTicketAnalytics(fromDate?: Date): Promise<ETLJobResult> {
    const startTime = Date.now();
    const jobName = 'Ticket Analytics ETL';
    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    try {
      // Define date range
      const dateFilter = fromDate ? {
        createdAt: {
          gte: startOfDay(fromDate),
          lte: endOfDay(fromDate)
        }
      } : {};

      // Extract tickets
      const tickets = await prisma.ticket.findMany({
        where: dateFilter,
        include: {
          category: true,
          requester: true,
          assignee: true,
          resolver: true,
          comments: true,
          attachments: true,
          slaEvents: true
        }
      });

      recordsProcessed = tickets.length;

      for (const ticket of tickets) {
        try {
          // Calculate metrics
          const firstResponseTime = ticket.firstResponseAt 
            ? differenceInMinutes(new Date(ticket.firstResponseAt), new Date(ticket.createdAt))
            : null;

          const resolutionTime = ticket.resolvedAt 
            ? differenceInMinutes(new Date(ticket.resolvedAt), new Date(ticket.createdAt))
            : null;

          const escalationCount = ticket.slaEvents.filter(e => e.eventType === 'escalation').length;

          const analyticsData = {
            ticketId: ticket.id,
            categoryId: ticket.categoryId,
            priority: ticket.priority,
            status: ticket.status,
            requesterId: ticket.requesterId,
            assigneeId: ticket.assignedTo,
            resolverId: ticket.resolvedBy,
            createdAt: ticket.createdAt,
            firstResponseTime,
            resolutionTime,
            totalComments: ticket.comments.length,
            totalAttachments: ticket.attachments.length,
            slaResponseBreach: ticket.slaEvents.some(e => 
              e.eventType === 'response_due' && e.status === 'triggered'
            ),
            slaResolutionBreach: ticket.slaEvents.some(e => 
              e.eventType === 'resolution_due' && e.status === 'triggered'
            ),
            escalationCount,
            yearCreated: getYear(new Date(ticket.createdAt)),
            monthCreated: getMonth(new Date(ticket.createdAt)) + 1, // 1-based
            weekCreated: getWeek(new Date(ticket.createdAt)),
            dayOfWeekCreated: getDay(new Date(ticket.createdAt)),
            hourCreated: getHours(new Date(ticket.createdAt)),
            requesterDepartment: ticket.requester.department,
            assigneeDepartment: ticket.assignee?.department
          };

          // Check if record exists
          const existingRecord = await prisma.ticketAnalytics.findFirst({
            where: { ticketId: ticket.id }
          });

          if (existingRecord) {
            await prisma.ticketAnalytics.update({
              where: { id: existingRecord.id },
              data: analyticsData
            });
            recordsUpdated++;
          } else {
            await prisma.ticketAnalytics.create({
              data: analyticsData
            });
            recordsInserted++;
          }
        } catch (error) {
          errors.push(`Greška pri procesiranju tiketa ${ticket.id}: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Greška u ETL procesu za ticket analytics: ${error}`);
    }

    return {
      jobName,
      recordsProcessed,
      recordsInserted,
      recordsUpdated,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Extract and transform SLA data into analytics format
   */
  async extractSlaAnalytics(fromDate?: Date): Promise<ETLJobResult> {
    const startTime = Date.now();
    const jobName = 'SLA Analytics ETL';
    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    try {
      const dateFilter = fromDate ? {
        createdAt: {
          gte: startOfDay(fromDate),
          lte: endOfDay(fromDate)
        }
      } : {};

      // Extract tickets with SLA data
      const tickets = await prisma.ticket.findMany({
        where: dateFilter,
        include: {
          category: true,
          slaEvents: {
            include: {
              slaPolicy: true
            }
          }
        }
      });

      recordsProcessed = tickets.length;

      for (const ticket of tickets) {
        try {
          // Get SLA policy (from category or ticket's SLA events)
          const slaPolicy = ticket.category?.slaPolicies?.[0] || 
                          ticket.slaEvents.find(e => e.slaPolicy)?.slaPolicy;

          if (!slaPolicy) continue;

          // Calculate actual times
          const actualResponseTime = ticket.firstResponseAt 
            ? differenceInMinutes(new Date(ticket.firstResponseAt), new Date(ticket.createdAt))
            : null;

          const actualResolutionTime = ticket.resolvedAt 
            ? differenceInMinutes(new Date(ticket.resolvedAt), new Date(ticket.createdAt))
            : null;

          // Calculate compliance
          const responseTimeCompliance = actualResponseTime !== null 
            ? actualResponseTime <= (slaPolicy.responseTimeHours * 60)
            : null;

          const resolutionTimeCompliance = actualResolutionTime !== null 
            ? actualResolutionTime <= (slaPolicy.resolutionTimeHours * 60)
            : null;

          // Calculate variances
          const responseTimeVariance = actualResponseTime !== null
            ? actualResponseTime - (slaPolicy.responseTimeHours * 60)
            : null;

          const resolutionTimeVariance = actualResolutionTime !== null
            ? actualResolutionTime - (slaPolicy.resolutionTimeHours * 60)
            : null;

          const analyticsData = {
            ticketId: ticket.id,
            slaPolicyId: slaPolicy.id,
            categoryId: ticket.categoryId,
            priority: ticket.priority,
            responseTimeSla: slaPolicy.responseTimeHours * 60, // convert to minutes
            resolutionTimeSla: slaPolicy.resolutionTimeHours * 60,
            actualResponseTime,
            actualResolutionTime,
            responseTimeCompliance,
            resolutionTimeCompliance,
            responseTimeVariance,
            resolutionTimeVariance,
            yearCreated: getYear(new Date(ticket.createdAt)),
            monthCreated: getMonth(new Date(ticket.createdAt)) + 1,
            weekCreated: getWeek(new Date(ticket.createdAt))
          };

          // Check if record exists
          const existingRecord = await prisma.slaAnalytics.findFirst({
            where: { ticketId: ticket.id }
          });

          if (existingRecord) {
            await prisma.slaAnalytics.update({
              where: { id: existingRecord.id },
              data: analyticsData
            });
            recordsUpdated++;
          } else {
            await prisma.slaAnalytics.create({
              data: analyticsData
            });
            recordsInserted++;
          }
        } catch (error) {
          errors.push(`Greška pri procesiranju SLA za tiket ${ticket.id}: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Greška u ETL procesu za SLA analytics: ${error}`);
    }

    return {
      jobName,
      recordsProcessed,
      recordsInserted,
      recordsUpdated,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Extract and transform user performance data
   */
  async extractUserAnalytics(periodType: 'daily' | 'weekly' | 'monthly', fromDate?: Date): Promise<ETLJobResult> {
    const startTime = Date.now();
    const jobName = `User Analytics ETL (${periodType})`;
    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    try {
      const targetDate = fromDate || new Date();
      const year = getYear(targetDate);
      const month = periodType !== 'daily' ? getMonth(targetDate) + 1 : null;
      const week = periodType === 'weekly' ? getWeek(targetDate) : null;
      const day = periodType === 'daily' ? targetDate.getDate() : null;

      // Get date range for the period
      let startDate: Date, endDate: Date;
      
      switch (periodType) {
        case 'daily':
          startDate = startOfDay(targetDate);
          endDate = endOfDay(targetDate);
          break;
        case 'weekly':
          startDate = startOfDay(new Date(targetDate.getTime() - 6 * 24 * 60 * 60 * 1000));
          endDate = endOfDay(targetDate);
          break;
        case 'monthly':
          startDate = new Date(year, month! - 1, 1);
          endDate = new Date(year, month!, 0, 23, 59, 59);
          break;
      }

      // Extract users with their activities
      const users = await prisma.user.findMany({
        include: {
          role: true,
          createdTickets: {
            where: {
              createdAt: { gte: startDate, lte: endDate }
            }
          },
          assignedTickets: {
            where: {
              createdAt: { gte: startDate, lte: endDate }
            }
          },
          resolvedTickets: {
            where: {
              resolvedAt: { gte: startDate, lte: endDate }
            }
          },
          kbArticles: {
            where: {
              createdAt: { gte: startDate, lte: endDate }
            }
          },
          approvedArticles: {
            where: {
              approvedAt: { gte: startDate, lte: endDate }
            }
          }
        }
      });

      recordsProcessed = users.length;

      for (const user of users) {
        try {
          // Calculate metrics
          const ticketsCreated = user.createdTickets.length;
          const ticketsAssigned = user.assignedTickets.length;
          const ticketsResolved = user.resolvedTickets.length;

          // Calculate average resolution time
          const resolutionTimes = user.resolvedTickets
            .filter(t => t.resolvedAt)
            .map(t => differenceInMinutes(new Date(t.resolvedAt!), new Date(t.createdAt)));

          const averageResolutionTime = resolutionTimes.length > 0
            ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
            : null;

          // Calculate average first response time
          const firstResponseTimes = user.assignedTickets
            .filter(t => t.firstResponseAt)
            .map(t => differenceInMinutes(new Date(t.firstResponseAt!), new Date(t.createdAt)));

          const averageFirstResponseTime = firstResponseTimes.length > 0
            ? firstResponseTimes.reduce((sum, time) => sum + time, 0) / firstResponseTimes.length
            : null;

          // Calculate SLA compliance
          const slaCompliantTickets = user.assignedTickets.filter(t => t.slaStatus === 'on_track').length;
          const slaResponseCompliance = ticketsAssigned > 0 
            ? (slaCompliantTickets / ticketsAssigned) * 100 
            : null;

          // Mock session data (would be tracked by session middleware)
          const loginCount = Math.floor(Math.random() * 10) + 1; // Mock data
          const totalSessionTime = loginCount * (30 + Math.floor(Math.random() * 120)); // Mock: 30-150 min per session

          const analyticsData = {
            userId: user.id,
            roleId: user.roleId,
            department: user.department,
            periodType,
            periodYear: year,
            periodMonth: month,
            periodWeek: week,
            periodDay: day,
            ticketsCreated,
            ticketsAssigned,
            ticketsResolved,
            averageResolutionTime,
            averageFirstResponseTime,
            slaResponseCompliance,
            slaResolutionCompliance: slaResponseCompliance, // Same as response for now
            kbArticlesCreated: user.kbArticles.length,
            kbArticlesApproved: user.approvedArticles.length,
            kbArticleViews: 0, // Would be tracked separately
            loginCount,
            totalSessionTime
          };

          // Check if record exists
          const existingRecord = await prisma.userAnalytics.findFirst({
            where: {
              userId: user.id,
              periodType,
              periodYear: year,
              periodMonth: month,
              periodWeek: week,
              periodDay: day
            }
          });

          if (existingRecord) {
            await prisma.userAnalytics.update({
              where: { id: existingRecord.id },
              data: analyticsData
            });
            recordsUpdated++;
          } else {
            await prisma.userAnalytics.create({
              data: analyticsData
            });
            recordsInserted++;
          }
        } catch (error) {
          errors.push(`Greška pri procesiranju korisnika ${user.id}: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Greška u ETL procesu za user analytics: ${error}`);
    }

    return {
      jobName,
      recordsProcessed,
      recordsInserted,
      recordsUpdated,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Extract and transform system usage data
   */
  async extractSystemUsageAnalytics(periodType: 'hourly' | 'daily' | 'weekly' | 'monthly', fromDate?: Date): Promise<ETLJobResult> {
    const startTime = Date.now();
    const jobName = `System Usage Analytics ETL (${periodType})`;
    let recordsProcessed = 1; // One record per period
    let recordsInserted = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

    try {
      const targetDate = fromDate || new Date();
      const year = getYear(targetDate);
      const month = periodType !== 'hourly' && periodType !== 'daily' ? getMonth(targetDate) + 1 : null;
      const week = periodType === 'weekly' ? getWeek(targetDate) : null;
      const day = periodType !== 'hourly' ? targetDate.getDate() : null;
      const hour = periodType === 'hourly' ? getHours(targetDate) : null;

      // Get date range for the period
      let startDate: Date, endDate: Date;
      
      switch (periodType) {
        case 'hourly':
          startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), targetDate.getHours());
          endDate = new Date(startDate.getTime() + 60 * 60 * 1000 - 1);
          break;
        case 'daily':
          startDate = startOfDay(targetDate);
          endDate = endOfDay(targetDate);
          break;
        case 'weekly':
          startDate = startOfDay(new Date(targetDate.getTime() - 6 * 24 * 60 * 60 * 1000));
          endDate = endOfDay(targetDate);
          break;
        case 'monthly':
          startDate = new Date(year, month! - 1, 1);
          endDate = new Date(year, month!, 0, 23, 59, 59);
          break;
      }

      // Calculate system metrics
      const [totalUsers, activeUsers, newUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            lastLogin: { gte: startDate, lte: endDate }
          }
        }),
        prisma.user.count({
          where: {
            createdAt: { gte: startDate, lte: endDate }
          }
        })
      ]);

      const [ticketsCreated, ticketsResolved, ticketsPending] = await Promise.all([
        prisma.ticket.count({
          where: {
            createdAt: { gte: startDate, lte: endDate }
          }
        }),
        prisma.ticket.count({
          where: {
            resolvedAt: { gte: startDate, lte: endDate }
          }
        }),
        prisma.ticket.count({
          where: {
            status: { notIn: ['resolved', 'closed'] }
          }
        })
      ]);

      const kbArticleViews = await prisma.kbArticle.aggregate({
        _sum: {
          viewCount: true
        },
        where: {
          updatedAt: { gte: startDate, lte: endDate }
        }
      });

      // Mock data for metrics that would be tracked by middleware
      const totalSessions = Math.floor(activeUsers * 1.5);
      const averageSessionTime = 45 + Math.floor(Math.random() * 60); // 45-105 minutes
      const averagePageLoad = 800 + Math.floor(Math.random() * 500); // 800-1300ms
      const apiResponseTime = 150 + Math.floor(Math.random() * 200); // 150-350ms
      const errorCount = Math.floor(Math.random() * 10); // 0-9 errors

      const analyticsData = {
        periodType,
        periodYear: year,
        periodMonth: month,
        periodWeek: week,
        periodDay: day,
        periodHour: hour,
        totalUsers,
        activeUsers,
        newUsers,
        totalSessions,
        averageSessionTime,
        ticketsCreated,
        ticketsResolved,
        ticketsPending,
        kbArticleViews: kbArticleViews._sum.viewCount || 0,
        kbSearchQueries: Math.floor(kbArticleViews._sum.viewCount || 0 * 0.3), // Mock: 30% of views
        averagePageLoad,
        apiResponseTime,
        errorCount
      };

      // Check if record exists
      const existingRecord = await prisma.systemUsageAnalytics.findFirst({
        where: {
          periodType,
          periodYear: year,
          periodMonth: month,
          periodWeek: week,
          periodDay: day,
          periodHour: hour
        }
      });

      if (existingRecord) {
        await prisma.systemUsageAnalytics.update({
          where: { id: existingRecord.id },
          data: analyticsData
        });
        recordsUpdated++;
      } else {
        await prisma.systemUsageAnalytics.create({
          data: analyticsData
        });
        recordsInserted++;
      }

    } catch (error) {
      errors.push(`Greška u ETL procesu za system usage analytics: ${error}`);
    }

    return {
      jobName,
      recordsProcessed,
      recordsInserted,
      recordsUpdated,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Clean old analytics data
   */
  async cleanOldAnalyticsData(retentionDays: number = 365): Promise<ETLJobResult> {
    const startTime = Date.now();
    const jobName = 'Clean Old Analytics Data';
    let recordsProcessed = 0;
    const errors: string[] = [];

    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // Clean old ticket analytics
      const deletedTicketAnalytics = await prisma.ticketAnalytics.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      });

      // Clean old SLA analytics
      const deletedSlaAnalytics = await prisma.slaAnalytics.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      });

      // Clean old user analytics (keep monthly data longer)
      const userAnalyticsCutoff = new Date(Date.now() - (retentionDays * 2) * 24 * 60 * 60 * 1000);
      const deletedUserAnalytics = await prisma.userAnalytics.deleteMany({
        where: {
          createdAt: { lt: userAnalyticsCutoff },
          periodType: { in: ['daily', 'weekly'] }
        }
      });

      // Clean old system usage analytics (keep hourly data for shorter period)
      const systemUsageCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
      const deletedSystemUsage = await prisma.systemUsageAnalytics.deleteMany({
        where: {
          createdAt: { lt: systemUsageCutoff },
          periodType: 'hourly'
        }
      });

      recordsProcessed = deletedTicketAnalytics.count + deletedSlaAnalytics.count + 
                       deletedUserAnalytics.count + deletedSystemUsage.count;

      console.log(`Očišćeno ${recordsProcessed} starih analytics zapisa`);

    } catch (error) {
      errors.push(`Greška pri čišćenju starih podataka: ${error}`);
    }

    return {
      jobName,
      recordsProcessed,
      recordsInserted: 0,
      recordsUpdated: 0,
      errors,
      duration: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Get ETL job status
   */
  getETLStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: new Date(), // Would be tracked in production
      nextScheduled: {
        daily: 'Svaki dan u 2:00',
        hourly: 'Svaki sat',
        weekly: 'Nedelju u 3:00'
      }
    };
  }
}

export const etlService = new ETLService(); 