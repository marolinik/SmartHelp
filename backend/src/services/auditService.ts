import fs from 'fs';
import path from 'path';
import { Request } from 'express';
import UAParser from 'ua-parser-js';
import geoip from 'geoip-lite';
import securityService from './securityService';

/**
 * Типови audit догађаја
 */
export enum AuditEventType {
  // Аутентификација
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  
  // Управљање корисницима
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
  
  // Тикети
  TICKET_CREATE = 'TICKET_CREATE',
  TICKET_UPDATE = 'TICKET_UPDATE',
  TICKET_DELETE = 'TICKET_DELETE',
  TICKET_ASSIGN = 'TICKET_ASSIGN',
  TICKET_STATUS_CHANGE = 'TICKET_STATUS_CHANGE',
  TICKET_COMMENT_ADD = 'TICKET_COMMENT_ADD',
  
  // База знања
  KB_ARTICLE_CREATE = 'KB_ARTICLE_CREATE',
  KB_ARTICLE_UPDATE = 'KB_ARTICLE_UPDATE',
  KB_ARTICLE_DELETE = 'KB_ARTICLE_DELETE',
  KB_ARTICLE_PUBLISH = 'KB_ARTICLE_PUBLISH',
  
  // Администрација
  SYSTEM_CONFIG_CHANGE = 'SYSTEM_CONFIG_CHANGE',
  DATABASE_BACKUP = 'DATABASE_BACKUP',
  DATABASE_RESTORE = 'DATABASE_RESTORE',
  
  // Безбедност
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  IP_BLOCKED = 'IP_BLOCKED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  
  // Систем
  SYSTEM_START = 'SYSTEM_START',
  SYSTEM_SHUTDOWN = 'SYSTEM_SHUTDOWN',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  
  // Приступ подацима
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT',
  DATA_VIEW = 'DATA_VIEW',
  DATA_DOWNLOAD = 'DATA_DOWNLOAD'
}

/**
 * Ниво озбиљности audit догађаја
 */
export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Интерфејс за audit log запис
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  message: string;
  description: string;
  
  // Корисничке информације
  userId?: string;
  username?: string;
  userRole?: string;
  
  // Мрежне информације
  ipAddress: string;
  userAgent: string;
  deviceInfo?: {
    browser: string;
    os: string;
    device: string;
  };
  geoLocation?: {
    country: string;
    region: string;
    city: string;
    timezone: string;
  };
  
  // HTTP захтев детаљи
  method?: string;
  url?: string;
  statusCode?: number;
  
  // Додатни контекст
  resourceId?: string;
  resourceType?: string;
  oldValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
}

/**
 * Опције за audit logging
 */
export interface AuditOptions {
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  sensitiveFields?: string[];
  maxBodySize?: number;
}

/**
 * Сервис за комплетно audit logging са српским описима
 */
class AuditService {
  private logs: AuditLogEntry[];
  private logFilePath: string;
  private maxLogsInMemory: number;
  private readonly eventDescriptions: Record<AuditEventType, string>;

  constructor() {
    this.logs = [];
    this.maxLogsInMemory = 10000; // Максимално 10,000 логова у меморији
    this.logFilePath = path.join(process.cwd(), 'logs', 'audit.log');
    
    // Обезбеди да логс директоријум постоји
    this.ensureLogDirectory();
    
    // Учитај постојеће логове при покретању
    this.loadExistingLogs();
    
    // Српски описи за све типове догађаја
    this.eventDescriptions = {
      [AuditEventType.LOGIN_SUCCESS]: 'Успешна пријава корисника у систем',
      [AuditEventType.LOGIN_FAILURE]: 'Неуспешан покушај пријаве у систем',
      [AuditEventType.LOGOUT]: 'Одјава корисника из система',
      [AuditEventType.PASSWORD_CHANGE]: 'Промена лозинке корисника',
      
      [AuditEventType.USER_CREATE]: 'Креиран нови кориснички налог',
      [AuditEventType.USER_UPDATE]: 'Ажуриране информације корисника',
      [AuditEventType.USER_DELETE]: 'Обрисан кориснички налог',
      [AuditEventType.USER_ROLE_CHANGE]: 'Промењена улога корисника',
      
      [AuditEventType.TICKET_CREATE]: 'Креиран нови тикет',
      [AuditEventType.TICKET_UPDATE]: 'Ажуриран тикет',
      [AuditEventType.TICKET_DELETE]: 'Обрисан тикет',
      [AuditEventType.TICKET_ASSIGN]: 'Тикет додељен кориснику',
      [AuditEventType.TICKET_STATUS_CHANGE]: 'Промењен статус тикета',
      [AuditEventType.TICKET_COMMENT_ADD]: 'Додат коментар на тикет',
      
      [AuditEventType.KB_ARTICLE_CREATE]: 'Креиран нови чланак у бази знања',
      [AuditEventType.KB_ARTICLE_UPDATE]: 'Ажуриран чланак базе знања',
      [AuditEventType.KB_ARTICLE_DELETE]: 'Обрисан чланак из базе знања',
      [AuditEventType.KB_ARTICLE_PUBLISH]: 'Објављен чланак базе знања',
      
      [AuditEventType.SYSTEM_CONFIG_CHANGE]: 'Промењена конфигурација система',
      [AuditEventType.DATABASE_BACKUP]: 'Креирана резервна копија базе података',
      [AuditEventType.DATABASE_RESTORE]: 'Враћена база података из резервне копије',
      
      [AuditEventType.SECURITY_VIOLATION]: 'Детектована безбедносна повреда',
      [AuditEventType.IP_BLOCKED]: 'IP адреса је блокирана због сумњиве активности',
      [AuditEventType.RATE_LIMIT_EXCEEDED]: 'Прекорачено ограничење броја захтева',
      [AuditEventType.SUSPICIOUS_ACTIVITY]: 'Детектована сумњива активност',
      
      [AuditEventType.SYSTEM_START]: 'Покретање система',
      [AuditEventType.SYSTEM_SHUTDOWN]: 'Заустављање система',
      [AuditEventType.ERROR_OCCURRED]: 'Дошло је до грешке у систему',
      
      [AuditEventType.DATA_EXPORT]: 'Извоз података из система',
      [AuditEventType.DATA_IMPORT]: 'Увоз података у систем',
      [AuditEventType.DATA_VIEW]: 'Приступ осетљивим подацима',
      [AuditEventType.DATA_DOWNLOAD]: 'Преузимање података из система'
    };
  }

  /**
   * Обезбеђује да директоријум за логове постоји
   */
  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      console.log('📁 Креиран директоријум за audit логове:', logDir);
    }
  }

  /**
   * Учитава постојеће логове са диска
   */
  private loadExistingLogs(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const logContent = fs.readFileSync(this.logFilePath, 'utf8');
        const lines = logContent.trim().split('\n').filter(line => line.length > 0);
        
        for (const line of lines.slice(-this.maxLogsInMemory)) {
          try {
            const entry: AuditLogEntry = JSON.parse(line);
            // Конвертуј timestamp string у Date објекат
            entry.timestamp = new Date(entry.timestamp);
            this.logs.push(entry);
          } catch (parseError) {
            console.warn('⚠️  Неможе да парсира audit log линију:', line);
          }
        }
        
        console.log(`📊 Учитано ${this.logs.length} audit log записа`);
      }
    } catch (error) {
      console.error('❌ Грешка при учитавању audit логова:', error);
    }
  }

  /**
   * Генерише јединствени ID за audit запис
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Парсира User-Agent за добијање информација о уређају
   */
  private parseUserAgent(userAgent: string): { browser: string; os: string; device: string } {
    const parser = new UAParser();
    const result = parser.setUA(userAgent).getResult();
    
    return {
      browser: `${result.browser.name || 'Непознат'} ${result.browser.version || ''}`.trim(),
      os: `${result.os.name || 'Непознат'} ${result.os.version || ''}`.trim(),
      device: result.device.model || result.device.type || 'Рачунар'
    };
  }

  /**
   * Добија географску локацију на основу IP адресе
   */
  private getGeoLocation(ip: string): { country: string; region: string; city: string; timezone: string } | undefined {
    try {
      // Прескачи локалне IP адресе
      if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return {
          country: 'Србија',
          region: 'Локална мрежа',
          city: 'Локални систем',
          timezone: 'Europe/Belgrade'
        };
      }
      
      const geo = geoip.lookup(ip);
      if (geo) {
        return {
          country: geo.country || 'Непознато',
          region: geo.region || 'Непознато',
          city: geo.city || 'Непознато',
          timezone: geo.timezone || 'Europe/Belgrade'
        };
      }
    } catch (error) {
      console.warn('⚠️  Грешка при добијању геолокације за IP:', ip, error);
    }
    
    return undefined;
  }

  /**
   * Главна функција за логовање audit догађаја
   */
  async log(
    eventType: AuditEventType,
    severity: AuditSeverity,
    message: string,
    context: {
      req?: Request;
      userId?: string;
      username?: string;
      userRole?: string;
      resourceId?: string;
      resourceType?: string;
      oldValue?: any;
      newValue?: any;
      metadata?: Record<string, any>;
    } = {},
    options: AuditOptions = {}
  ): Promise<void> {
    try {
      const timestamp = new Date();
      const id = this.generateId();
      
      // Добиј IP адресу
      let ipAddress = '0.0.0.0';
      let userAgent = 'Непознат';
      let method, url, statusCode;
      
      if (context.req) {
        ipAddress = securityService.getClientIP(context.req);
        userAgent = context.req.get('User-Agent') || 'Непознат';
        method = context.req.method;
        url = context.req.originalUrl || context.req.url;
        statusCode = context.req.res?.statusCode;
      }
      
      // Парсирај User-Agent
      const deviceInfo = this.parseUserAgent(userAgent);
      
      // Добиј геолокацију
      const geoLocation = this.getGeoLocation(ipAddress);
      
      // Креирај audit запис
      const entry: AuditLogEntry = {
        id,
        timestamp,
        eventType,
        severity,
        message,
        description: this.eventDescriptions[eventType] || 'Непознат тип догађаја',
        
        ipAddress,
        userAgent,
        deviceInfo,
        geoLocation
      };
      
      // Додај опционалне пропертије само ако постоје
      if (context.userId) entry.userId = context.userId;
      if (context.username) entry.username = context.username;
      if (context.userRole) entry.userRole = context.userRole;
      if (method) entry.method = method;
      if (url) entry.url = url;
      if (statusCode) entry.statusCode = statusCode;
      if (context.resourceId) entry.resourceId = context.resourceId;
      if (context.resourceType) entry.resourceType = context.resourceType;
      if (context.oldValue !== undefined) entry.oldValue = context.oldValue;
      if (context.newValue !== undefined) entry.newValue = context.newValue;
      if (context.metadata) entry.metadata = context.metadata;
      
      // Додај у меморију
      this.logs.push(entry);
      
      // Ограничи број логова у меморији
      if (this.logs.length > this.maxLogsInMemory) {
        this.logs = this.logs.slice(-this.maxLogsInMemory + 1000); // Задржи задњих 9000 + нови
      }
      
      // Сачувај на диск асинхроно
      await this.persistToFile(entry);
      
      // Логуј у конзолу за важне догађаје
      if (severity === AuditSeverity.HIGH || severity === AuditSeverity.CRITICAL) {
        console.log(`🔍 [AUDIT ${severity}] ${eventType}: ${message} | IP: ${ipAddress} | User: ${context.username || 'Непознат'}`);
      }
      
    } catch (error) {
      console.error('❌ Грешка при логовању audit догађаја:', error);
    }
  }

  /**
   * Чува audit запис на диск
   */
  private async persistToFile(entry: AuditLogEntry): Promise<void> {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      await fs.promises.appendFile(this.logFilePath, logLine, 'utf8');
    } catch (error) {
      console.error('❌ Грешка при чувању audit лога на диск:', error);
    }
  }

  /**
   * Добија логове по филтеру
   */
  getLogs(filter: {
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    userId?: string;
    ipAddress?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): AuditLogEntry[] {
    let filtered = [...this.logs];
    
    // Примени филтере
    if (filter.eventType) {
      filtered = filtered.filter(log => log.eventType === filter.eventType);
    }
    
    if (filter.severity) {
      filtered = filtered.filter(log => log.severity === filter.severity);
    }
    
    if (filter.userId) {
      filtered = filtered.filter(log => log.userId === filter.userId);
    }
    
    if (filter.ipAddress) {
      filtered = filtered.filter(log => log.ipAddress === filter.ipAddress);
    }
    
    if (filter.startDate) {
      filtered = filtered.filter(log => log.timestamp >= filter.startDate!);
    }
    
    if (filter.endDate) {
      filtered = filtered.filter(log => log.timestamp <= filter.endDate!);
    }
    
    // Сортирај по времену (најновији први)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Примени пагинацију
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Добија статистике audit логова
   */
  getStatistics(period: 'day' | 'week' | 'month' = 'day'): any {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    const periodLogs = this.logs.filter(log => log.timestamp >= startDate);
    
    // Статистике по типу догађаја
    const eventStats: Record<string, number> = {};
    const severityStats: Record<string, number> = {};
    const hourlyStats: Record<string, number> = {};
    
    for (const log of periodLogs) {
      // По типу догађаја
      eventStats[log.eventType] = (eventStats[log.eventType] || 0) + 1;
      
      // По озбиљности
      severityStats[log.severity] = (severityStats[log.severity] || 0) + 1;
      
      // По сатима
      const hour = log.timestamp.getHours().toString().padStart(2, '0');
      hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
    }
    
    return {
      period,
      totalEvents: periodLogs.length,
      uniqueUsers: new Set(periodLogs.map(log => log.userId).filter(Boolean)).size,
      uniqueIPs: new Set(periodLogs.map(log => log.ipAddress)).size,
      eventTypes: eventStats,
      severityLevels: severityStats,
      hourlyDistribution: hourlyStats,
      topIPs: this.getTopIPs(periodLogs),
      topUsers: this.getTopUsers(periodLogs)
    };
  }

  /**
   * Добија топ IP адресе по активности
   */
  private getTopIPs(logs: AuditLogEntry[]): Array<{ ip: string; count: number; lastSeen: Date }> {
    const ipStats: Record<string, { count: number; lastSeen: Date }> = {};
    
    for (const log of logs) {
      if (!ipStats[log.ipAddress]) {
        ipStats[log.ipAddress] = { count: 0, lastSeen: log.timestamp };
      }
      ipStats[log.ipAddress].count++;
      if (log.timestamp > ipStats[log.ipAddress].lastSeen) {
        ipStats[log.ipAddress].lastSeen = log.timestamp;
      }
    }
    
    return Object.entries(ipStats)
      .map(([ip, stats]) => ({ ip, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Добија топ кориснике по активности
   */
  private getTopUsers(logs: AuditLogEntry[]): Array<{ userId: string; username: string; count: number; lastSeen: Date }> {
    const userStats: Record<string, { username: string; count: number; lastSeen: Date }> = {};
    
    for (const log of logs) {
      if (log.userId) {
        if (!userStats[log.userId]) {
          userStats[log.userId] = { 
            username: log.username || 'Непознат', 
            count: 0, 
            lastSeen: log.timestamp 
          };
        }
        userStats[log.userId].count++;
        if (log.timestamp > userStats[log.userId].lastSeen) {
          userStats[log.userId].lastSeen = log.timestamp;
        }
      }
    }
    
    return Object.entries(userStats)
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Експортује логове у JSON формату
   */
  exportLogs(filter: any = {}, format: 'json' | 'csv' = 'json'): string {
    const logs = this.getLogs(filter);
    
    if (format === 'csv') {
      const headers = [
        'ID', 'Време', 'Тип догађаја', 'Озбиљност', 'Порука', 'Опис',
        'Корисник ID', 'Корисничко име', 'Улога', 'IP адреса',
        'Браузер', 'Земља', 'Град', 'Метод', 'URL'
      ];
      
      const csvLines = [headers.join(',')];
      
      for (const log of logs) {
        const row = [
          log.id,
          log.timestamp.toISOString(),
          log.eventType,
          log.severity,
          `"${log.message.replace(/"/g, '""')}"`,
          `"${log.description.replace(/"/g, '""')}"`,
          log.userId || '',
          log.username || '',
          log.userRole || '',
          log.ipAddress,
          log.deviceInfo?.browser || '',
          log.geoLocation?.country || '',
          log.geoLocation?.city || '',
          log.method || '',
          log.url || ''
        ];
        csvLines.push(row.join(','));
      }
      
      return csvLines.join('\n');
    }
    
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Чисти старе логове старије од наведеног периода
   */
  async cleanupOldLogs(maxAge: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    const initialCount = this.logs.length;
    
    // Уклони из меморије
    this.logs = this.logs.filter(log => log.timestamp > cutoffDate);
    
    const removedCount = initialCount - this.logs.length;
    
    if (removedCount > 0) {
      console.log(`🧹 Уклоњено ${removedCount} застарелих audit логова (старијих од ${maxAge} дана)`);
    }
    
    return removedCount;
  }
}

// Експортуј singleton инстанцу
export const auditService = new AuditService();
export default auditService; 