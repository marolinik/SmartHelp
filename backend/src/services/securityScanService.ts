import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import auditService, { AuditEventType, AuditSeverity } from './auditService';

const execAsync = promisify(exec);

/**
 * Типови безбедносних сканирања
 */
export enum ScanType {
  DEPENDENCY_SCAN = 'DEPENDENCY_SCAN',
  CODE_SECURITY_SCAN = 'CODE_SECURITY_SCAN',
  CONFIGURATION_SCAN = 'CONFIGURATION_SCAN',
  INFRASTRUCTURE_SCAN = 'INFRASTRUCTURE_SCAN',
  PORT_SCAN = 'PORT_SCAN',
  SSL_SCAN = 'SSL_SCAN',
  COMPREHENSIVE_SCAN = 'COMPREHENSIVE_SCAN'
}

/**
 * Нивои озбиљности рањивости
 */
export enum VulnerabilitySeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Статуси сканирања
 */
export enum ScanStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Интерфејс за рањивост
 */
export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: VulnerabilitySeverity;
  
  // Локација рањивости
  component: string;
  version?: string;
  file?: string;
  line?: number;
  
  // Детаљи о рањивости
  cve?: string;
  cvss?: number;
  references?: string[];
  
  // Препоруке за исправку
  recommendation: string;
  fixAvailable: boolean;
  fixVersion?: string;
  
  // Метаподаци
  detectedAt: Date;
  scanType: ScanType;
  confirmed: boolean;
}

/**
 * Резултат сканирања
 */
export interface ScanResult {
  id: string;
  type: ScanType;
  status: ScanStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number; // у секундама
  
  // Резултати
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
  };
  
  // Статистике
  scannedFiles?: number;
  scannedDependencies?: number;
  
  // Метаподаци
  scannerVersion: string;
  environment: string;
  reportPath?: string;
}

/**
 * Конфигурација за сканирање
 */
interface SecurityScanConfig {
  enabled: boolean;
  schedule: {
    dependency: string; // cron format
    code: string;
    configuration: string;
    comprehensive: string;
  };
  thresholds: {
    maxCritical: number;
    maxHigh: number;
    maxTotal: number;
  };
  reporting: {
    generateReports: boolean;
    emailAlerts: boolean;
    slackNotifications: boolean;
  };
  exclusions: {
    files: string[];
    directories: string[];
    vulnerabilities: string[];
  };
}

/**
 * Сервис за аутоматизоване безбедносне сканирање
 */
class SecurityScanService {
  private config: SecurityScanConfig;
  private configPath: string;
  private scanResults: ScanResult[];
  private activeScan: ScanResult | null;
  private maxResultsInMemory: number;
  private readonly scanDescriptions: Record<ScanType, string>;
  private readonly vulnerabilityDescriptions: Record<VulnerabilitySeverity, string>;

  constructor() {
    this.scanResults = [];
    this.activeScan = null;
    this.maxResultsInMemory = 100;
    this.configPath = path.join(process.cwd(), 'config', 'security-scan-config.json');
    
    // Иницијализуј са подразумеваном конфигурацијом прво
    this.config = this.getDefaultConfiguration();
    
    // Затим учитај конфигурацију
    this.loadConfiguration();
    
    // Српски описи типова сканирања
    this.scanDescriptions = {
      [ScanType.DEPENDENCY_SCAN]: 'Сканирање зависности за познате рањивости',
      [ScanType.CODE_SECURITY_SCAN]: 'Анализа кода за безбедносне проблеме',
      [ScanType.CONFIGURATION_SCAN]: 'Провера безбедносних конфигурација',
      [ScanType.INFRASTRUCTURE_SCAN]: 'Сканирање инфраструктуре и сервиса',
      [ScanType.PORT_SCAN]: 'Сканирање отворених портова',
      [ScanType.SSL_SCAN]: 'Анализа SSL/TLS конфигурације',
      [ScanType.COMPREHENSIVE_SCAN]: 'Комплетно безбедносно сканирање'
    };
    
    // Српски описи нивоа рањивости
    this.vulnerabilityDescriptions = {
      [VulnerabilitySeverity.INFO]: 'Информативно - препорука за побољшање',
      [VulnerabilitySeverity.LOW]: 'Низак ризик - мања безбедносна грешка',
      [VulnerabilitySeverity.MODERATE]: 'Умерен ризик - треба адресирати',
      [VulnerabilitySeverity.HIGH]: 'Висок ризик - хитно исправити',
      [VulnerabilitySeverity.CRITICAL]: 'Критичан ризик - најхитније исправити'
    };
  }

  /**
   * Учитава конфигурацију за сканирање
   */
  private loadConfiguration(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.config = this.mergeWithDefaults(config);
      } else {
        this.config = this.getDefaultConfiguration();
        this.saveConfiguration();
      }
      
      console.log('✅ Security scan конфигурација учитана');
    } catch (error) {
      console.error('❌ Грешка при учитавању scan конфигурације:', error);
      this.config = this.getDefaultConfiguration();
    }
  }

  /**
   * Враћа подразумевану конфигурацију
   */
  private getDefaultConfiguration(): SecurityScanConfig {
    return {
      enabled: true,
      schedule: {
        dependency: '0 2 * * *', // Свакодневно у 2:00
        code: '0 3 * * 0',       // Недељно у недељу у 3:00
        configuration: '0 4 * * 1', // Недељно у понедељак у 4:00
        comprehensive: '0 1 * * 0'  // Недељно у недељу у 1:00
      },
      thresholds: {
        maxCritical: 0,
        maxHigh: 5,
        maxTotal: 50
      },
      reporting: {
        generateReports: true,
        emailAlerts: true,
        slackNotifications: false
      },
      exclusions: {
        files: ['*.test.js', '*.test.ts', 'node_modules/**'],
        directories: ['node_modules', 'dist', 'build', '.git'],
        vulnerabilities: []
      }
    };
  }

  /**
   * Спаја учитану конфигурацију са подразумеваном
   */
  private mergeWithDefaults(config: any): SecurityScanConfig {
    const defaults = this.getDefaultConfiguration();
    return {
      ...defaults,
      ...config,
      schedule: { ...defaults.schedule, ...config.schedule },
      thresholds: { ...defaults.thresholds, ...config.thresholds },
      reporting: { ...defaults.reporting, ...config.reporting },
      exclusions: { ...defaults.exclusions, ...config.exclusions }
    };
  }

  /**
   * Чува конфигурацију у фајл
   */
  private saveConfiguration(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      console.log('💾 Security scan конфигурација сачувана');
    } catch (error) {
      console.error('❌ Грешка при чувању scan конфигурације:', error);
    }
  }

  /**
   * Покреће сканирање зависности
   */
  async scanDependencies(): Promise<ScanResult> {
    const scanResult = this.createScanResult(ScanType.DEPENDENCY_SCAN);
    this.activeScan = scanResult;
    
    try {
      console.log('🔍 Покрећем сканирање зависности...');
      
      // Покрени npm audit
      const { stdout, stderr } = await execAsync('npm audit --json', {
        cwd: process.cwd(),
        timeout: 300000 // 5 минута
      });
      
      const auditData = JSON.parse(stdout);
      const vulnerabilities: Vulnerability[] = [];
      
      // Парсирај резултате npm audit-а
      if (auditData.vulnerabilities) {
        for (const [name, vuln] of Object.entries(auditData.vulnerabilities as any)) {
          const vulnData = vuln as any; // Type assertion for npm audit data
          const severity = this.mapNpmSeverityToVulnerabilitySeverity(vulnData.severity);
          
          vulnerabilities.push({
            id: `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: `Рањивост у ${name}`,
            description: vulnData.via?.[0]?.title || `Безбедносна рањивост у пакету ${name}`,
            severity,
            component: name,
            version: vulnData.versions?.[0],
            cve: vulnData.via?.[0]?.cve,
            cvss: vulnData.via?.[0]?.cvss?.score,
            references: vulnData.via?.[0]?.url ? [vulnData.via[0].url] : [],
            recommendation: vulnData.fixAvailable 
              ? `Ажурирајте на верзију ${vulnData.fixAvailable.version || 'најновију'}`
              : 'Тренутно није доступно решење - пратите безбедносне саветe',
            fixAvailable: !!vulnData.fixAvailable,
            fixVersion: vulnData.fixAvailable?.version,
            detectedAt: new Date(),
            scanType: ScanType.DEPENDENCY_SCAN,
            confirmed: true
          });
        }
      }
      
      scanResult.vulnerabilities = vulnerabilities;
      scanResult.scannedDependencies = Object.keys(auditData.vulnerabilities || {}).length;
      
      this.completeScan(scanResult);
      
      // Логуј у audit систем
      await auditService.log(
        AuditEventType.SYSTEM_CONFIG_CHANGE,
        vulnerabilities.length > 0 ? AuditSeverity.HIGH : AuditSeverity.LOW,
        `Завршено сканирање зависности - пронађено ${vulnerabilities.length} рањивости`,
        { metadata: { scanId: scanResult.id, vulnerabilities: vulnerabilities.length } }
      );
      
      return scanResult;
      
    } catch (error) {
      console.error('❌ Грешка при сканирању зависности:', error);
      scanResult.status = ScanStatus.FAILED;
      this.completeScan(scanResult);
      throw error;
    }
  }

  /**
   * Покреће сканирање кода
   */
  async scanCode(): Promise<ScanResult> {
    const scanResult = this.createScanResult(ScanType.CODE_SECURITY_SCAN);
    this.activeScan = scanResult;
    
    try {
      console.log('🔍 Покрећем сканирање кода...');
      
      const vulnerabilities: Vulnerability[] = [];
      
      // Скенирај TypeScript/JavaScript фајлове
      const srcPath = path.join(process.cwd(), 'src');
      if (fs.existsSync(srcPath)) {
        const codeVulns = await this.scanCodeDirectory(srcPath);
        vulnerabilities.push(...codeVulns);
      }
      
      scanResult.vulnerabilities = vulnerabilities;
      scanResult.scannedFiles = await this.countSourceFiles(srcPath);
      
      this.completeScan(scanResult);
      
      // Логуј у audit систем
      await auditService.log(
        AuditEventType.SYSTEM_CONFIG_CHANGE,
        vulnerabilities.length > 0 ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
        `Завршено сканирање кода - пронађено ${vulnerabilities.length} потенцијалних проблема`,
        { metadata: { scanId: scanResult.id, vulnerabilities: vulnerabilities.length } }
      );
      
      return scanResult;
      
    } catch (error) {
      console.error('❌ Грешка при сканирању кода:', error);
      scanResult.status = ScanStatus.FAILED;
      this.completeScan(scanResult);
      throw error;
    }
  }

  /**
   * Покреће сканирање конфигурације
   */
  async scanConfiguration(): Promise<ScanResult> {
    const scanResult = this.createScanResult(ScanType.CONFIGURATION_SCAN);
    this.activeScan = scanResult;
    
    try {
      console.log('🔍 Покрећем сканирање конфигурације...');
      
      const vulnerabilities: Vulnerability[] = [];
      
      // Провери .env фајлове
      await this.checkEnvironmentFiles(vulnerabilities);
      
      // Провери package.json безбедност
      await this.checkPackageJsonSecurity(vulnerabilities);
      
      // Провери SSL конфигурацију
      await this.checkSSLConfiguration(vulnerabilities);
      
      // Провери database конфигурацију
      await this.checkDatabaseConfiguration(vulnerabilities);
      
      scanResult.vulnerabilities = vulnerabilities;
      
      this.completeScan(scanResult);
      
      // Логуј у audit систем
      await auditService.log(
        AuditEventType.SYSTEM_CONFIG_CHANGE,
        vulnerabilities.length > 0 ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
        `Завршено сканирање конфигурације - пронађено ${vulnerabilities.length} проблема`,
        { metadata: { scanId: scanResult.id, vulnerabilities: vulnerabilities.length } }
      );
      
      return scanResult;
      
    } catch (error) {
      console.error('❌ Грешка при сканирању конфигурације:', error);
      scanResult.status = ScanStatus.FAILED;
      this.completeScan(scanResult);
      throw error;
    }
  }

  /**
   * Покреће комплетно сканирање
   */
  async performComprehensiveScan(): Promise<ScanResult> {
    const scanResult = this.createScanResult(ScanType.COMPREHENSIVE_SCAN);
    this.activeScan = scanResult;
    
    try {
      console.log('🔍 Покрећем комплетно безбедносно сканирање...');
      
      const allVulnerabilities: Vulnerability[] = [];
      
      // Покрени све типове сканирања
      const depScan = await this.scanDependencies();
      allVulnerabilities.push(...depScan.vulnerabilities);
      
      const codeScan = await this.scanCode();
      allVulnerabilities.push(...codeScan.vulnerabilities);
      
      const configScan = await this.scanConfiguration();
      allVulnerabilities.push(...configScan.vulnerabilities);
      
      scanResult.vulnerabilities = allVulnerabilities;
      scanResult.scannedFiles = (codeScan.scannedFiles || 0);
      scanResult.scannedDependencies = (depScan.scannedDependencies || 0);
      
      this.completeScan(scanResult);
      
      // Генериши извештај
      if (this.config.reporting.generateReports) {
        await this.generateScanReport(scanResult);
      }
      
      // Провери праговe
      await this.checkThresholds(scanResult);
      
      // Логуј у audit систем
      await auditService.log(
        AuditEventType.SYSTEM_CONFIG_CHANGE,
        scanResult.summary.critical > 0 ? AuditSeverity.CRITICAL : AuditSeverity.MEDIUM,
        `Завршено комплетно сканирање - укупно ${allVulnerabilities.length} рањивости`,
        { metadata: { scanId: scanResult.id, summary: scanResult.summary } }
      );
      
      return scanResult;
      
    } catch (error) {
      console.error('❌ Грешка при комплетном сканирању:', error);
      scanResult.status = ScanStatus.FAILED;
      this.completeScan(scanResult);
      throw error;
    }
  }

  /**
   * Помоћне функције за сканирање
   */

  /**
   * Скенира директоријум за безбедносне проблеме у коду
   */
  private async scanCodeDirectory(dirPath: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    
    const scanPatterns = [
      {
        pattern: /password\s*[=:]\s*["'][^"']*["']/gi,
        severity: VulnerabilitySeverity.HIGH,
        title: 'Hardcoded лозинка у коду',
        description: 'Откривена је лозинка директно уписана у изворном коду'
      },
      {
        pattern: /api[_-]?key\s*[=:]\s*["'][^"']*["']/gi,
        severity: VulnerabilitySeverity.HIGH,
        title: 'Hardcoded API кључ',
        description: 'Откривен је API кључ директно уписан у изворном коду'
      },
      {
        pattern: /eval\s*\(/gi,
        severity: VulnerabilitySeverity.HIGH,
        title: 'Коришћење eval() функције',
        description: 'eval() функција може довести до Code Injection рањивости'
      },
      {
        pattern: /innerHTML\s*=/gi,
        severity: VulnerabilitySeverity.MODERATE,
        title: 'Потенцијални XSS преко innerHTML',
        description: 'Директно постављање innerHTML-а може довести до XSS напада'
      }
    ];
    
    const files = await this.getSourceFiles(dirPath);
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        for (const { pattern, severity, title, description } of scanPatterns) {
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              vulnerabilities.push({
                id: `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title,
                description,
                severity,
                component: path.basename(file),
                file: path.relative(process.cwd(), file),
                line: i + 1,
                recommendation: this.getCodeRecommendation(title),
                fixAvailable: true,
                detectedAt: new Date(),
                scanType: ScanType.CODE_SECURITY_SCAN,
                confirmed: false
              });
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ Грешка при читању фајла ${file}:`, error);
      }
    }
    
    return vulnerabilities;
  }

  /**
   * Проверава .env фајлове за безбедносне проблеме
   */
  private async checkEnvironmentFiles(vulnerabilities: Vulnerability[]): Promise<void> {
    const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];
    
    for (const envFile of envFiles) {
      const envPath = path.join(process.cwd(), envFile);
      if (fs.existsSync(envPath)) {
        try {
          const content = fs.readFileSync(envPath, 'utf8');
          
          // Провери да ли има празних вредности за критичне променљиве
          const criticalVars = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
          
          for (const varName of criticalVars) {
            const regex = new RegExp(`${varName}\\s*=\\s*$`, 'm');
            if (regex.test(content)) {
              vulnerabilities.push({
                id: `env_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: `Празна вредност за ${varName}`,
                description: `Критична променљива ${varName} нема подешену вредност`,
                severity: VulnerabilitySeverity.HIGH,
                component: envFile,
                file: envFile,
                recommendation: `Подесите безбедну вредност за ${varName}`,
                fixAvailable: true,
                detectedAt: new Date(),
                scanType: ScanType.CONFIGURATION_SCAN,
                confirmed: true
              });
            }
          }
          
        } catch (error) {
          console.error(`❌ Грешка при читању ${envFile}:`, error);
        }
      }
    }
  }

  /**
   * Проверава package.json за безбедносне проблеме
   */
  private async checkPackageJsonSecurity(vulnerabilities: Vulnerability[]): Promise<void> {
    const packagePath = path.join(process.cwd(), 'package.json');
    
    if (fs.existsSync(packagePath)) {
      try {
        const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Провери застареле Node.js верзију у engines
        if (packageData.engines?.node) {
          const nodeVersion = packageData.engines.node;
          // Провери да ли захтева стару верзију Node.js
          if (nodeVersion.includes('8.') || nodeVersion.includes('10.') || nodeVersion.includes('12.')) {
            vulnerabilities.push({
              id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              title: 'Застарела Node.js верзија',
              description: `Апликација захтева застарелу Node.js верзију: ${nodeVersion}`,
              severity: VulnerabilitySeverity.MODERATE,
              component: 'package.json',
              file: 'package.json',
              recommendation: 'Ажурирајте на Node.js 16 или новију верзију',
              fixAvailable: true,
              detectedAt: new Date(),
              scanType: ScanType.CONFIGURATION_SCAN,
              confirmed: true
            });
          }
        }
        
      } catch (error) {
        console.error('❌ Грешка при читању package.json:', error);
      }
    }
  }

  /**
   * Проверава SSL конфигурацију
   */
  private async checkSSLConfiguration(vulnerabilities: Vulnerability[]): Promise<void> {
    const sslDir = path.join(process.cwd(), 'ssl');
    
    if (fs.existsSync(sslDir)) {
      const sslFiles = fs.readdirSync(sslDir);
      
      for (const file of sslFiles) {
        if (file.endsWith('.key')) {
          const keyPath = path.join(sslDir, file);
          try {
            const stats = fs.statSync(keyPath);
            const permissions = (stats.mode & parseInt('777', 8)).toString(8);
            
            // Провери да ли је приватни кључ читљив за друге
            if (permissions !== '600' && permissions !== '400') {
              vulnerabilities.push({
                id: `ssl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: 'Небезбедне дозволе за SSL кључ',
                description: `SSL кључ ${file} има дозволе ${permissions} уместо 600`,
                severity: VulnerabilitySeverity.HIGH,
                component: file,
                file: path.join('ssl', file),
                recommendation: 'Променити дозволе на 600 (chmod 600)',
                fixAvailable: true,
                detectedAt: new Date(),
                scanType: ScanType.CONFIGURATION_SCAN,
                confirmed: true
              });
            }
          } catch (error) {
            console.error(`❌ Грешка при провери SSL фајла ${file}:`, error);
          }
        }
      }
    }
  }

  /**
   * Проверава database конфигурацију
   */
  private async checkDatabaseConfiguration(vulnerabilities: Vulnerability[]): Promise<void> {
    // Провери да ли постоји Prisma schema
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    
    if (fs.existsSync(schemaPath)) {
      try {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Провери да ли се користи localhost у production
        if (schema.includes('localhost') && process.env.NODE_ENV === 'production') {
          vulnerabilities.push({
            id: `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: 'Localhost у production database конфигурацији',
            description: 'Database конфигурација користи localhost у production окружењу',
            severity: VulnerabilitySeverity.MODERATE,
            component: 'schema.prisma',
            file: 'prisma/schema.prisma',
            recommendation: 'Користите environment променљиве за database connection',
            fixAvailable: true,
            detectedAt: new Date(),
            scanType: ScanType.CONFIGURATION_SCAN,
            confirmed: true
          });
        }
        
      } catch (error) {
        console.error('❌ Грешка при читању Prisma schema:', error);
      }
    }
  }

  /**
   * Генерише извештај о сканирању
   */
  private async generateScanReport(scanResult: ScanResult): Promise<void> {
    try {
      const reportsDir = path.join(process.cwd(), 'reports', 'security');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const reportPath = path.join(reportsDir, `security-scan-${scanResult.id}.json`);
      
      const report = {
        metadata: {
          scanId: scanResult.id,
          type: scanResult.type,
          generatedAt: new Date().toISOString(),
          duration: scanResult.duration,
          environment: scanResult.environment
        },
        summary: scanResult.summary,
        vulnerabilities: scanResult.vulnerabilities.map(vuln => ({
          ...vuln,
          severityDescription: this.vulnerabilityDescriptions[vuln.severity]
        })),
        recommendations: this.generateRecommendations(scanResult)
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      scanResult.reportPath = reportPath;
      console.log(`📄 Извештај сачуван: ${reportPath}`);
      
    } catch (error) {
      console.error('❌ Грешка при генерисању извештаја:', error);
    }
  }

  /**
   * Проверава прагове и шаље обавештења
   */
  private async checkThresholds(scanResult: ScanResult): Promise<void> {
    const { summary } = scanResult;
    const { thresholds } = this.config;
    
    const alerts: string[] = [];
    
    if (summary.critical > thresholds.maxCritical) {
      alerts.push(`🚨 Критично: ${summary.critical} критичних рањивости (дозвољено: ${thresholds.maxCritical})`);
    }
    
    if (summary.high > thresholds.maxHigh) {
      alerts.push(`⚠️  Високо: ${summary.high} високих рањивости (дозвољено: ${thresholds.maxHigh})`);
    }
    
    if (summary.total > thresholds.maxTotal) {
      alerts.push(`📊 Укупно: ${summary.total} рањивости (дозвољено: ${thresholds.maxTotal})`);
    }
    
    if (alerts.length > 0) {
      console.log('\n🚨 ПРЕКОРАЧЕНИ БЕЗБЕДНОСНИ ПРАГОВИ:');
      alerts.forEach(alert => console.log(alert));
      
      // Логуј у audit систем
      await auditService.log(
        AuditEventType.SECURITY_VIOLATION,
        AuditSeverity.HIGH,
        `Прекорачени безбедносни прагови при сканирању: ${alerts.join(', ')}`,
        { metadata: { scanId: scanResult.id, alerts, summary } }
      );
    }
  }

  /**
   * Помоћне функције
   */

  private createScanResult(type: ScanType): ScanResult {
    const id = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id,
      type,
      status: ScanStatus.RUNNING,
      startTime: new Date(),
      vulnerabilities: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        info: 0
      },
      scannerVersion: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  private completeScan(scanResult: ScanResult): void {
    scanResult.endTime = new Date();
    scanResult.duration = Math.round((scanResult.endTime.getTime() - scanResult.startTime.getTime()) / 1000);
    scanResult.status = ScanStatus.COMPLETED;
    
    // Израчунај summary
    for (const vuln of scanResult.vulnerabilities) {
      scanResult.summary.total++;
      const severityKey = vuln.severity.toLowerCase() as keyof typeof scanResult.summary;
      if (typeof scanResult.summary[severityKey] === 'number') {
        (scanResult.summary[severityKey] as number)++;
      }
    }
    
    // Сачувај резултат
    this.scanResults.push(scanResult);
    this.activeScan = null;
    
    // Ограничи број резултата у меморији
    if (this.scanResults.length > this.maxResultsInMemory) {
      this.scanResults = this.scanResults.slice(-this.maxResultsInMemory + 10);
    }
    
    console.log(`✅ Сканирање завршено: ${scanResult.type} - ${scanResult.summary.total} рањивости`);
  }

  private mapNpmSeverityToVulnerabilitySeverity(npmSeverity: string): VulnerabilitySeverity {
    switch (npmSeverity?.toLowerCase()) {
      case 'critical': return VulnerabilitySeverity.CRITICAL;
      case 'high': return VulnerabilitySeverity.HIGH;
      case 'moderate': return VulnerabilitySeverity.MODERATE;
      case 'low': return VulnerabilitySeverity.LOW;
      default: return VulnerabilitySeverity.INFO;
    }
  }

  private getCodeRecommendation(title: string): string {
    const recommendations: Record<string, string> = {
      'Hardcoded лозинка у коду': 'Користите environment променљиве или secure vault за чување лозинки',
      'Hardcoded API кључ': 'Користите environment променљиве за API кључеве',
      'Коришћење eval() функције': 'Избегавајте eval() - користите JSON.parse() или друге безбедне алтернативе',
      'Потенцијални XSS преко innerHTML': 'Користите textContent или DOMPurify за sanitization'
    };
    
    return recommendations[title] || 'Консултујте безбедносне смернице за ову врсту рањивости';
  }

  private async getSourceFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    if (!fs.existsSync(dirPath)) {
      return files;
    }
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !this.config.exclusions.directories.includes(entry.name)) {
        const subFiles = await this.getSourceFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && this.isSourceFile(entry.name)) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private isSourceFile(filename: string): boolean {
    const sourceExtensions = ['.ts', '.js', '.tsx', '.jsx'];
    const ext = path.extname(filename);
    
    return sourceExtensions.includes(ext) && 
           !this.config.exclusions.files.some(pattern => 
             filename.match(pattern.replace('*', '.*'))
           );
  }

  private async countSourceFiles(dirPath: string): Promise<number> {
    const files = await this.getSourceFiles(dirPath);
    return files.length;
  }

  private generateRecommendations(scanResult: ScanResult): string[] {
    const recommendations: string[] = [];
    
    if (scanResult.summary.critical > 0) {
      recommendations.push('🚨 Хитно исправите све критичне рањивости пре продукције');
    }
    
    if (scanResult.summary.high > 0) {
      recommendations.push('⚠️  Планирајте исправку високих рањивости у следећем release-у');
    }
    
    if (scanResult.vulnerabilities.some(v => !v.fixAvailable)) {
      recommendations.push('🔍 Контактирајте maintainer-e за рањивости без доступних исправки');
    }
    
    recommendations.push('📊 Редовно понављајте сканирања (најмање једном недељно)');
    recommendations.push('🔄 Ажурирајте зависности редовно');
    
    return recommendations;
  }

  /**
   * Јавне методе за управљање сканирањем
   */

  /**
   * Добија све резултате сканирања
   */
  getScanResults(filter: {
    type?: ScanType;
    status?: ScanStatus;
    limit?: number;
    offset?: number;
  } = {}): ScanResult[] {
    let filtered = [...this.scanResults];
    
    if (filter.type) {
      filtered = filtered.filter(result => result.type === filter.type);
    }
    
    if (filter.status) {
      filtered = filtered.filter(result => result.status === filter.status);
    }
    
    // Сортирај по времену (најновији први)
    filtered.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    // Примени пагинацију
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;
    
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Добија тренутно активно сканирање
   */
  getActiveScan(): ScanResult | null {
    return this.activeScan;
  }

  /**
   * Добија конфигурацију
   */
  getConfiguration(): SecurityScanConfig {
    return { ...this.config };
  }

  /**
   * Ажурира конфигурацију
   */
  updateConfiguration(newConfig: Partial<SecurityScanConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();
  }

  /**
   * Добија статистике сканирања
   */
  getScanStatistics(): any {
    const completed = this.scanResults.filter(r => r.status === ScanStatus.COMPLETED);
    
    return {
      totalScans: this.scanResults.length,
      completedScans: completed.length,
      failedScans: this.scanResults.filter(r => r.status === ScanStatus.FAILED).length,
      averageDuration: completed.reduce((sum, r) => sum + (r.duration || 0), 0) / completed.length || 0,
      lastScan: completed[0]?.startTime,
      totalVulnerabilities: completed.reduce((sum, r) => sum + r.summary.total, 0),
      criticalVulnerabilities: completed.reduce((sum, r) => sum + r.summary.critical, 0)
    };
  }
}

// Експортуј singleton инстанцу
export const securityScanService = new SecurityScanService();
export default securityScanService; 