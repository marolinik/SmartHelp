import * as cron from 'node-cron';
import securityScanService, { ScanType } from './securityScanService';
import auditService, { AuditEventType, AuditSeverity } from './auditService';

/**
 * Сервис за аутоматизовано планирање безбедносних сканирања
 */
class SecurityScanScheduler {
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private isInitialized = false;

  /**
   * Иницијализује scheduler са подразумеваним job-овима
   */
  initialize(): void {
    if (this.isInitialized) {
      console.warn('⚠️ SecurityScanScheduler је већ иницијализован');
      return;
    }

    const config = securityScanService.getConfiguration();
    
    if (!config.enabled) {
      console.log('📅 Security scan scheduler је онемогућен у конфигурацији');
      return;
    }

    try {
      // Планирај dependency scan
      this.scheduleJob('dependency', config.schedule.dependency, async () => {
        await this.runScheduledScan('dependency', ScanType.DEPENDENCY_SCAN);
      });

      // Планирај code scan
      this.scheduleJob('code', config.schedule.code, async () => {
        await this.runScheduledScan('code', ScanType.CODE_SECURITY_SCAN);
      });

      // Планирај configuration scan
      this.scheduleJob('configuration', config.schedule.configuration, async () => {
        await this.runScheduledScan('configuration', ScanType.CONFIGURATION_SCAN);
      });

      // Планирај comprehensive scan
      this.scheduleJob('comprehensive', config.schedule.comprehensive, async () => {
        await this.runScheduledScan('comprehensive', ScanType.COMPREHENSIVE_SCAN);
      });

      this.isInitialized = true;
      console.log('✅ SecurityScanScheduler успешно иницијализован');
      
      // Логуј иницијализацију у audit систем
      auditService.log(
        AuditEventType.SYSTEM_START,
        AuditSeverity.LOW,
        'Security scan scheduler је покренут и планирани задаци су активни',
        { metadata: { scheduledJobs: Array.from(this.scheduledJobs.keys()) } }
      );

    } catch (error) {
      console.error('❌ Грешка при иницијализацији SecurityScanScheduler-а:', error);
      throw error;
    }
  }

  /**
   * Планира појединачни job
   */
  private scheduleJob(name: string, cronExpression: string, task: () => Promise<void>): void {
    try {
      // Валидирај cron израз
      if (!cron.validate(cronExpression)) {
        throw new Error(`Неважећи cron израз за ${name}: ${cronExpression}`);
      }

      // Заустави постојећи job ако постоји
      if (this.scheduledJobs.has(name)) {
        this.scheduledJobs.get(name)?.destroy();
      }

      // Креирај нови job
      const scheduledTask = cron.schedule(cronExpression, async () => {
        console.log(`📅 Покретање планираног ${name} сканирања...`);
        try {
          await task();
        } catch (error) {
          console.error(`❌ Грешка при извршавању планираног ${name} сканирања:`, error);
        }
      }, {
        timezone: 'Europe/Belgrade' // Српска временска зона
      });

      this.scheduledJobs.set(name, scheduledTask);
      console.log(`📅 Планиран ${name} scan: ${cronExpression}`);

    } catch (error) {
      console.error(`❌ Грешка при планирању ${name} job-а:`, error);
      throw error;
    }
  }

  /**
   * Извршава планирано сканирање
   */
  private async runScheduledScan(scanName: string, scanType: ScanType): Promise<void> {
    try {
      // Провери да ли је неко друго сканирање већ у току
      const activeScan = securityScanService.getActiveScan();
      if (activeScan) {
        console.log(`⏳ Планирано ${scanName} сканирање пропуштено - друго сканирање је у току`);
        
        // Логуј пропуштено сканирање
        await auditService.log(
          AuditEventType.SYSTEM_CONFIG_CHANGE,
          AuditSeverity.LOW,
          `Планирано ${scanName} сканирање је пропуштено због активног сканирања`,
          { metadata: { skippedScan: scanName, activeScan: activeScan.type } }
        );
        
        return;
      }

      console.log(`🔍 Покретање аутоматског ${scanName} сканирања...`);

      let result;
      switch (scanType) {
        case ScanType.DEPENDENCY_SCAN:
          result = await securityScanService.scanDependencies();
          break;
        case ScanType.CODE_SECURITY_SCAN:
          result = await securityScanService.scanCode();
          break;
        case ScanType.CONFIGURATION_SCAN:
          result = await securityScanService.scanConfiguration();
          break;
        case ScanType.COMPREHENSIVE_SCAN:
          result = await securityScanService.performComprehensiveScan();
          break;
        default:
          throw new Error(`Непознат тип сканирања: ${scanType}`);
      }

      const severity = result.summary.critical > 0 ? AuditSeverity.CRITICAL : 
                      result.summary.high > 0 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM;

      // Логуј резултате сканирања
      await auditService.log(
        AuditEventType.SYSTEM_CONFIG_CHANGE,
        severity,
        `Аутоматско ${scanName} сканирање завршено - укупно ${result.summary.total} проблема`,
        { 
          metadata: { 
            scanId: result.id,
            scanType: result.type,
            summary: result.summary,
            duration: result.duration,
            scheduled: true
          } 
        }
      );

      console.log(`✅ Аутоматско ${scanName} сканирање завршено: ${result.summary.total} проблема пронађено`);

    } catch (error) {
      console.error(`❌ Грешка при аутоматском ${scanName} сканирању:`, error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Логуј грешку
      await auditService.log(
        AuditEventType.ERROR_OCCURRED,
        AuditSeverity.HIGH,
        `Грешка при аутоматском ${scanName} сканирању: ${errorMessage}`,
        { metadata: { scanName, scanType, error: errorMessage, scheduled: true } }
      );
    }
  }

  /**
   * Ажурира планиране job-ове на основу нове конфигурације
   */
  updateSchedule(): void {
    if (!this.isInitialized) {
      console.warn('⚠️ SecurityScanScheduler није иницијализован');
      return;
    }

    console.log('🔄 Ажурирање планираних сканирања...');
    
    // Заустави све постојеће job-ове
    this.stopAll();
    
    // Поново иницијализуј са новом конфигурацијом
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Мануално покреће сканирање (ван планираног времена)
   */
  async runManualScan(scanType: ScanType): Promise<void> {
    const scanName = this.getScanTypeName(scanType);
    console.log(`🔍 Мануално покретање ${scanName} сканирања...`);
    
    await this.runScheduledScan(scanName, scanType);
  }

  /**
   * Заустаља све планиране job-ове
   */
  stopAll(): void {
    console.log('🛑 Заустављање свих планираних сканирања...');
    
    for (const [name, job] of this.scheduledJobs) {
      job.destroy();
      console.log(`🛑 Заустављен ${name} scan job`);
    }
    
    this.scheduledJobs.clear();
    
    // Логуј заустављање
    auditService.log(
      AuditEventType.SYSTEM_SHUTDOWN,
      AuditSeverity.LOW,
      'Сви планирани безбедносни scan job-ови су заустављени',
      { metadata: { stoppedJobs: Array.from(this.scheduledJobs.keys()) } }
    );
  }

  /**
   * Добија статус свих планираних job-ова
   */
  getScheduleStatus(): Record<string, any> {
    const config = securityScanService.getConfiguration();
    const stats = securityScanService.getScanStatistics();
    
    return {
      enabled: config.enabled,
      initialized: this.isInitialized,
      activeJobs: Array.from(this.scheduledJobs.keys()),
      schedule: config.schedule,
      lastScans: {
        totalScans: stats.totalScans,
        lastScan: stats.lastScan,
        totalVulnerabilities: stats.totalVulnerabilities
      }
    };
  }

  /**
   * Добија следеће планирано време извршавања
   */
  getNextScheduledTimes(): Record<string, string | null> {
    const config = securityScanService.getConfiguration();
    const nextTimes: Record<string, string | null> = {};
    
    for (const [scanType, cronExpr] of Object.entries(config.schedule)) {
      try {
        // Израчунај следеће време извршавања
        const nextDate = this.getNextCronDate(cronExpr);
        nextTimes[scanType] = nextDate ? nextDate.toISOString() : null;
      } catch (error) {
        nextTimes[scanType] = null;
      }
    }
    
    return nextTimes;
  }

  /**
   * Помоћне функције
   */

  private getScanTypeName(scanType: ScanType): string {
    const names: Record<ScanType, string> = {
      [ScanType.DEPENDENCY_SCAN]: 'dependency',
      [ScanType.CODE_SECURITY_SCAN]: 'code',
      [ScanType.CONFIGURATION_SCAN]: 'configuration',
      [ScanType.COMPREHENSIVE_SCAN]: 'comprehensive',
      [ScanType.INFRASTRUCTURE_SCAN]: 'infrastructure',
      [ScanType.PORT_SCAN]: 'port',
      [ScanType.SSL_SCAN]: 'ssl'
    };
    
    return names[scanType] || 'unknown';
  }

  private getNextCronDate(cronExpression: string): Date | null {
    try {
      // Једноставна имплементација - у стварности би требало користити cron parser
      // За сада враћамо приближно време на основу cron израза
      const now = new Date();
      const parts = cronExpression.split(' ');
      
      if (parts.length >= 5) {
        const minuteStr = parts[0];
        const hourStr = parts[1];
        
        if (!minuteStr || !hourStr) {
          return null;
        }
        
        const minute = minuteStr !== '*' ? parseInt(minuteStr) || 0 : 0;
        const hour = hourStr !== '*' ? parseInt(hourStr) || 0 : 0;
        
        const nextRun = new Date(now);
        nextRun.setHours(hour, minute, 0, 0);
        
        // Ако је време прошло данас, додај један дан
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        
        return nextRun;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}

// Експортуј singleton инстанцу
export const securityScanScheduler = new SecurityScanScheduler();
export default securityScanScheduler; 