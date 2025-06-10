import { Request, Response, NextFunction } from 'express';
import intrusionDetectionService, { DetectedThreat, ThreatLevel } from '../services/intrusionDetectionService';

/**
 * Интерфејс за аутентификовани захтев
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
 * Главни IDS middleware који анализира сваки HTTP захтев за претње
 */
export const idsAnalysisMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Анализирај захтев за претње
    const detectedThreats = await intrusionDetectionService.analyzeRequest(req);
    
    // Ако има детектованих претњи, обради их
    if (detectedThreats.length > 0) {
      // Провери да ли неки од претњи блокира захтев
      const blockingThreats = detectedThreats.filter(threat => threat.blocked);
      
      if (blockingThreats.length > 0) {
        const highestThreat = blockingThreats.reduce((highest, current) => 
          getThreatLevelWeight(current.threatLevel) > getThreatLevelWeight(highest.threatLevel) 
            ? current 
            : highest
        );
        
        // Блокирај захтев
        res.status(403).json({
          error: 'Безбедносна претња детектована',
          message: 'Ваш захтев је блокиран због детектоване безбедносне претње.',
          threatType: highestThreat.threatType,
          threatDescription: highestThreat.description,
          threatId: highestThreat.id,
          timestamp: new Date().toISOString(),
          contact: 'Ако мислите да је ово грешка, контактирајте администратора система.'
        });
        
        console.log(`🛑 [IDS] Блокиран захтев због претње: ${highestThreat.description} од ${highestThreat.sourceIP}`);
        return;
      }
      
      // Ако нема блокирајућих претњи, додај информације о детекцији у response заглавља (само development)
      if (process.env.NODE_ENV === 'development') {
        res.setHeader('X-IDS-Threats-Detected', detectedThreats.length.toString());
        res.setHeader('X-IDS-Highest-Level', getHighestThreatLevel(detectedThreats));
      }
    }
    
    next();
    
  } catch (error) {
    console.error('❌ Грешка у IDS middleware:', error);
    // Не блокирај захтев због грешке у IDS-у, само настави
    next();
  }
};

/**
 * Middleware специјално за заштићене rute-ове (admin панел итд.)
 */
export const idsProtectedRouteMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Строжа анализа за заштићене rute-ове
    const detectedThreats = await intrusionDetectionService.analyzeRequest(req);
    
    if (detectedThreats.length > 0) {
      // За заштићене rute-ове, блокирај чак и за ниже претње
      const mediumOrHigherThreats = detectedThreats.filter(threat => 
        threat.threatLevel === ThreatLevel.MEDIUM || 
        threat.threatLevel === ThreatLevel.HIGH || 
        threat.threatLevel === ThreatLevel.CRITICAL
      );
      
      if (mediumOrHigherThreats.length > 0) {
        const threat = mediumOrHigherThreats[0];
        
        res.status(403).json({
          error: 'Неовлашћен приступ',
          message: 'Приступ заштићеном ресурсу је одбијен због безбедносних разлога.',
          timestamp: new Date().toISOString()
        });
        
        console.log(`🔒 [IDS] Блокиран приступ заштићеном ресурсу: ${req.path} од ${threat.sourceIP}`);
        return;
      }
    }
    
    next();
    
  } catch (error) {
    console.error('❌ Грешка у IDS заштићеном middleware:', error);
    next();
  }
};

/**
 * Middleware за real-time мониторинг претњи
 */
export const idsMonitoringMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Додај listener за завршетак захтева
  res.on('finish', () => {
    // Ако је response статус указивао на проблем, логуј додатне информације
    if (res.statusCode >= 400) {
      const statusMessage = getStatusMessage(res.statusCode);
      console.log(`📊 [IDS Monitor] ${res.statusCode} ${statusMessage} - ${req.method} ${req.path} - IP: ${req.ip}`);
    }
  });

  next();
};

/**
 * Middleware за блокирање IP адреса које се налазе у blacklist-у
 */
export const idsBlacklistMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Овај middleware ће користити постојећи securityService за IP провере
  // који је већ интегрисан у rateLimitMiddleware
  // Овде можемо додати додатне IDS-специфичне провере
  
  next();
};

/**
 * Middleware за статистике и извештавање
 */
export const idsStatsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Прикупљај основне статистике о саобраћају
  const userAgent = req.get('User-Agent') || 'Unknown';
  const isBot = /bot|crawler|spider|scraper/i.test(userAgent);
  
  if (isBot && process.env.NODE_ENV === 'development') {
    console.log(`🤖 [IDS Stats] Bot детектован: ${userAgent.substring(0, 50)}... на ${req.path}`);
  }

  next();
};

/**
 * Помоћне функције
 */

/**
 * Добија тежину нивоа претње за поређење
 */
function getThreatLevelWeight(level: ThreatLevel): number {
  switch (level) {
    case ThreatLevel.LOW: return 1;
    case ThreatLevel.MEDIUM: return 2;
    case ThreatLevel.HIGH: return 3;
    case ThreatLevel.CRITICAL: return 4;
    default: return 0;
  }
}

/**
 * Добија највиши ниво претње из листе претњи
 */
function getHighestThreatLevel(threats: DetectedThreat[]): string {
  if (threats.length === 0) return 'NONE';
  
  const highest = threats.reduce((highest, current) => 
    getThreatLevelWeight(current.threatLevel) > getThreatLevelWeight(highest.threatLevel) 
      ? current 
      : highest
  );
  
  return highest.threatLevel;
}

/**
 * Добија поруку за HTTP статус код
 */
function getStatusMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden', 
    404: 'Not Found',
    405: 'Method Not Allowed',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  
  return messages[statusCode] || 'Unknown';
}

/**
 * Middleware stacks за различите сценарије
 */

/**
 * Основни IDS middleware stack за све rute-ове
 */
export const basicIDSMiddleware = [
  idsStatsMiddleware,
  idsMonitoringMiddleware,
  idsAnalysisMiddleware
];

/**
 * Напредни IDS middleware stack за заштићене rute-ове
 */
export const advancedIDSMiddleware = [
  idsStatsMiddleware,
  idsMonitoringMiddleware,
  idsProtectedRouteMiddleware,
  idsAnalysisMiddleware
];

/**
 * Главни IDS middleware који се може користити као default
 */
export default idsAnalysisMiddleware; 