import { PrismaClient } from '@prisma/client';
import * as cron from 'node-cron';
import { format, addDays, addWeeks, addMonths, parseISO } from 'date-fns';
import { sr } from 'date-fns/locale';
import { reportTemplateService } from './reportTemplateService';
import { analyticsService } from './analyticsService';
import { EmailService } from './EmailService';

const prisma = new PrismaClient();
const emailService = new EmailService();

// Temporary types until Prisma client is regenerated
export interface ScheduledReport {
  id: string;
  templateId: string;
  name: string;
  schedule: string;
  recipients: string;
  isActive: boolean;
  lastExecuted?: Date;
  nextExecution?: Date;
  executionCount: number;
  lastStatus?: string;
  lastError?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleOptions {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string; // HH:MM format
  dayOfWeek?: number; // 1-7 for weekly (1=Monday)
  dayOfMonth?: number; // 1-31 for monthly
  customCron?: string; // Custom cron expression
  timezone?: string;
}

export interface ReportScheduleConfig {
  templateId: string;
  name: string;
  recipients: string[]; // Email addresses
  scheduleOptions: ScheduleOptions;
  parameters?: Record<string, any>;
  isActive?: boolean;
  description?: string;
}

export interface ScheduledReportExecution {
  reportId: string;
  executionId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startTime: Date;
  endTime?: Date;
  error?: string;
  generatedFileUrl?: string;
  emailsSent?: number;
}

class ReportSchedulingService {
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();
  private executionQueue: Map<string, ScheduledReportExecution> = new Map();

  /**
   * Initialize scheduled reports from database
   */
  async initializeScheduledReports() {
    try {
      const scheduledReports = await prisma.scheduledReport.findMany({
        where: { isActive: true },
        include: { template: true }
      });

      console.log(`Иницијализација ${scheduledReports.length} заказаних извештаја...`);

      for (const report of scheduledReports) {
        await this.scheduleReport(report);
      }

      console.log('Сви заказани извештаји су успешно иницијализовани');
    } catch (error) {
      console.error('Грешка при иницијализацији заказаних извештаја:', error);
      throw error;
    }
  }

  /**
   * Create new scheduled report
   */
  async createScheduledReport(config: ReportScheduleConfig, createdBy: string): Promise<string> {
    try {
      // Validate template exists
      const template = await reportTemplateService.getTemplateById(config.templateId);
      if (!template) {
        throw new Error('Template не постоји');
      }

      // Calculate next execution time
      const nextExecution = this.calculateNextExecution(config.scheduleOptions);
      
      // Convert schedule to cron expression
      const cronExpression = this.convertToCronExpression(config.scheduleOptions);

      // Create database record
      const scheduledReport = await prisma.scheduledReport.create({
        data: {
          templateId: config.templateId,
          name: config.name,
          schedule: cronExpression,
          recipients: JSON.stringify(config.recipients),
          isActive: config.isActive ?? true,
          nextExecution,
          executionCount: 0,
          lastStatus: null,
          createdBy
        }
      });

      // Schedule the job if active
      if (config.isActive !== false) {
        await this.scheduleReport(scheduledReport);
      }

      console.log(`Креиран заказани извештај: ${config.name} (ID: ${scheduledReport.id})`);
      return scheduledReport.id;
    } catch (error) {
      console.error('Грешка при креирању заказаног извештаја:', error);
      throw new Error(`Грешка при креирању заказаног извештаја: ${error}`);
    }
  }

  /**
   * Update scheduled report
   */
  async updateScheduledReport(reportId: string, updates: Partial<ReportScheduleConfig>): Promise<void> {
    try {
      const existingReport = await prisma.scheduledReport.findUnique({
        where: { id: reportId }
      });

      if (!existingReport) {
        throw new Error('Заказани извештај не постоји');
      }

      // Stop existing job
      this.stopScheduledJob(reportId);

      // Prepare update data
      const updateData: any = {};
      
      if (updates.name) updateData.name = updates.name;
      if (updates.recipients) updateData.recipients = JSON.stringify(updates.recipients);
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

      if (updates.scheduleOptions) {
        updateData.schedule = this.convertToCronExpression(updates.scheduleOptions);
        updateData.nextExecution = this.calculateNextExecution(updates.scheduleOptions);
      }

      // Update database
      const updatedReport = await prisma.scheduledReport.update({
        where: { id: reportId },
        data: updateData
      });

      // Reschedule if active
      if (updatedReport.isActive) {
        await this.scheduleReport(updatedReport);
      }

      console.log(`Ажуриран заказани извештај: ${reportId}`);
    } catch (error) {
      console.error('Грешка при ажурирању заказаног извештаја:', error);
      throw error;
    }
  }

  /**
   * Delete scheduled report
   */
  async deleteScheduledReport(reportId: string): Promise<void> {
    try {
      // Stop the job
      this.stopScheduledJob(reportId);

      // Delete from database
      await prisma.scheduledReport.delete({
        where: { id: reportId }
      });

      console.log(`Обрисан заказани извештај: ${reportId}`);
    } catch (error) {
      console.error('Грешка при брисању заказаног извештаја:', error);
      throw error;
    }
  }

  /**
   * Execute report manually
   */
  async executeReportNow(reportId: string): Promise<ScheduledReportExecution> {
    try {
      const report = await prisma.scheduledReport.findUnique({
        where: { id: reportId },
        include: { template: true }
      });

      if (!report) {
        throw new Error('Заказани извештај не постоји');
      }

      return await this.executeReport(report);
    } catch (error) {
      console.error('Грешка при мануелном извршавању извештаја:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled reports
   */
  async getScheduledReports(userId?: string): Promise<ScheduledReport[]> {
    try {
      const where = userId ? { createdBy: userId } : {};
      
      return await prisma.scheduledReport.findMany({
        where,
        include: {
          template: true,
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('Грешка при добијању заказаних извештаја:', error);
      throw error;
    }
  }

  /**
   * Get report execution history
   */
  async getExecutionHistory(reportId: string, limit: number = 10): Promise<any[]> {
    try {
      // In a real implementation, this would query an execution log table
      // For now, we'll return mock data based on the report's execution count
      const report = await prisma.scheduledReport.findUnique({
        where: { id: reportId }
      });

      if (!report) {
        throw new Error('Заказани извештај не постоји');
      }

      // Generate mock execution history
      const history = [];
      const count = Math.min(report.executionCount, limit);
      
      for (let i = 0; i < count; i++) {
        const executionDate = addDays(new Date(), -(i + 1));
        history.push({
          id: `exec-${reportId}-${i}`,
          executedAt: executionDate,
          status: i === 0 && report.lastStatus ? report.lastStatus : 'success',
          duration: 2000 + Math.floor(Math.random() * 5000), // 2-7 seconds
          emailsSent: JSON.parse(report.recipients).length,
          error: i === 0 && report.lastError ? report.lastError : null
        });
      }

      return history;
    } catch (error) {
      console.error('Грешка при добијању историје извршавања:', error);
      throw error;
    }
  }

  /**
   * Schedule a report job
   */
  private async scheduleReport(report: ScheduledReport): Promise<void> {
    try {
      const task = cron.schedule(report.schedule, async () => {
        await this.executeReport(report);
      }, {
        scheduled: false,
        timezone: 'Europe/Belgrade'
      });

      task.start();
      this.activeJobs.set(report.id, task);
      
      console.log(`Заказан извештај: ${report.name} са расповедом: ${report.schedule}`);
    } catch (error) {
      console.error(`Грешка при заказивању извештаја ${report.id}:`, error);
    }
  }

  /**
   * Execute a scheduled report
   */
  private async executeReport(report: ScheduledReport): Promise<ScheduledReportExecution> {
    const executionId = `exec-${report.id}-${Date.now()}`;
    const execution: ScheduledReportExecution = {
      reportId: report.id,
      executionId,
      status: 'running',
      startTime: new Date()
    };

    this.executionQueue.set(executionId, execution);

    try {
      console.log(`Покретање извештаја: ${report.name} (ID: ${report.id})`);
      
      // Get template
      const template = await reportTemplateService.getTemplateById(report.templateId);
      if (!template) {
        throw new Error('Template не постоји');
      }

      // Generate report data based on template
      const reportData = await this.generateReportData(template);

      // Generate report file (PDF/HTML)
      const reportFile = await this.generateReportFile(template, reportData);

      // Send emails to recipients
      const recipients = JSON.parse(report.recipients);
      await this.sendReportEmails(report, template, reportFile, recipients);

      // Update execution status
      execution.status = 'success';
      execution.endTime = new Date();
      execution.generatedFileUrl = reportFile.url;
      execution.emailsSent = recipients.length;

      // Update database
      await prisma.scheduledReport.update({
        where: { id: report.id },
        data: {
          lastExecuted: execution.startTime,
          nextExecution: this.calculateNextExecution({ 
            frequency: 'custom', 
            customCron: report.schedule 
          }),
          executionCount: { increment: 1 },
          lastStatus: 'success',
          lastError: null
        }
      });

      console.log(`Извештај успешно извршен: ${report.name}`);
      
    } catch (error) {
      console.error(`Грешка при извршавању извештаја ${report.id}:`, error);
      
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error.message : 'Непозната грешка';

      // Update database with error
      await prisma.scheduledReport.update({
        where: { id: report.id },
        data: {
          lastExecuted: execution.startTime,
          executionCount: { increment: 1 },
          lastStatus: 'failed',
          lastError: execution.error
        }
      });
    } finally {
      this.executionQueue.delete(executionId);
    }

    return execution;
  }

  /**
   * Generate report data based on template
   */
  private async generateReportData(template: any): Promise<any> {
    try {
      const queryDef = template.queryDefinition;
      
      // Build analytics query based on template configuration
      const analyticsQuery = {
        startDate: this.parseDateRange(queryDef.dateRange).startDate,
        endDate: this.parseDateRange(queryDef.dateRange).endDate,
        categoryIds: queryDef.filters?.find((f: any) => f.field === 'category')?.value,
        userIds: queryDef.filters?.find((f: any) => f.field === 'user')?.value,
        priorities: queryDef.filters?.find((f: any) => f.field === 'priority')?.value,
        statuses: queryDef.filters?.find((f: any) => f.field === 'status')?.value
      };

      // Get appropriate analytics data based on template category
      let reportData = {};
      
      switch (template.category) {
        case 'ticket':
          reportData = await analyticsService.getTicketMetrics(analyticsQuery);
          break;
        case 'sla':
          reportData = await analyticsService.getSlaMetrics(analyticsQuery);
          break;
        case 'user':
          reportData = await analyticsService.getUserPerformanceMetrics(analyticsQuery);
          break;
        case 'system':
          reportData = await analyticsService.getSystemUsageMetrics(analyticsQuery);
          break;
        default:
          throw new Error(`Непознат тип template-a: ${template.category}`);
      }

      return {
        template,
        data: reportData,
        generatedAt: new Date(),
        dateRange: this.parseDateRange(queryDef.dateRange)
      };
    } catch (error) {
      console.error('Грешка при генерисању података извештаја:', error);
      throw error;
    }
  }

  /**
   * Generate report file (placeholder - would integrate with PDF/Excel generation)
   */
  private async generateReportFile(template: any, reportData: any): Promise<{ url: string; filename: string }> {
    try {
      // This would integrate with actual PDF/Excel generation
      // For now, return mock file reference
      const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
      const filename = `izvesaj-${template.id}-${timestamp}.pdf`;
      const url = `/reports/generated/${filename}`;

      console.log(`Генерисан извештај фајл: ${filename}`);
      
      return { url, filename };
    } catch (error) {
      console.error('Грешка при генерисању фајла извештаја:', error);
      throw error;
    }
  }

  /**
   * Send report emails to recipients
   */
  private async sendReportEmails(
    report: ScheduledReport, 
    template: any, 
    reportFile: { url: string; filename: string }, 
    recipients: string[]
  ): Promise<void> {
    try {
      for (const recipient of recipients) {
        await emailService.sendScheduledReport({
          to: recipient,
          reportName: report.name,
          templateName: template.name,
          generatedAt: new Date(),
          attachmentUrl: reportFile.url,
          attachmentName: reportFile.filename
        });
      }
      
      console.log(`Послат извештај на ${recipients.length} адреса`);
    } catch (error) {
      console.error('Грешка при слању email-ова извештаја:', error);
      throw error;
    }
  }

  /**
   * Stop scheduled job
   */
  private stopScheduledJob(reportId: string): void {
    const job = this.activeJobs.get(reportId);
    if (job) {
      job.stop();
      this.activeJobs.delete(reportId);
      console.log(`Заустављен заказани посао: ${reportId}`);
    }
  }

  /**
   * Convert schedule options to cron expression
   */
  private convertToCronExpression(options: ScheduleOptions): string {
    const [hour, minute] = options.time.split(':').map(Number);

    switch (options.frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      
      case 'weekly':
        const dayOfWeek = options.dayOfWeek || 1; // Default to Monday
        return `${minute} ${hour} * * ${dayOfWeek}`;
      
      case 'monthly':
        const dayOfMonth = options.dayOfMonth || 1; // Default to 1st
        return `${minute} ${hour} ${dayOfMonth} * *`;
      
      case 'custom':
        return options.customCron || '0 9 * * *'; // Default to 9 AM daily
      
      default:
        throw new Error(`Непознат тип расповеда: ${options.frequency}`);
    }
  }

  /**
   * Calculate next execution time
   */
  private calculateNextExecution(options: ScheduleOptions): Date {
    const now = new Date();
    const [hour, minute] = options.time.split(':').map(Number);

    switch (options.frequency) {
      case 'daily':
        const dailyNext = new Date(now);
        dailyNext.setHours(hour, minute, 0, 0);
        if (dailyNext <= now) {
          dailyNext.setDate(dailyNext.getDate() + 1);
        }
        return dailyNext;

      case 'weekly':
        const weeklyNext = addWeeks(now, 1);
        weeklyNext.setHours(hour, minute, 0, 0);
        return weeklyNext;

      case 'monthly':
        const monthlyNext = addMonths(now, 1);
        monthlyNext.setHours(hour, minute, 0, 0);
        return monthlyNext;

      default:
        return addDays(now, 1); // Default to tomorrow
    }
  }

  /**
   * Parse date range string
   */
  private parseDateRange(dateRange: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    
    switch (dateRange) {
      case 'today':
        return {
          startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        };
      
      case 'yesterday':
        const yesterday = addDays(now, -1);
        return {
          startDate: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
          endDate: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
        };
      
      case 'last7days':
        return {
          startDate: addDays(now, -7),
          endDate: now
        };
      
      case 'last30days':
        return {
          startDate: addDays(now, -30),
          endDate: now
        };
      
      case 'last90days':
        return {
          startDate: addDays(now, -90),
          endDate: now
        };
      
      default:
        return {
          startDate: addDays(now, -30),
          endDate: now
        };
    }
  }

  /**
   * Get service status
   */
  getServiceStatus() {
    return {
      activeJobs: this.activeJobs.size,
      runningExecutions: this.executionQueue.size,
      jobs: Array.from(this.activeJobs.keys()),
      executions: Array.from(this.executionQueue.values()).map(e => ({
        id: e.executionId,
        reportId: e.reportId,
        status: e.status,
        startTime: e.startTime
      }))
    };
  }
}

export const reportSchedulingService = new ReportSchedulingService(); 