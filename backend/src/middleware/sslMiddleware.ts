import { Request, Response, NextFunction } from 'express';
import sslService from '../services/sslService';

/**
 * Middleware за принуђавање HTTPS комуникације
 * Редирекује HTTP захтеве на HTTPS у production окружењу
 */
export const forceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
  // У development окружењу, дозволи и HTTP и HTTPS
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Провери различите заглавља која могу да укажу на HTTPS
  const isSecure = req.secure || 
                   req.get('x-forwarded-proto') === 'https' ||
                   req.get('x-forwarded-ssl') === 'on' ||
                   req.get('x-forwarded-scheme') === 'https';

  if (!isSecure) {
    const redirectURL = `https://${req.get('host')}${req.url}`;
    console.log(`🔒 Редирекција HTTP → HTTPS: ${req.url} → ${redirectURL}`);
    return res.status(301).redirect(redirectURL);
  }

  next();
};

/**
 * Middleware за додавање безбедносних заглавља
 * Додаје HSTS, CSP, и друга безбедносна заглавља
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  const headers = sslService.getSecurityHeaders();
  
  // Додај безбедносна заглавља
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Додај српско пријатељско заглавље
  res.setHeader('X-Powered-By', 'Smart Help Desk PIO - Безбедан IT Систем');
  
  // Уклони Express заглавље из безбедносних разлога
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Middleware за HSTS (HTTP Strict Transport Security)
 * Принуђава браузере да користе HTTPS за будуће захтеве
 */
export const hstsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Додај HSTS заглавље само за HTTPS захтеве
  if (req.secure || req.get('x-forwarded-proto') === 'https') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  next();
};

/**
 * Middleware за провери SSL конфигурације и статуса
 * Додаје информације о SSL-у у response заглавља (само development)
 */
export const sslStatusMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'development') {
    const certInfo = sslService.getCertificateInfo();
    
    // Додај SSL статус заглавља за debugging
    res.setHeader('X-SSL-Certificate-Exists', certInfo.exists.toString());
    res.setHeader('X-SSL-Certificate-Valid', certInfo.validation.valid.toString());
    
    if (certInfo.validation.valid && certInfo.validation.details.daysUntilExpiry) {
      res.setHeader('X-SSL-Days-Until-Expiry', certInfo.validation.details.daysUntilExpiry.toString());
    }
  }

  next();
};

/**
 * Middleware за Content Security Policy (CSP)
 * Конфигурише детаљну CSP политику за апликацију
 */
export const cspMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const cspPolicies = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // За React development
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' https:",
    "connect-src 'self' ws: wss: https:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ];

  // У development окружењу, ослаби CSP за HMR и debugging
  if (process.env.NODE_ENV === 'development') {
    cspPolicies[1] = "script-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* 127.0.0.1:*";
    cspPolicies[4] = "connect-src 'self' ws: wss: https: http://localhost:* http://127.0.0.1:*";
  }

  res.setHeader('Content-Security-Policy', cspPolicies.join('; '));
  next();
};

/**
 * Middleware за заштиту од клик-јекинга
 * Конфигурише X-Frame-Options заглавље
 */
export const antiClickjackingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Дозволи iframe само са истог домена у development
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  } else {
    res.setHeader('X-Frame-Options', 'DENY');
  }

  next();
};

/**
 * Middleware за заштиту од MIME снифовања
 * Принуђава браузере да поштују Content-Type заглавље
 */
export const noSniffMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
};

/**
 * Middleware за XSS заштиту
 * Активира уграђену XSS заштиту браузера
 */
export const xssProtectionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

/**
 * Middleware за Referrer Policy
 * Контролише које информације се шаљу у Referer заглављу
 */
export const referrerPolicyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};

/**
 * Комбиновани SSL middleware који примењује све безбедносне мере
 * Користи се као главни SSL middleware у апликацији
 */
export const combinedSSLMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Редослед је важан - прво принуди HTTPS, затим додај заглавља
  forceHTTPS(req, res, (err?: any) => {
    if (err) return next(err);
    
    securityHeaders(req, res, (err?: any) => {
      if (err) return next(err);
      
      hstsMiddleware(req, res, (err?: any) => {
        if (err) return next(err);
        
        sslStatusMiddleware(req, res, (err?: any) => {
          if (err) return next(err);
          next();
        });
      });
    });
  });
};

/**
 * Middleware за логовање SSL статуса
 * Бележи информације о SSL кертификатима и безбедности
 */
export const sslLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'development') {
    const protocol = req.secure ? 'HTTPS' : 'HTTP';
    const userAgent = req.get('User-Agent') || 'Непознат';
    
    console.log(`🔐 SSL Request: ${protocol} ${req.method} ${req.url} | ${userAgent.substring(0, 50)}...`);
    
    // Провери SSL статус једном дневно
    const now = new Date();
    const lastCheck = (global as any).lastSSLCheck;
    
    if (!lastCheck || now.getTime() - lastCheck > 24 * 60 * 60 * 1000) {
      const certInfo = sslService.getCertificateInfo();
      if (certInfo.validation.valid && certInfo.validation.details) {
        const daysLeft = certInfo.validation.details.daysUntilExpiry;
        console.log(`📜 SSL Сертификат: важи још ${daysLeft} дана`);
        
        if (daysLeft < 30) {
          console.warn(`⚠️  УПОЗОРЕЊЕ: SSL сертификат истиче за ${daysLeft} дана!`);
        }
      }
      
      (global as any).lastSSLCheck = now.getTime();
    }
  }

  next();
}; 