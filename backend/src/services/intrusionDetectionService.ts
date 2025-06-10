import fs from 'fs';
import path from 'path';
import { Request } from 'express';
import securityService from './securityService';
import auditService, { AuditEventType, AuditSeverity } from './auditService';

/**
 * Типови безбедносних претњи
 */
export enum ThreatType {
  // Web напади
  SQL_INJECTION = 'SQL_INJECTION',
  XSS_ATTACK = 'XSS_ATTACK',
  CSRF_ATTACK = 'CSRF_ATTACK',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  COMMAND_INJECTION = 'COMMAND_INJECTION',
  
  // Сканирање и рекогносцирање
  PORT_SCAN = 'PORT_SCAN',
  DIRECTORY_TRAVERSAL = 'DIRECTORY_TRAVERSAL',
  VULNERABILITY_SCAN = 'VULNERABILITY_SCAN',
  
  // Брутфорс напади
  BRUTE_FORCE_LOGIN = 'BRUTE_FORCE_LOGIN',
  DICTIONARY_ATTACK = 'DICTIONARY_ATTACK',
  
  // DOS/DDOS
  DOS_ATTACK = 'DOS_ATTACK',
  DDOS_ATTACK = 'DDOS_ATTACK',
  SLOWLORIS_ATTACK = 'SLOWLORIS_ATTACK',
  
  // Malware и боботи
  BOT_ACTIVITY = 'BOT_ACTIVITY',
  MALWARE_DOWNLOAD = 'MALWARE_DOWNLOAD',
  SUSPICIOUS_UPLOAD = 'SUSPICIOUS_UPLOAD',
  
  // Приступ подацима
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION'
}

/**
 * Ниво претње
 */
export enum ThreatLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Типови аутоматских одговора
 */
export enum ResponseAction {
  LOG_ONLY = 'LOG_ONLY',           // Само логуј
  RATE_LIMIT = 'RATE_LIMIT',       // Примени rate limiting
  TEMPORARY_BLOCK = 'TEMPORARY_BLOCK', // Привремено блокирај IP
  PERMANENT_BLOCK = 'PERMANENT_BLOCK', // Трајно блокирај IP
  ALERT_ADMIN = 'ALERT_ADMIN',     // Обавести администратора
  QUARANTINE = 'QUARANTINE'        // Карантин сесије/корисника
}

/**
 * Интерфејс за детектовану претњу
 */
export interface DetectedThreat {
  id: string;
  timestamp: Date;
  threatType: ThreatType;
  threatLevel: ThreatLevel;
  description: string;
  
  // Извор претње
  sourceIP: string;
  userAgent: string;
  userId?: string;
  username?: string;
  
  // Контекст напада
  targetEndpoint: string;
  attackVector: string;
  payload?: string;
  
  // Детаљи детекције
  detectionMethod: string;
  confidence: number; // 0-100%
  
  // Одговор система
  responseActions: ResponseAction[];
  blocked: boolean;
  
  // Додатни метаподаци
  metadata?: Record<string, any>;
}

/**
 * Конфигурација за детекцију претњи
 */
interface ThreatDetectionConfig {
  enabled: boolean;
  thresholds: {
    requestsPerMinute: number;
    failedLoginsPerMinute: number;
    suspiciousPathsPerMinute: number;
    largePayloadSizeKB: number;
  };
  patterns: {
    sqlInjection: RegExp[];
    xssAttack: RegExp[];
    pathTraversal: RegExp[];
    commandInjection: RegExp[];
  };
  responseActions: {
    [key in ThreatLevel]: ResponseAction[];
  };
}

/**
 * Сервис за детекцију и превенцију упада са српским описима
 */
class IntrusionDetectionService {
  private threats: DetectedThreat[];
  private config: ThreatDetectionConfig;
  private configPath: string;
  private maxThreatsInMemory: number;
  private readonly threatDescriptions: Record<ThreatType, string>;

  constructor() {
    this.threats = [];
    this.maxThreatsInMemory = 5000;
    this.configPath = path.join(process.cwd(), 'config', 'ids-config.json');
    
    // Иницијализуј са подразумеваном конфигурацијом прво
    this.config = this.getDefaultConfiguration();
    
    // Затим учитај конфигурацију са диска (може да преписује подразумевану)
    this.loadConfiguration();
    
    // Српски описи претњи
    this.threatDescriptions = {
      [ThreatType.SQL_INJECTION]: 'SQL injection напад - покушај извршавања SQL команди',
      [ThreatType.XSS_ATTACK]: 'Cross-Site Scripting (XSS) напад - убацивање злонамерног скрипта',
      [ThreatType.CSRF_ATTACK]: 'Cross-Site Request Forgery (CSRF) напад - лажни захтеви',
      [ThreatType.PATH_TRAVERSAL]: 'Path traversal напад - покушај приступа забрањеним фајловима',
      [ThreatType.COMMAND_INJECTION]: 'Command injection напад - покушај извршавања системских команди',
      
      [ThreatType.PORT_SCAN]: 'Port scanning активност - сканирање отворених портова',
      [ThreatType.DIRECTORY_TRAVERSAL]: 'Directory traversal - истраживање структуре директоријума',
      [ThreatType.VULNERABILITY_SCAN]: 'Vulnerability scanning - тестирање познатих рањивости',
      
      [ThreatType.BRUTE_FORCE_LOGIN]: 'Brute force напад на пријаву - многобројни покушаји пријаве',
      [ThreatType.DICTIONARY_ATTACK]: 'Dictionary напад - коришћење листе честих лозинки',
      
      [ThreatType.DOS_ATTACK]: 'Denial of Service (DoS) напад - преоптерећење сервера',
      [ThreatType.DDOS_ATTACK]: 'Distributed DoS (DDoS) напад - координисано преоптерећење',
      [ThreatType.SLOWLORIS_ATTACK]: 'Slowloris напад - споро исцрпљивање ресурса',
      
      [ThreatType.BOT_ACTIVITY]: 'Активност бота - аутоматизована активност',
      [ThreatType.MALWARE_DOWNLOAD]: 'Покушај преузимања malware-а',
      [ThreatType.SUSPICIOUS_UPLOAD]: 'Сумњив upload фајла - могући malware',
      
      [ThreatType.DATA_EXFILTRATION]: 'Покушај крађе података - неовлашћено преузимање',
      [ThreatType.UNAUTHORIZED_ACCESS]: 'Неовлашћен приступ заштићеним ресурсима',
      [ThreatType.PRIVILEGE_ESCALATION]: 'Покушај проширивања привилегија'
    };
  }

  /**
   * Учитава конфигурацију за детекцију претњи
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
      
      console.log('✅ IDS конфигурација учитана');
    } catch (error) {
      console.error('❌ Грешка при учитавању IDS конфигурације:', error);
      this.config = this.getDefaultConfiguration();
    }
  }

  /**
   * Враћа подразумевану конфигурацију
   */
  private getDefaultConfiguration(): ThreatDetectionConfig {
    return {
      enabled: true,
      thresholds: {
        requestsPerMinute: 120,
        failedLoginsPerMinute: 5,
        suspiciousPathsPerMinute: 10,
        largePayloadSizeKB: 1024
      },
      patterns: {
        sqlInjection: [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)|('|(\\))/gi,
          /(\b(OR|AND)\s+\d+\s*=\s*\d+)|(\b(OR|AND)\s+[\w\s]*=[\w\s]*)/gi,
          /(SLEEP\(|BENCHMARK\(|pg_sleep\()/gi
        ],
        xssAttack: [
          /<script[^>]*>.*?<\/script>/gi,
          /javascript\s*:/gi,
          /on\w+\s*=\s*["'][^"']*["']/gi,
          /<iframe[^>]*>/gi
        ],
        pathTraversal: [
          /\.\.(\/|\\)/g,
          /(\/|\\)\.\.(\/|\\)/g,
          /\%2e\%2e/gi,
          /\%252e\%252e/gi
        ],
        commandInjection: [
          /[;&|`$()]/g,
          /\b(cat|ls|dir|type|echo|pwd|whoami|id|uname)\b/gi,
          /\b(wget|curl|nc|netcat)\b/gi
        ]
      },
      responseActions: {
        [ThreatLevel.LOW]: [ResponseAction.LOG_ONLY],
        [ThreatLevel.MEDIUM]: [ResponseAction.LOG_ONLY, ResponseAction.RATE_LIMIT],
        [ThreatLevel.HIGH]: [ResponseAction.LOG_ONLY, ResponseAction.TEMPORARY_BLOCK, ResponseAction.ALERT_ADMIN],
        [ThreatLevel.CRITICAL]: [ResponseAction.LOG_ONLY, ResponseAction.PERMANENT_BLOCK, ResponseAction.ALERT_ADMIN]
      }
    };
  }

  /**
   * Спаја учитану конфигурацију са подразумеваном
   */
  private mergeWithDefaults(config: any): ThreatDetectionConfig {
    const defaults = this.getDefaultConfiguration();
    return {
      ...defaults,
      ...config,
      thresholds: { ...defaults.thresholds, ...config.thresholds },
      patterns: { ...defaults.patterns, ...config.patterns },
      responseActions: { ...defaults.responseActions, ...config.responseActions }
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
      console.log('💾 IDS конфигурација сачувана');
    } catch (error) {
      console.error('❌ Грешка при чувању IDS конфигурације:', error);
    }
  }

  /**
   * Главна функција за анализу HTTP захтева
   */
  async analyzeRequest(req: Request): Promise<DetectedThreat[]> {
    if (!this.config.enabled) {
      return [];
    }

    const detectedThreats: DetectedThreat[] = [];
    const clientIP = securityService.getClientIP(req);
    const userAgent = req.get('User-Agent') || '';
    const url = req.originalUrl || req.url;
    const method = req.method;

    try {
      // 1. Анализирај SQL Injection
      const sqlThreats = this.detectSQLInjection(req, clientIP, userAgent);
      detectedThreats.push(...sqlThreats);

      // 2. Анализирај XSS напад
      const xssThreats = this.detectXSSAttack(req, clientIP, userAgent);
      detectedThreats.push(...xssThreats);

      // 3. Анализирај Path Traversal
      const pathThreats = this.detectPathTraversal(req, clientIP, userAgent);
      detectedThreats.push(...pathThreats);

      // 4. Анализирај Command Injection
      const cmdThreats = this.detectCommandInjection(req, clientIP, userAgent);
      detectedThreats.push(...cmdThreats);

      // 5. Анализирај сумњиву активност бота
      const botThreats = this.detectBotActivity(req, clientIP, userAgent);
      detectedThreats.push(...botThreats);

      // 6. Анализирај DoS pattern-е
      const dosThreats = this.detectDOSPatterns(req, clientIP, userAgent);
      detectedThreats.push(...dosThreats);

      // 7. Анализирај неовлашћен приступ
      const accessThreats = this.detectUnauthorizedAccess(req, clientIP, userAgent);
      detectedThreats.push(...accessThreats);

      // Процесирај сваку детектовану претњу
      for (const threat of detectedThreats) {
        await this.processThreat(threat, req);
      }

      return detectedThreats;

    } catch (error) {
      console.error('❌ Грешка при анализи захтева за IDS:', error);
      return [];
    }
  }

  /**
   * Детектује SQL Injection покушаје
   */
  private detectSQLInjection(req: Request, clientIP: string, userAgent: string): DetectedThreat[] {
    const threats: DetectedThreat[] = [];
    const patterns = this.config.patterns.sqlInjection;
    
    // Анализирај URL параметре
    const queryParams = new URLSearchParams(req.url?.split('?')[1] || '');
    for (const [key, value] of queryParams) {
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          threats.push(this.createThreat({
            threatType: ThreatType.SQL_INJECTION,
            threatLevel: ThreatLevel.HIGH,
            sourceIP: clientIP,
            userAgent,
            targetEndpoint: req.path,
            attackVector: `URL parameter: ${key}`,
            payload: value,
            detectionMethod: 'Pattern matching',
            confidence: 85
          }));
          break;
        }
      }
    }

    // Анализирај request body
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      for (const pattern of patterns) {
        if (pattern.test(bodyStr)) {
          threats.push(this.createThreat({
            threatType: ThreatType.SQL_INJECTION,
            threatLevel: ThreatLevel.HIGH,
            sourceIP: clientIP,
            userAgent,
            targetEndpoint: req.path,
            attackVector: 'Request body',
            payload: bodyStr.substring(0, 200),
            detectionMethod: 'Pattern matching',
            confidence: 90
          }));
          break;
        }
      }
    }

    return threats;
  }

  /**
   * Детектује XSS напад покушаје
   */
  private detectXSSAttack(req: Request, clientIP: string, userAgent: string): DetectedThreat[] {
    const threats: DetectedThreat[] = [];
    const patterns = this.config.patterns.xssAttack;
    
    // Проверавај URL и параметре
    const fullUrl = req.originalUrl || req.url;
    for (const pattern of patterns) {
      if (pattern.test(fullUrl)) {
        threats.push(this.createThreat({
          threatType: ThreatType.XSS_ATTACK,
          threatLevel: ThreatLevel.MEDIUM,
          sourceIP: clientIP,
          userAgent,
          targetEndpoint: req.path,
          attackVector: 'URL parameters',
          payload: fullUrl,
          detectionMethod: 'Pattern matching',
          confidence: 80
        }));
        break;
      }
    }

    return threats;
  }

  /**
   * Детектује Path Traversal покушаје
   */
  private detectPathTraversal(req: Request, clientIP: string, userAgent: string): DetectedThreat[] {
    const threats: DetectedThreat[] = [];
    const patterns = this.config.patterns.pathTraversal;
    const path = req.path;
    
    for (const pattern of patterns) {
      if (pattern.test(path)) {
        threats.push(this.createThreat({
          threatType: ThreatType.PATH_TRAVERSAL,
          threatLevel: ThreatLevel.HIGH,
          sourceIP: clientIP,
          userAgent,
          targetEndpoint: path,
          attackVector: 'URL path',
          payload: path,
          detectionMethod: 'Pattern matching',
          confidence: 95
        }));
        break;
      }
    }

    return threats;
  }

  /**
   * Детектује Command Injection покушаје
   */
  private detectCommandInjection(req: Request, clientIP: string, userAgent: string): DetectedThreat[] {
    const threats: DetectedThreat[] = [];
    const patterns = this.config.patterns.commandInjection;
    
    // Проверавај сав input
    const inputs = [
      req.originalUrl || req.url,
      JSON.stringify(req.body || {}),
      JSON.stringify(req.query || {})
    ];

    for (const input of inputs) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          threats.push(this.createThreat({
            threatType: ThreatType.COMMAND_INJECTION,
            threatLevel: ThreatLevel.CRITICAL,
            sourceIP: clientIP,
            userAgent,
            targetEndpoint: req.path,
            attackVector: 'Input parameters',
            payload: input.substring(0, 200),
            detectionMethod: 'Pattern matching',
            confidence: 88
          }));
          break;
        }
      }
    }

    return threats;
  }

  /**
   * Детектује активност бота
   */
  private detectBotActivity(req: Request, clientIP: string, userAgent: string): DetectedThreat[] {
    const threats: DetectedThreat[] = [];
    
    // Познати bot pattern-и
    const botPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|java|perl/i,
      /nmap|nikto|sqlmap|burp|metasploit/i
    ];

    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        threats.push(this.createThreat({
          threatType: ThreatType.BOT_ACTIVITY,
          threatLevel: ThreatLevel.MEDIUM,
          sourceIP: clientIP,
          userAgent,
          targetEndpoint: req.path,
          attackVector: 'User-Agent string',
          payload: userAgent,
          detectionMethod: 'User-Agent analysis',
          confidence: 75
        }));
        break;
      }
    }

    return threats;
  }

  /**
   * Детектује DoS pattern-е
   */
  private detectDOSPatterns(req: Request, clientIP: string, userAgent: string): DetectedThreat[] {
    const threats: DetectedThreat[] = [];
    
    // Провери брзину захтева (ово би требало да буде интегрисано са rate limiting статистикама)
    const stats = securityService.getRateLimitStats(clientIP);
    if (stats && stats.requestCount > this.config.thresholds.requestsPerMinute) {
      threats.push(this.createThreat({
        threatType: ThreatType.DOS_ATTACK,
        threatLevel: ThreatLevel.HIGH,
        sourceIP: clientIP,
        userAgent,
        targetEndpoint: req.path,
        attackVector: 'High request rate',
        payload: `${stats.requestCount} requests in recent period`,
        detectionMethod: 'Rate analysis',
        confidence: 90
      }));
    }

    return threats;
  }

  /**
   * Детектује неовлашћен приступ
   */
  private detectUnauthorizedAccess(req: Request, clientIP: string, userAgent: string): DetectedThreat[] {
    const threats: DetectedThreat[] = [];
    
    // Проверавај покушаје приступа администраторским ресурсима без аутентификације
    const protectedPaths = ['/admin', '/config', '/backup', '/database'];
    const hasAccess = (req as any).user; // Провери да ли је корисник аутентификован
    
    for (const protectedPath of protectedPaths) {
      if (req.path.includes(protectedPath) && !hasAccess) {
        threats.push(this.createThreat({
          threatType: ThreatType.UNAUTHORIZED_ACCESS,
          threatLevel: ThreatLevel.HIGH,
          sourceIP: clientIP,
          userAgent,
          targetEndpoint: req.path,
          attackVector: 'Protected resource access',
          payload: req.path,
          detectionMethod: 'Access control check',
          confidence: 95
        }));
      }
    }

    return threats;
  }

  /**
   * Креира нову претњу објекат
   */
  private createThreat(params: {
    threatType: ThreatType;
    threatLevel: ThreatLevel;
    sourceIP: string;
    userAgent: string;
    targetEndpoint: string;
    attackVector: string;
    payload: string;
    detectionMethod: string;
    confidence: number;
  }): DetectedThreat {
    return {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      description: this.threatDescriptions[params.threatType],
      blocked: false,
      responseActions: [],
      ...params
    };
  }

  /**
   * Процесира детектовану претњу и примењује одговарајуће акције
   */
  private async processThreat(threat: DetectedThreat, req: Request): Promise<void> {
    try {
      // Одреди акције на основу нивоа претње
      const actions = this.config.responseActions[threat.threatLevel] || [ResponseAction.LOG_ONLY];
      threat.responseActions = actions;

      // Примени акције
      for (const action of actions) {
        await this.executeResponseAction(action, threat, req);
      }

      // Сачувај претњу
      this.threats.push(threat);
      
      // Ограничи број претњи у меморији
      if (this.threats.length > this.maxThreatsInMemory) {
        this.threats = this.threats.slice(-this.maxThreatsInMemory + 1000);
      }

      // Логуј у audit систем
      await auditService.log(
        AuditEventType.SECURITY_VIOLATION,
        this.mapThreatLevelToAuditSeverity(threat.threatLevel),
        `Детектована претња: ${threat.description}`,
        {
          req,
          metadata: {
            threatId: threat.id,
            threatType: threat.threatType,
            threatLevel: threat.threatLevel,
            confidence: threat.confidence,
            attackVector: threat.attackVector,
            responseActions: threat.responseActions
          }
        }
      );

    } catch (error) {
      console.error('❌ Грешка при процесирању претње:', error);
    }
  }

  /**
   * Извршава конкретну акцију одговора
   */
  private async executeResponseAction(action: ResponseAction, threat: DetectedThreat, req: Request): Promise<void> {
    switch (action) {
      case ResponseAction.LOG_ONLY:
        console.log(`🔍 [IDS] ${threat.description} - IP: ${threat.sourceIP}, Confidence: ${threat.confidence}%`);
        break;

      case ResponseAction.RATE_LIMIT:
        // Интегрисај са rate limiting сервисом
        console.log(`⏱️  [IDS] Примењен rate limit за ${threat.sourceIP}`);
        break;

      case ResponseAction.TEMPORARY_BLOCK:
        // Додај у blacklist на 1 сат
        const tempBlockDuration = new Date(Date.now() + 60 * 60 * 1000);
        securityService.addToBlacklist(
          threat.sourceIP,
          `IDS детекција: ${threat.description}`,
          'high',
          tempBlockDuration
        );
        threat.blocked = true;
        console.log(`🚫 [IDS] Привремено блокиран ${threat.sourceIP} због ${threat.threatType}`);
        break;

      case ResponseAction.PERMANENT_BLOCK:
        // Додај у трајни blacklist
        securityService.addToBlacklist(
          threat.sourceIP,
          `IDS детекција критичне претње: ${threat.description}`,
          'critical'
        );
        threat.blocked = true;
        console.log(`🛑 [IDS] Трајно блокиран ${threat.sourceIP} због ${threat.threatType}`);
        break;

      case ResponseAction.ALERT_ADMIN:
        // Пошаљи админ alert (може се интегрисати са email/notification системом)
        console.log(`🚨 [IDS ALERT] Критична претња детектована: ${threat.description} од ${threat.sourceIP}`);
        break;

      case ResponseAction.QUARANTINE:
        // Карантин сесије (може се интегрисати са session management-ом)
        console.log(`🔒 [IDS] Карантин сесије за ${threat.sourceIP}`);
        break;
    }
  }

  /**
   * Мапира ниво претње на audit severity
   */
  private mapThreatLevelToAuditSeverity(threatLevel: ThreatLevel): AuditSeverity {
    switch (threatLevel) {
      case ThreatLevel.LOW: return AuditSeverity.LOW;
      case ThreatLevel.MEDIUM: return AuditSeverity.MEDIUM;
      case ThreatLevel.HIGH: return AuditSeverity.HIGH;
      case ThreatLevel.CRITICAL: return AuditSeverity.CRITICAL;
      default: return AuditSeverity.MEDIUM;
    }
  }

  /**
   * Добија све детектоване претње са опциним филтерима
   */
  getThreats(filter: {
    threatType?: ThreatType;
    threatLevel?: ThreatLevel;
    sourceIP?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): DetectedThreat[] {
    let filtered = [...this.threats];
    
    if (filter.threatType) {
      filtered = filtered.filter(threat => threat.threatType === filter.threatType);
    }
    
    if (filter.threatLevel) {
      filtered = filtered.filter(threat => threat.threatLevel === filter.threatLevel);
    }
    
    if (filter.sourceIP) {
      filtered = filtered.filter(threat => threat.sourceIP === filter.sourceIP);
    }
    
    if (filter.startDate) {
      filtered = filtered.filter(threat => threat.timestamp >= filter.startDate!);
    }
    
    if (filter.endDate) {
      filtered = filtered.filter(threat => threat.timestamp <= filter.endDate!);
    }
    
    // Сортирај по времену (најновији први)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Примени пагинацију
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Добија статистике претњи
   */
  getThreatStatistics(period: 'hour' | 'day' | 'week' = 'day'): any {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }
    
    const periodThreats = this.threats.filter(threat => threat.timestamp >= startDate);
    
    const threatTypeStats: Record<string, number> = {};
    const threatLevelStats: Record<string, number> = {};
    const topSourceIPs: Record<string, number> = {};
    
    for (const threat of periodThreats) {
      threatTypeStats[threat.threatType] = (threatTypeStats[threat.threatType] || 0) + 1;
      threatLevelStats[threat.threatLevel] = (threatLevelStats[threat.threatLevel] || 0) + 1;
      topSourceIPs[threat.sourceIP] = (topSourceIPs[threat.sourceIP] || 0) + 1;
    }
    
    return {
      period,
      totalThreats: periodThreats.length,
      blockedThreats: periodThreats.filter(t => t.blocked).length,
      threatTypes: threatTypeStats,
      threatLevels: threatLevelStats,
      topSourceIPs: Object.entries(topSourceIPs)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }))
    };
  }

  /**
   * Ажурира конфигурацију
   */
  updateConfiguration(newConfig: Partial<ThreatDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();
  }

  /**
   * Добија тренутну конфигурацију
   */
  getConfiguration(): ThreatDetectionConfig {
    return { ...this.config };
  }
}

// Експортуј singleton инстанцу
export const intrusionDetectionService = new IntrusionDetectionService();
export default intrusionDetectionService; 