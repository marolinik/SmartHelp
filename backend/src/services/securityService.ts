import fs from 'fs';
import path from 'path';
import ipaddr from 'ipaddr.js';
import { Request } from 'express';

/**
 * Интерфејс за rate limit правила
 */
interface RateLimitRule {
  windowMs: number;     // Временски прозор у милисекундама
  maxRequests: number;  // Максимални број захтева
  message: string;      // Порука при прекорачењу
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Интерфејс за IP whitelist правило
 */
interface IPWhitelistRule {
  ip: string;           // IP адреса или CIDR блок
  description: string;  // Опис правила
  enabled: boolean;     // Да ли је правило активно
  createdAt: Date;     // Када је креирано
  expiresAt?: Date;    // Када истиче (опционо)
}

/**
 * Интерфејс за IP blacklist правило
 */
interface IPBlacklistRule {
  ip: string;
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Интерфејс за статистике rate limit-а
 */
interface RateLimitStats {
  ip: string;
  requestCount: number;
  firstRequest: Date;
  lastRequest: Date;
  blockedCount: number;
}

/**
 * Сервис за управљање безбедносним мерама - IP whitelisting, rate limiting итд.
 */
class SecurityService {
  private ipWhitelist: IPWhitelistRule[];
  private ipBlacklist: IPBlacklistRule[];
  private rateLimitStats: Map<string, RateLimitStats>;
  private configPath: string;
  private readonly defaultRateLimits: Record<string, RateLimitRule>;

  constructor() {
    this.ipWhitelist = [];
    this.ipBlacklist = [];
    this.rateLimitStats = new Map();
    this.configPath = path.join(process.cwd(), 'config', 'security.json');
    
    // Подразумеване rate limit конфигурације
    this.defaultRateLimits = {
      // Општи API rate limit
      general: {
        windowMs: 15 * 60 * 1000, // 15 минута
        maxRequests: 100,          // 100 захтева
        message: 'Превише захтева. Покушајте поново за 15 минута.',
        skipSuccessfulRequests: false
      },
      
      // Логин rate limit (строжији)
      login: {
        windowMs: 15 * 60 * 1000, // 15 минута  
        maxRequests: 5,            // Само 5 покушаја
        message: 'Превише покушаја пријаве. Покушајте поново за 15 минута.',
        skipSuccessfulRequests: true,
        skipFailedRequests: false
      },
      
      // API rate limit за непријављене кориснике
      anonymous: {
        windowMs: 60 * 1000,      // 1 минут
        maxRequests: 20,          // 20 захтева
        message: 'Ограничен приступ за непријављене кориснике. Пријавите се за више могућности.',
        skipSuccessfulRequests: false
      },
      
      // Strict rate limit за осетљиве операције
      sensitive: {
        windowMs: 60 * 60 * 1000, // 1 сат
        maxRequests: 10,          // Само 10 захтева
        message: 'Достигнуто је ограничење за осетљиве операције. Покушајте поново за 1 сат.',
        skipSuccessfulRequests: false
      }
    };

    this.loadConfiguration();
    this.startCleanupTask();
  }

  /**
   * Учитава конфигурацију из фајла
   */
  private loadConfiguration(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        
        this.ipWhitelist = config.ipWhitelist?.map((rule: any) => ({
          ...rule,
          createdAt: new Date(rule.createdAt),
          expiresAt: rule.expiresAt ? new Date(rule.expiresAt) : undefined
        })) || [];
        
        this.ipBlacklist = config.ipBlacklist?.map((rule: any) => ({
          ...rule,
          blockedAt: new Date(rule.blockedAt),
          expiresAt: rule.expiresAt ? new Date(rule.expiresAt) : undefined
        })) || [];
        
        console.log(`✅ Учитана security конфигурација: ${this.ipWhitelist.length} whitelist, ${this.ipBlacklist.length} blacklist правила`);
      } else {
        console.log('📝 Креирање default security конфигурације...');
        this.createDefaultConfiguration();
      }
    } catch (error) {
      console.error('❌ Грешка при учитавању security конфигурације:', error);
      this.createDefaultConfiguration();
    }
  }

  /**
   * Креира подразумевану конфигурацију
   */
  private createDefaultConfiguration(): void {
    // Додај localhost и приватне IP адресе у whitelist
    this.ipWhitelist = [
      {
        ip: '127.0.0.1',
        description: 'Localhost IPv4',
        enabled: true,
        createdAt: new Date()
      },
      {
        ip: '::1',
        description: 'Localhost IPv6',
        enabled: true,
        createdAt: new Date()
      },
      {
        ip: '192.168.0.0/16',
        description: 'Приватна мрежа - Class C',
        enabled: true,
        createdAt: new Date()
      },
      {
        ip: '10.0.0.0/8',
        description: 'Приватна мрежа - Class A',
        enabled: true,
        createdAt: new Date()
      }
    ];

    this.ipBlacklist = [];
    this.saveConfiguration();
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

      const config = {
        ipWhitelist: this.ipWhitelist,
        ipBlacklist: this.ipBlacklist,
        lastUpdated: new Date()
      };

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log('💾 Security конфигурација је сачувана');
    } catch (error) {
      console.error('❌ Грешка при чувању security конфигурације:', error);
    }
  }

  /**
   * Добија IP адресу из request-а
   */
  getClientIP(req: Request): string {
    // Провери различите заглавља за прави IP
    const forwarded = req.get('x-forwarded-for');
    const realIP = req.get('x-real-ip');
    const clientIP = req.get('x-client-ip');
    
    if (forwarded) {
      // X-Forwarded-For може да садржи више IP адреса
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) return realIP;
    if (clientIP) return clientIP;
    
    // Fallback на connection IP
    return req.socket.remoteAddress || req.ip || '0.0.0.0';
  }

  /**
   * Проверава да ли је IP адреса у whitelist-у
   */
  isIPWhitelisted(ip: string): boolean {
    try {
      const now = new Date();
      
      for (const rule of this.ipWhitelist) {
        if (!rule.enabled) continue;
        
        // Провери да ли је правило истекло
        if (rule.expiresAt && rule.expiresAt < now) continue;
        
        // Провери да ли IP одговара правилу
        if (this.matchesIPRule(ip, rule.ip)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Грешка при провери IP whitelist-а:', error);
      return false; // Безбедно - блокирај ако није сигурно
    }
  }

  /**
   * Проверава да ли је IP адреса у blacklist-у
   */
  isIPBlacklisted(ip: string): { blocked: boolean; rule?: IPBlacklistRule } {
    try {
      const now = new Date();
      
      for (const rule of this.ipBlacklist) {
        // Провери да ли је правило истекло
        if (rule.expiresAt && rule.expiresAt < now) continue;
        
        if (this.matchesIPRule(ip, rule.ip)) {
          return { blocked: true, rule };
        }
      }
      
      return { blocked: false };
    } catch (error) {
      console.error('❌ Грешка при провери IP blacklist-а:', error);
      return { blocked: false };
    }
  }

  /**
   * Проверава да ли IP одговара правилу (поддржава CIDR нотацију)
   */
  private matchesIPRule(ip: string, rule: string): boolean {
    try {
      // Ако је правило тачна IP адреса
      if (ip === rule) return true;
      
      // Ако правило садржи CIDR нотацију
      if (rule.includes('/')) {
        const parts = rule.split('/');
        const network = parts[0];
        const prefixLength = parts[1];
        
        if (!network || !prefixLength) return false;
        
        const addr = ipaddr.process(ip);
        const networkAddr = ipaddr.process(network);
        
        if (addr.kind() === networkAddr.kind()) {
          return addr.match(networkAddr, parseInt(prefixLength));
        }
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Грешка при провери IP правила ${rule} за ${ip}:`, error);
      return false;
    }
  }

  /**
   * Додаје IP у whitelist
   */
  addToWhitelist(ip: string, description: string, expiresAt?: Date): void {
    const rule: IPWhitelistRule = {
      ip,
      description,
      enabled: true,
      createdAt: new Date()
    };
    
    if (expiresAt) {
      rule.expiresAt = expiresAt;
    }
    
    this.ipWhitelist.push(rule);
    this.saveConfiguration();
    
    console.log(`➕ Додата IP адреса у whitelist: ${ip} - ${description}`);
  }

  /**
   * Додаје IP у blacklist
   */
  addToBlacklist(ip: string, reason: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium', expiresAt?: Date): void {
    const rule: IPBlacklistRule = {
      ip,
      reason,
      severity,
      blockedAt: new Date()
    };
    
    if (expiresAt) {
      rule.expiresAt = expiresAt;
    }
    
    this.ipBlacklist.push(rule);
    this.saveConfiguration();
    
    console.log(`🚫 Додата IP адреса у blacklist: ${ip} - ${reason} (${severity})`);
  }

  /**
   * Уклања IP из whitelist-а
   */
  removeFromWhitelist(ip: string): boolean {
    const initialLength = this.ipWhitelist.length;
    this.ipWhitelist = this.ipWhitelist.filter(rule => rule.ip !== ip);
    
    if (this.ipWhitelist.length < initialLength) {
      this.saveConfiguration();
      console.log(`➖ Уклоњена IP адреса из whitelist-а: ${ip}`);
      return true;
    }
    
    return false;
  }

  /**
   * Уклања IP из blacklist-а
   */
  removeFromBlacklist(ip: string): boolean {
    const initialLength = this.ipBlacklist.length;
    this.ipBlacklist = this.ipBlacklist.filter(rule => rule.ip !== ip);
    
    if (this.ipBlacklist.length < initialLength) {
      this.saveConfiguration();
      console.log(`➖ Уклоњена IP адреса из blacklist-а: ${ip}`);
      return true;
    }
    
    return false;
  }

  /**
   * Добија rate limit правило по имену
   */
  getRateLimitRule(ruleName: string): RateLimitRule | undefined {
    return this.defaultRateLimits[ruleName];
  }

  /**
   * Ажурира rate limit статистике
   */
  updateRateLimitStats(ip: string, blocked: boolean = false): void {
    const now = new Date();
    const existing = this.rateLimitStats.get(ip);
    
    if (existing) {
      existing.requestCount++;
      existing.lastRequest = now;
      if (blocked) existing.blockedCount++;
    } else {
      this.rateLimitStats.set(ip, {
        ip,
        requestCount: 1,
        firstRequest: now,
        lastRequest: now,
        blockedCount: blocked ? 1 : 0
      });
    }
  }

  /**
   * Добија rate limit статистике за IP
   */
  getRateLimitStats(ip: string): RateLimitStats | undefined {
    return this.rateLimitStats.get(ip);
  }

  /**
   * Добија све rate limit статистике
   */
  getAllRateLimitStats(): RateLimitStats[] {
    return Array.from(this.rateLimitStats.values());
  }

  /**
   * Чисти застареле записе
   */
  private startCleanupTask(): void {
    // Покрени cleanup сваких 30 минута
    setInterval(() => {
      this.cleanupExpiredRules();
      this.cleanupOldStats();
    }, 30 * 60 * 1000);
  }

  /**
   * Уклања истекла правила
   */
  private cleanupExpiredRules(): void {
    const now = new Date();
    
    const initialWhitelistCount = this.ipWhitelist.length;
    this.ipWhitelist = this.ipWhitelist.filter(rule => !rule.expiresAt || rule.expiresAt > now);
    
    const initialBlacklistCount = this.ipBlacklist.length;
    this.ipBlacklist = this.ipBlacklist.filter(rule => !rule.expiresAt || rule.expiresAt > now);
    
    const removedWhitelist = initialWhitelistCount - this.ipWhitelist.length;
    const removedBlacklist = initialBlacklistCount - this.ipBlacklist.length;
    
    if (removedWhitelist > 0 || removedBlacklist > 0) {
      this.saveConfiguration();
      console.log(`🧹 Cleanup: Уклоњено ${removedWhitelist} whitelist и ${removedBlacklist} blacklist правила`);
    }
  }

  /**
   * Уклања старе статистике
   */
  private cleanupOldStats(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 сата
    
    let removed = 0;
    for (const [ip, stats] of this.rateLimitStats.entries()) {
      if (now.getTime() - stats.lastRequest.getTime() > maxAge) {
        this.rateLimitStats.delete(ip);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`🧹 Cleanup: Уклоњено ${removed} застарелих rate limit статистика`);
    }
  }

  /**
   * Добија безбедносни извештај
   */
  getSecurityReport(): any {
    return {
      timestamp: new Date(),
      whitelist: {
        total: this.ipWhitelist.length,
        active: this.ipWhitelist.filter(r => r.enabled && (!r.expiresAt || r.expiresAt > new Date())).length
      },
      blacklist: {
        total: this.ipBlacklist.length,
        active: this.ipBlacklist.filter(r => !r.expiresAt || r.expiresAt > new Date()).length
      },
      rateLimitStats: {
        totalIPs: this.rateLimitStats.size,
        totalRequests: Array.from(this.rateLimitStats.values()).reduce((sum, stats) => sum + stats.requestCount, 0),
        totalBlocked: Array.from(this.rateLimitStats.values()).reduce((sum, stats) => sum + stats.blockedCount, 0)
      }
    };
  }
}

// Експортуј singleton инстанцу
export const securityService = new SecurityService();
export default securityService; 