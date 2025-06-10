import { Request, Response, NextFunction } from 'express';
import auditService, { AuditEventType, AuditSeverity } from '../services/auditService';

/**
 * Интерфејс за корисника у request објекту
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

/**
 * Middleware за аутоматско audit logging свих HTTP захтева
 */
export const auditLoggingMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  
  // Сачувај оригиналне методе за перцепцију response-а
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;
  
  let responseBody: any = null;
  let isResponseCaptured = false;

  // Преузми response body за логовање
  res.send = function(body: any) {
    if (!isResponseCaptured) {
      responseBody = body;
      isResponseCaptured = true;
    }
    return originalSend.call(this, body);
  };

  res.json = function(body: any) {
    if (!isResponseCaptured) {
      responseBody = body;
      isResponseCaptured = true;
    }
    return originalJson.call(this, body);
  };

  res.end = function(chunk?: any, encoding?: any) {
    if (!isResponseCaptured && chunk) {
      responseBody = chunk;
      isResponseCaptured = true;
    }
    return originalEnd.call(this, chunk, encoding);
  };

  // Настави са следећим middleware
  next();

  // Након што се response заврши, логуј audit запис
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    try {
      // Одреди тип догађаја на основу route-а и методе
      const eventType = determineEventType(req);
      
      // Одреди озбиљност на основу статус кода и route-а
      const severity = determineSeverity(statusCode, req.path, req.method);
      
      // Креирај поруку на српском
      const message = createAuditMessage(req, statusCode, duration);
      
      // Додатни контекст
      const context = {
        req,
        userId: req.user?.id,
        username: req.user?.username || req.user?.email,
        userRole: req.user?.role,
        metadata: {
          duration,
          statusCode,
          userAgent: req.get('User-Agent'),
          referer: req.get('Referer'),
          contentType: req.get('Content-Type'),
          responseSize: res.get('Content-Length'),
          requestBody: shouldLogRequestBody(req) ? req.body : undefined,
          responseBody: shouldLogResponseBody(req, responseBody) ? responseBody : undefined
        }
      };

      // Логуј audit запис
      await auditService.log(eventType, severity, message, context);
      
    } catch (error) {
      console.error('❌ Грешка при audit логовању:', error);
    }
  });
};

/**
 * Одређује тип audit догађаја на основу HTTP захтева
 */
function determineEventType(req: AuthenticatedRequest): AuditEventType {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();

  // Аутентификација
  if (path.includes('/auth/login')) return AuditEventType.LOGIN_SUCCESS;
  if (path.includes('/auth/logout')) return AuditEventType.LOGOUT;
  if (path.includes('/auth/password')) return AuditEventType.PASSWORD_CHANGE;

  // Корисници
  if (path.includes('/users')) {
    if (method === 'POST') return AuditEventType.USER_CREATE;
    if (method === 'PUT' || method === 'PATCH') return AuditEventType.USER_UPDATE;
    if (method === 'DELETE') return AuditEventType.USER_DELETE;
  }

  // Тикети
  if (path.includes('/tickets')) {
    if (method === 'POST') return AuditEventType.TICKET_CREATE;
    if (method === 'PUT' || method === 'PATCH') return AuditEventType.TICKET_UPDATE;
    if (method === 'DELETE') return AuditEventType.TICKET_DELETE;
  }

  if (path.includes('/tickets') && path.includes('/assign')) {
    return AuditEventType.TICKET_ASSIGN;
  }

  if (path.includes('/tickets') && path.includes('/comments')) {
    return AuditEventType.TICKET_COMMENT_ADD;
  }

  // База знања
  if (path.includes('/kb') || path.includes('/knowledge')) {
    if (method === 'POST') return AuditEventType.KB_ARTICLE_CREATE;
    if (method === 'PUT' || method === 'PATCH') return AuditEventType.KB_ARTICLE_UPDATE;
    if (method === 'DELETE') return AuditEventType.KB_ARTICLE_DELETE;
  }

  if (path.includes('/kb') && path.includes('/publish')) {
    return AuditEventType.KB_ARTICLE_PUBLISH;
  }

  // Администрација
  if (path.includes('/admin/config')) return AuditEventType.SYSTEM_CONFIG_CHANGE;
  if (path.includes('/backup')) return AuditEventType.DATABASE_BACKUP;
  if (path.includes('/restore')) return AuditEventType.DATABASE_RESTORE;

  // Извоз података
  if (path.includes('/export')) return AuditEventType.DATA_EXPORT;
  if (path.includes('/import')) return AuditEventType.DATA_IMPORT;
  if (path.includes('/download')) return AuditEventType.DATA_DOWNLOAD;

  // Приступ осетљивим подацима
  if (path.includes('/admin') || path.includes('/reports')) {
    return AuditEventType.DATA_VIEW;
  }

  // Default - general data access
  return AuditEventType.DATA_VIEW;
}

/**
 * Одређује озбиљност на основу статус кода и типа операције
 */
function determineSeverity(statusCode: number, path: string, method: string): AuditSeverity {
  // Критично за безбедносне грешке
  if (statusCode === 401 || statusCode === 403) return AuditSeverity.CRITICAL;
  
  // Високо за системске грешке
  if (statusCode >= 500) return AuditSeverity.HIGH;
  
  // Средње за клијентске грешке
  if (statusCode >= 400) return AuditSeverity.MEDIUM;
  
  // Високо за админ операције
  if (path.includes('/admin') || path.includes('/config')) return AuditSeverity.HIGH;
  
  // Средње за DELETE операције
  if (method === 'DELETE') return AuditSeverity.MEDIUM;
  
  // Средње за креирање и ажурирање
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') return AuditSeverity.MEDIUM;
  
  // Ниско за читање
  return AuditSeverity.LOW;
}

/**
 * Креира поруку за audit log на српском језику
 */
function createAuditMessage(req: AuthenticatedRequest, statusCode: number, duration: number): string {
  const method = req.method;
  const path = req.path;
  const user = req.user?.username || req.user?.email || 'Непознат корисник';
  const status = statusCode < 400 ? 'успешно' : 'неуспешно';
  
  return `${method} захтев на ${path} је ${status} извршен (${duration}ms) од стране корисника ${user}`;
}

/**
 * Одређује да ли треба логовати тело захтева
 */
function shouldLogRequestBody(req: Request): boolean {
  // Не логуј лозинке и осетљиве податке
  if (req.path.includes('/auth/login') || req.path.includes('/password')) return false;
  
  // Логуј само POST, PUT, PATCH захтеве
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return false;
  
  // Провери величину тела
  const contentLength = parseInt(req.get('Content-Length') || '0');
  if (contentLength > 10240) return false; // Максимално 10KB
  
  return true;
}

/**
 * Одређује да ли треба логовати тело одговора
 */
function shouldLogResponseBody(req: Request, responseBody: any): boolean {
  // Не логуј за GET захтеве који враћају велике листе
  if (req.method === 'GET' && req.path.includes('/list')) return false;
  
  // Не логуј бинарне фајлове
  const contentType = req.get('Content-Type') || '';
  if (contentType.includes('image/') || contentType.includes('application/pdf')) return false;
  
  // Провери величину одговора
  if (responseBody && JSON.stringify(responseBody).length > 5120) return false; // Максимално 5KB
  
  return true;
}

/**
 * Middleware за логовање неуспешних захтева са повећаном озбиљношћу
 */
export const auditErrorMiddleware = async (
  err: any,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const message = `Серверска грешка: ${err.message || 'Непозната грешка'}`;
    
    const context = {
      req,
      userId: req.user?.id,
      username: req.user?.username || req.user?.email,
      userRole: req.user?.role,
      metadata: {
        error: err.message,
        stack: err.stack,
        statusCode: err.status || 500,
        userAgent: req.get('User-Agent')
      }
    };

    await auditService.log(
      AuditEventType.ERROR_OCCURRED,
      AuditSeverity.HIGH,
      message,
      context
    );
    
  } catch (auditError) {
    console.error('❌ Грешка при audit логовању грешке:', auditError);
  }

  next(err);
};

/**
 * Middleware за логовање безбедносних догађаја
 */
export const auditSecurityMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Провери за сумњиве pattern-е у User-Agent
  const userAgent = req.get('User-Agent') || '';
  const suspiciousPatterns = [
    /bot|crawler|spider|scraper/i,
    /nikto|sqlmap|nmap|burp|metasploit/i,
    /hack|exploit|injection|xss/i
  ];

  const hasSuspiciousUserAgent = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  
  if (hasSuspiciousUserAgent) {
    const message = `Сумњив User-Agent детектован: ${userAgent}`;
    
    const context = {
      req,
      metadata: {
        userAgent,
        suspiciousPattern: true,
        detectionReason: 'Suspicious User-Agent pattern'
      }
    };

    await auditService.log(
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditSeverity.MEDIUM,
      message,
      context
    );
  }

  // Провери за покушаје приступа забрањеним путањама
  const path = req.path.toLowerCase();
  const forbiddenPaths = [
    '/admin',
    '/.env',
    '/config',
    '/backup',
    '/database',
    '/wp-admin',
    '/phpmyadmin'
  ];

  const attemptsForbiddenAccess = forbiddenPaths.some(forbiddenPath => 
    path.includes(forbiddenPath) && !req.user
  );

  if (attemptsForbiddenAccess) {
    const message = `Покушај неовлашћеног приступа заштићеној области: ${req.path}`;
    
    const context = {
      req,
      metadata: {
        attemptedPath: req.path,
        unauthorized: true,
        detectionReason: 'Unauthorized access attempt'
      }
    };

    await auditService.log(
      AuditEventType.SECURITY_VIOLATION,
      AuditSeverity.HIGH,
      message,
      context
    );
  }

  next();
};

/**
 * Middleware за логовање аутентификације
 */
export const auditAuthMiddleware = {
  /**
   * Логује успешну пријаву
   */
  loginSuccess: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const message = `Корисник ${req.user?.username} се успешно пријавио у систем`;
    
    const context = {
      req,
      userId: req.user?.id,
      username: req.user?.username,
      userRole: req.user?.role,
      metadata: {
        loginTime: new Date(),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    };

    await auditService.log(
      AuditEventType.LOGIN_SUCCESS,
      AuditSeverity.LOW,
      message,
      context
    );

    next();
  },

  /**
   * Логује неуспешну пријаву
   */
  loginFailure: async (req: Request, res: Response, next: NextFunction) => {
    const attemptedUsername = req.body?.username || req.body?.email || 'Непознат';
    const message = `Неуспешан покушај пријаве за корисника: ${attemptedUsername}`;
    
    const context = {
      req,
      metadata: {
        attemptedUsername,
        failureTime: new Date(),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        reason: 'Invalid credentials'
      }
    };

    await auditService.log(
      AuditEventType.LOGIN_FAILURE,
      AuditSeverity.MEDIUM,
      message,
      context
    );

    next();
  },

  /**
   * Логује одјаву
   */
  logout: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const message = `Корисник ${req.user?.username} се одјавио из система`;
    
    const context = {
      req,
      userId: req.user?.id,
      username: req.user?.username,
      userRole: req.user?.role,
      metadata: {
        logoutTime: new Date(),
        sessionDuration: 'N/A' // Може се проширити са session tracking
      }
    };

    await auditService.log(
      AuditEventType.LOGOUT,
      AuditSeverity.LOW,
      message,
      context
    );

    next();
  }
};

/**
 * Комбиновани audit middleware stack
 */
export const auditMiddlewareStack = [
  auditSecurityMiddleware,
  auditLoggingMiddleware
];

export default auditLoggingMiddleware; 