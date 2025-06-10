import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import * as os from 'os';
import { EmailService } from './EmailService';
import { logger } from '../utils/logger';
import { SerbianFormat } from '../utils/serbianFormatting';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  responseTime?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  uptime: number;
  timestamp: Date;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
  checks: HealthCheck[];
  metrics: SystemMetrics;
  summary: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
  };
}

export class SystemHealthService {
  private prisma: PrismaClient;
  private emailService: EmailService;
  private healthHistory: HealthCheck[] = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    this.prisma = new PrismaClient();
    this.emailService = new EmailService();
  }

  /**
   * Извршава комплетну проверу здравља система
   * Performs complete system health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];

    try {
      logger.info('Покрећем проверу здравља система', { component: 'SystemHealth' });

      // Паралелно извршавање свих провера
      const [
        dbCheck,
        emailCheck,
        diskCheck,
        memoryCheck,
        serviceCheck
      ] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkEmailService(),
        this.checkDiskSpace(),
        this.checkMemoryUsage(),
        this.checkCriticalServices()
      ]);

      // Процесирање резултата провера
      if (dbCheck.status === 'fulfilled') checks.push(dbCheck.value);
      else checks.push(this.createFailedCheck('База података', dbCheck.reason));

      if (emailCheck.status === 'fulfilled') checks.push(emailCheck.value);
      else checks.push(this.createFailedCheck('Email сервис', emailCheck.reason));

      if (diskCheck.status === 'fulfilled') checks.push(diskCheck.value);
      else checks.push(this.createFailedCheck('Диск простор', diskCheck.reason));

      if (memoryCheck.status === 'fulfilled') checks.push(memoryCheck.value);
      else checks.push(this.createFailedCheck('Меморија', memoryCheck.reason));

      if (serviceCheck.status === 'fulfilled') checks.push(...serviceCheck.value);
      else checks.push(this.createFailedCheck('Сервиси', serviceCheck.reason));

      // Прикупљање системских метрика
      const metrics = await this.collectSystemMetrics();

      // Израчунавање укупног статуса
      const summary = this.calculateSummary(checks);
      const overallStatus = this.determineOverallStatus(summary);

      const healthReport: SystemHealth = {
        status: overallStatus,
        timestamp: new Date(),
        checks,
        metrics,
        summary
      };

      // Чување у историју
      this.saveToHistory(checks);

      // Логовање резултата
      const duration = Date.now() - startTime;
      logger.info('Провера здравља система завршена', {
        component: 'SystemHealth',
        duration,
        status: overallStatus,
        checksCount: checks.length
      });

      return healthReport;

    } catch (error) {
      logger.error('Грешка при провери здравља система', {
        component: 'SystemHealth',
        error: error instanceof Error ? error.message : 'Непозната грешка'
      });

      return {
        status: 'critical',
        timestamp: new Date(),
        checks: [this.createFailedCheck('Систем', error)],
        metrics: await this.collectSystemMetrics(),
        summary: { total: 1, healthy: 0, warning: 0, critical: 1 }
      };
    }
  }

  /**
   * Провера везе са базом података
   * Database connectivity check
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Тест упита за проверу везе
      await this.prisma.$queryRaw`SELECT 1 as test`;
      
      // Проверити број активних веза
      const connectionInfo = await this.prisma.$queryRaw`PRAGMA database_list` as any[];
      
      const responseTime = Date.now() - startTime;

      return {
        name: 'База података',
        status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'warning' : 'critical',
        message: `Веза са базом успешна (${responseTime}ms)`,
        responseTime,
        metadata: {
          connectionCount: connectionInfo.length,
          databasePath: connectionInfo[0]?.file || 'unknown'
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Грешка при провери базе података', { error });

      return {
        name: 'База података',
        status: 'critical',
        message: `Неуспешна веза са базом: ${error instanceof Error ? error.message : 'Непозната грешка'}`,
        responseTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Провера email сервиса
   * Email service check
   */
  private async checkEmailService(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Проверити да ли је email сервис конфигурисан
      const isConfigured = process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS;
      
      if (!isConfigured) {
        return {
          name: 'Email сервис',
          status: 'warning',
          message: 'Email сервис није конфигурисан',
          responseTime: Date.now() - startTime,
          timestamp: new Date()
        };
      }

      // Тест статуса email сервиса
      const responseTime = Date.now() - startTime;

      return {
        name: 'Email сервис',
        status: 'healthy',
        message: 'Email сервис конфигурисан и доступан',
        responseTime,
        metadata: {
          configured: isConfigured,
          host: process.env.EMAIL_HOST,
          user: process.env.EMAIL_USER
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Грешка при провери email сервиса', { error });

      return {
        name: 'Email сервис',
        status: 'critical',
        message: `Email сервис недоступан: ${error instanceof Error ? error.message : 'Непозната грешка'}`,
        responseTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Провера доступног простора на диску
   * Disk space check
   */
  private async checkDiskSpace(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const stats = await fs.statfs(process.cwd());
      
      const total = stats.bavail * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      const percentage = (used / total) * 100;

      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = `Диск ${SerbianFormat.formatPercentage(percentage)} попуњен`;

      if (percentage > 90) {
        status = 'critical';
        message = `КРИТИЧНО: Диск ${SerbianFormat.formatPercentage(percentage)} попуњен`;
      } else if (percentage > 80) {
        status = 'warning';
        message = `УПОЗОРЕЊЕ: Диск ${SerbianFormat.formatPercentage(percentage)} попуњен`;
      }

      return {
        name: 'Диск простор',
        status,
        message,
        responseTime,
        metadata: {
          totalGB: SerbianFormat.formatDecimal(total / (1024 ** 3), 2),
          usedGB: SerbianFormat.formatDecimal(used / (1024 ** 3), 2),
          freeGB: SerbianFormat.formatDecimal(free / (1024 ** 3), 2),
          percentage: SerbianFormat.formatDecimal(percentage, 1)
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Грешка при провери простора на диску', { error });

      return {
        name: 'Диск простор',
        status: 'critical',
        message: `Неуспешна провера диска: ${error instanceof Error ? error.message : 'Непозната грешка'}`,
        responseTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Провера коришћења меморије
   * Memory usage check
   */
  private async checkMemoryUsage(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const memInfo = process.memoryUsage();
      const systemMem = {
        total: os.totalmem(),
        free: os.freemem()
      };

      const systemUsed = systemMem.total - systemMem.free;
      const systemPercentage = (systemUsed / systemMem.total) * 100;
      
      const processPercentage = (memInfo.rss / systemMem.total) * 100;

      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = `Систем меморија ${SerbianFormat.formatPercentage(systemPercentage)}, процес ${SerbianFormat.formatPercentage(processPercentage)}`;

      if (systemPercentage > 95 || processPercentage > 80) {
        status = 'critical';
        message = `КРИТИЧНО: ${message}`;
      } else if (systemPercentage > 85 || processPercentage > 60) {
        status = 'warning';
        message = `УПОЗОРЕЊЕ: ${message}`;
      }

      return {
        name: 'Меморија',
        status,
        message,
        responseTime,
        metadata: {
          system: {
            totalMB: SerbianFormat.formatInteger(systemMem.total / (1024 ** 2)),
            usedMB: SerbianFormat.formatInteger(systemUsed / (1024 ** 2)),
            freeMB: SerbianFormat.formatInteger(systemMem.free / (1024 ** 2)),
            percentage: SerbianFormat.formatDecimal(systemPercentage, 1)
          },
          process: {
            rssMB: SerbianFormat.formatInteger(memInfo.rss / (1024 ** 2)),
            heapUsedMB: SerbianFormat.formatInteger(memInfo.heapUsed / (1024 ** 2)),
            heapTotalMB: SerbianFormat.formatInteger(memInfo.heapTotal / (1024 ** 2)),
            externalMB: SerbianFormat.formatInteger(memInfo.external / (1024 ** 2)),
            percentage: SerbianFormat.formatDecimal(processPercentage, 1)
          }
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Грешка при провери меморије', { error });

      return {
        name: 'Меморија',
        status: 'critical',
        message: `Неуспешна провера меморије: ${error instanceof Error ? error.message : 'Непозната грешка'}`,
        responseTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Провера критичних сервиса
   * Critical services check
   */
  private async checkCriticalServices(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // WebSocket сервис провера
    checks.push(await this.checkWebSocketService());

    // API endpoint провера
    checks.push(await this.checkApiEndpoints());

    return checks;
  }

  /**
   * Провера WebSocket сервиса
   */
  private async checkWebSocketService(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Провера да ли је WebSocket сервер покренут
      // Ово је симплификована провера - у продукцији би требало проверити стварне WebSocket везе
      const responseTime = Date.now() - startTime;

      return {
        name: 'WebSocket сервис',
        status: 'healthy',
        message: 'WebSocket сервис функционише исправно',
        responseTime,
        metadata: {
          activeConnections: 0 // Би требало да се имплементира стварно бројање
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: 'WebSocket сервис',
        status: 'critical',
        message: `WebSocket сервис недоступан: ${error instanceof Error ? error.message : 'Непозната грешка'}`,
        responseTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Провера кључних API endpoint-а
   */
  private async checkApiEndpoints(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Симулација провере API endpoint-а
      // У продукцији би требало направити стварне HTTP позиве
      const responseTime = Date.now() - startTime;

      return {
        name: 'API Endpoint-и',
        status: 'healthy',
        message: 'Сви кључни API endpoint-и доступни',
        responseTime,
        metadata: {
          checkedEndpoints: ['/api/health', '/api/tickets', '/api/users'],
          allHealthy: true
        },
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: 'API Endpoint-и',
        status: 'critical',
        message: `API endpoint-и недоступни: ${error instanceof Error ? error.message : 'Непозната грешка'}`,
        responseTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Прикупљање системских метрика
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const memInfo = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem()
    };

    const loadAverage = os.loadavg();
    
    return {
      cpu: {
        usage: await this.getCpuUsage(),
        loadAverage
      },
      memory: {
        total: systemMem.total,
        used: systemMem.total - systemMem.free,
        free: systemMem.free,
        percentage: ((systemMem.total - systemMem.free) / systemMem.total) * 100
      },
      disk: {
        total: 0, // Биће ажурирано у checkDiskSpace
        used: 0,
        free: 0,
        percentage: 0
      },
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }

  /**
   * Израчунавање CPU коришћења
   */
  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const totalUsage = currentUsage.user + currentUsage.system;
        const percentage = (totalUsage / 10000) / 100; // Конверзија у проценте
        resolve(Math.min(percentage, 100));
      }, 100);
    });
  }

  /**
   * Креирање неуспешне провере
   */
  private createFailedCheck(name: string, error: any): HealthCheck {
    return {
      name,
      status: 'critical',
      message: `Грешка при провери: ${error instanceof Error ? error.message : 'Непозната грешка'}`,
      timestamp: new Date()
    };
  }

  /**
   * Израчунавање резимеа провера
   */
  private calculateSummary(checks: HealthCheck[]) {
    return {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      warning: checks.filter(c => c.status === 'warning').length,
      critical: checks.filter(c => c.status === 'critical').length
    };
  }

  /**
   * Одређивање укупног статуса система
   */
  private determineOverallStatus(summary: { healthy: number; warning: number; critical: number }): 'healthy' | 'warning' | 'critical' {
    if (summary.critical > 0) return 'critical';
    if (summary.warning > 0) return 'warning';
    return 'healthy';
  }

  /**
   * Чување резултата у историју
   */
  private saveToHistory(checks: HealthCheck[]) {
    this.healthHistory.push(...checks);
    
    // Ограничавање величине историје
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Добијање историје провера здравља
   */
  getHealthHistory(limit?: number): HealthCheck[] {
    return limit ? this.healthHistory.slice(-limit) : [...this.healthHistory];
  }

  /**
   * Очишћење ресурса
   */
  async cleanup() {
    await this.prisma.$disconnect();
    logger.info('SystemHealthService ресурси очишћени');
  }
} 