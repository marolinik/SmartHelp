import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response, NextFunction } from 'express';
import securityService from '../services/securityService';

/**
 * Базни rate limiting middleware који користи security сервис
 * @param ruleName - Име правила из security сервиса  
 * @param customKeyGenerator - Опциони custom key generator
 */
export const createRateLimiter = (
  ruleName: string = 'general',
  customKeyGenerator?: (req: Request) => string
) => {
  return rateLimit({
    windowMs: () => {
      const rule = securityService.getRateLimitRule(ruleName);
      return rule?.windowMs || 15 * 60 * 1000; // default 15 min
    },
    
    max: () => {
      const rule = securityService.getRateLimitRule(ruleName);
      return rule?.maxRequests || 100; // default 100 requests
    },
    
    message: (req: Request) => {
      const rule = securityService.getRateLimitRule(ruleName);
      return {
        error: 'Rate limit exceeded',
        message: rule?.message || 'Превише захтева. Покушајте поново касније.',
        type: 'rate_limit_exceeded',
        ruleName: ruleName,
        ip: securityService.getClientIP(req),
        retryAfter: Math.ceil((rule?.windowMs || 15 * 60 * 1000) / 1000)
      };
    },
    
    keyGenerator: customKeyGenerator || ((req: Request) => {
      return securityService.getClientIP(req);
    }),
    
    onLimitReached: (req: Request, res: Response) => {
      const clientIP = securityService.getClientIP(req);
      securityService.updateRateLimitStats(clientIP, true);
      
      console.warn(`⚠️  Rate limit достигнут за ${clientIP} на ${req.path} (правило: ${ruleName})`);
      
      // Логовање за audit trail
      console.log(`🚫 [RATE_LIMIT] IP: ${clientIP}, Path: ${req.path}, Rule: ${ruleName}, User-Agent: ${req.get('User-Agent')}`);
    },
    
    skip: (req: Request) => {
      const clientIP = securityService.getClientIP(req);
      
      // Провери да ли је IP у blacklist-у
      const blacklistCheck = securityService.isIPBlacklisted(clientIP);
      if (blacklistCheck.blocked) {
        // Не примењујемо rate limit већ ћемо га одбацити у IP middleware
        return true;
      }
      
      // Провери да ли је IP у whitelist-у (whitelist корисници имају мањe ограничења)
      const isWhitelisted = securityService.isIPWhitelisted(clientIP);
      if (isWhitelisted) {
        // За whitelist кориснике, користи блажа ограничења
        return false; // Ипак примени rate limit, али са другачијим правилима
      }
      
      return false; // Примени стандардни rate limit
    },
    
    skipSuccessfulRequests: () => {
      const rule = securityService.getRateLimitRule(ruleName);
      return rule?.skipSuccessfulRequests || false;
    },
    
    skipFailedRequests: () => {
      const rule = securityService.getRateLimitRule(ruleName);
      return rule?.skipFailedRequests || false;
    },
    
    // Стандардни заглавља за rate limit информације
    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * General API rate limiter
 */
export const generalRateLimit = createRateLimiter('general');

/**
 * Login rate limiter - строжији за аутентификацију
 */
export const loginRateLimit = createRateLimiter('login', (req: Request) => {
  // Комбинује IP + username за login attempts
  const ip = securityService.getClientIP(req);
  const username = req.body?.username || req.body?.email || 'unknown';
  return `${ip}:${username}`;
});

/**
 * Anonymous rate limiter - за непријављене кориснике
 */
export const anonymousRateLimit = createRateLimiter('anonymous');

/**
 * Sensitive operations rate limiter
 */
export const sensitiveRateLimit = createRateLimiter('sensitive');

/**
 * Slow down middleware - постепено успорава захтеве уместо блокирања
 */
export const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 минута
  delayAfter: 50,           // Успорава након 50 захтева
  delayMs: 500,             // Почетно кашњење од 500ms
  maxDelayMs: 10000,        // Максимално кашњење од 10 секунди
  skipSuccessfulRequests: true,
  
  keyGenerator: (req: Request) => {
    return securityService.getClientIP(req);
  },
  
  skip: (req: Request) => {
    const clientIP = securityService.getClientIP(req);
    
    // Прескачи slow down за whitelist кориснике
    return securityService.isIPWhitelisted(clientIP);
  },
  
  onLimitReached: (req: Request) => {
    const clientIP = securityService.getClientIP(req);
    console.warn(`🐌 Slow down активиран за ${clientIP} на ${req.path}`);
  }
});

/**
 * IP whitelisting и blacklisting middleware
 */
export const ipSecurityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const clientIP = securityService.getClientIP(req);
  
  // Провери blacklist прво
  const blacklistCheck = securityService.isIPBlacklisted(clientIP);
  if (blacklistCheck.blocked) {
    const rule = blacklistCheck.rule;
    
    console.warn(`🚫 [IP_BLOCKED] Заблокиран IP: ${clientIP}, Разлог: ${rule?.reason}, Озбиљност: ${rule?.severity}`);
    
    res.status(403).json({
      error: 'IP Blocked',
      message: 'Ваша IP адреса је блокирана.',
      reason: rule?.reason || 'Неодобрена активност',
      severity: rule?.severity || 'medium',
      contact: 'За жалбе контактирајте администратора система.'
    });
    return;
  }
  
  // Ажурирај статистике
  securityService.updateRateLimitStats(clientIP, false);
  
  // Логовање за monitoring
  if (process.env.NODE_ENV === 'development') {
    const isWhitelisted = securityService.isIPWhitelisted(clientIP);
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    console.log(`🔍 [IP_CHECK] ${clientIP} | ${isWhitelisted ? '✅ Whitelist' : '⚠️  Standard'} | ${req.method} ${req.path} | ${userAgent.substring(0, 50)}...`);
  }
  
  next();
};

/**
 * Middleware за праћење необичне активности
 */
export const suspiciousActivityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const clientIP = securityService.getClientIP(req);
  const userAgent = req.get('User-Agent') || '';
  const referer = req.get('Referer') || '';
  
  // Детектуј сумњиве pattern-е
  const suspiciousPatterns = [
    /bot|crawler|spider|scrape/i,
    /nikto|sqlmap|nmap|burp/i,
    /hack|exploit|injection/i
  ];
  
  const hasSuspiciousUserAgent = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  
  // Провери сумњиве путање
  const suspiciousPaths = [
    /\/admin/i,
    /\/wp-admin/i,
    /\.php$/i,
    /\.env$/i,
    /config\.js/i,
    /backup/i
  ];
  
  const hasSuspiciousPath = suspiciousPaths.some(pattern => pattern.test(req.path));
  
  if (hasSuspiciousUserAgent || hasSuspiciousPath) {
    console.warn(`⚠️  [SUSPICIOUS] IP: ${clientIP}, Path: ${req.path}, UA: ${userAgent.substring(0, 100)}`);
    
    // Не блокирај одмах, али логуј за анализу
    // У production окружењу, можда бисте хтели да додате у blacklist аутоматски
  }
  
  next();
};

/**
 * Middleware за заштиту од брутфорс напада на login
 */
export const bruteForceProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Ово се примењује само на login rute-ове
  if (!req.path.includes('/auth/login') && !req.path.includes('/api/login')) {
    return next();
  }
  
  const clientIP = securityService.getClientIP(req);
  const stats = securityService.getRateLimitStats(clientIP);
  
  if (stats && stats.blockedCount > 5) {
    // Ако је IP блокиран више од 5 пута за login, привремено га додај у blacklist
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 сат
    securityService.addToBlacklist(
      clientIP, 
      'Вишеструки неуспешни покушаји пријаве', 
      'high', 
      expiresAt
    );
    
    console.error(`🚨 [BRUTE_FORCE] IP ${clientIP} додат у blacklist због вишеструких неуспешних покушаја пријаве`);
    
    res.status(429).json({
      error: 'Too Many Failed Attempts',
      message: 'Превише неуспешних покушаја пријаве. Ваша IP адреса је привремено блокирана.',
      blockedUntil: expiresAt.toISOString(),
      contact: 'Контактирајте администратора ако мислите да је ово грешка.'
    });
    return;
  }
  
  next();
};

/**
 * Комбиновани security middleware stack
 */
export const securityMiddlewareStack = [
  ipSecurityMiddleware,
  suspiciousActivityMiddleware,
  slowDownMiddleware,
  generalRateLimit,
  bruteForceProtection
];

/**
 * Специјализовани middleware за auth endpoints
 */
export const authSecurityMiddleware = [
  ipSecurityMiddleware,
  suspiciousActivityMiddleware,
  loginRateLimit,
  bruteForceProtection
];

/**
 * Middleware за public API endpoints
 */
export const publicAPIMiddleware = [
  ipSecurityMiddleware,
  anonymousRateLimit,
  suspiciousActivityMiddleware
];

/**
 * Middleware за sensitive operations (admin, data export, itd.)
 */
export const sensitiveOperationsMiddleware = [
  ipSecurityMiddleware,
  sensitiveRateLimit,
  suspiciousActivityMiddleware
]; 