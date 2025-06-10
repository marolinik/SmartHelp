import { Request, Response, NextFunction } from 'express';

/**
 * Интерфејс за аутентификовани захтев са корисничким подацима
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
 * Middleware за проверу администраторских привилегија
 * Мора се користити након authMiddleware
 */
export const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    // Провери да ли је корисник аутентификован
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Нисте пријављени',
        message: 'Потребна је пријава за приступ овом ресурсу'
      });
      return;
    }

    // Провери да ли корисник има админ улогу
    if (req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Немате дозволу',
        message: 'Само администратори могу приступити овом ресурсу'
      });
      return;
    }

    // Ако је све у реду, настави са следећим middleware
    next();
    
  } catch (error) {
    console.error('❌ Грешка у admin middleware:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до неочекиване грешке при провери дозвола'
    });
  }
};

/**
 * Middleware за проверу улоге администратора или агента
 * Дозвољава приступ и админима и агентима
 */
export const staffMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    // Провери да ли је корисник аутентификован
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Нисте пријављени',
        message: 'Потребна је пријава за приступ овом ресурсу'
      });
      return;
    }

    // Провери да ли корисник има админ или agent улогу
    const allowedRoles = ['admin', 'agent'];
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Немате дозволу',
        message: 'Само администратори и агенти могу приступити овом ресурсу'
      });
      return;
    }

    // Ако је све у реду, настави са следећим middleware
    next();
    
  } catch (error) {
    console.error('❌ Грешка у staff middleware:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до неочекиване грешке при провери дозвола'
    });
  }
};

export default adminMiddleware; 