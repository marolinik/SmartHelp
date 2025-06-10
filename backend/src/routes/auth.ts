import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/authService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { messages } from '../config/config.js';
import { logger } from '../utils/logger.js';

const router = Router();
const authService = new AuthService();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минута
  max: 5, // maksimalno 5 покушаја по IP адреси
  message: {
    error: 'Превише покушаја пријаве. Покушајте поново за 15 минута.',
    code: 'TOO_MANY_LOGIN_ATTEMPTS'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules for login
const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage(messages.validation.required)
    .isLength({ min: 3 })
    .withMessage(messages.validation.usernameMinLength)
    .matches(/^[a-zA-Z0-9_.]+$/)
    .withMessage(messages.validation.usernameInvalid),
  
  body('password')
    .notEmpty()
    .withMessage(messages.validation.required)
    .isLength({ min: 1 })
    .withMessage('Лозинка је обавезна'),
];

// Validation error handler
const handleValidationErrors = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
    }));

    res.status(400).json({
      error: messages.errors.validationError,
      message: 'Подаци нису исправни',
      details: errorMessages,
      code: 'VALIDATION_ERROR'
    });
    return;
  }
  next();
};

// POST /api/auth/login - Пријава корисника
router.post('/login', authLimiter, loginValidation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'неупозната IP';

    logger.info(`🔐 Покушај пријаве за корисника: ${username} са IP: ${ip}`);

    const result = await authService.login({ username, password, ip });

    if (!result.success) {
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: result.message,
        code: 'LOGIN_FAILED'
      });
      return;
    }

    // Remove sensitive data from user object
    const { user, token, refreshToken } = result;
    const safeUser = {
      id: user!.id,
      username: user!.username,
      email: user!.email,
      firstName: user!.firstName,
      lastName: user!.lastName,
      displayName: user!.displayName,
      department: user!.department,
      role: {
        id: user!.role.id,
        name: user!.role.name,
        displayName: user!.role.displayName,
        permissions: user!.role.permissions,
      }
    };

    res.status(200).json({
      success: true,
      message: result.message,
      user: safeUser,
      token,
      refreshToken,
      expiresIn: '24h'
    });

  } catch (error) {
    logger.error('Грешка при пријави корисника:', error);
    res.status(500).json({
      error: messages.errors.serverError,
      message: 'Дошло је до грешке при пријави',
      code: 'LOGIN_ERROR'
    });
  }
});

// POST /api/auth/refresh - Обнављање токена
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        error: messages.errors.validationError,
        message: 'Refresh токен је обавезан',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
      return;
    }

    const result = await authService.refreshToken(refreshToken);

    if (!result.success) {
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: result.message,
        code: 'REFRESH_FAILED'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: result.message,
      token: result.token,
      refreshToken: result.refreshToken,
      expiresIn: '24h'
    });

  } catch (error) {
    logger.error('Грешка при обнављању токена:', error);
    res.status(500).json({
      error: messages.errors.serverError,
      message: 'Дошло је до грешке при обнављању токена',
      code: 'REFRESH_ERROR'
    });
  }
});

// POST /api/auth/logout - Одјава корисника
router.post('/logout', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'неупозната IP';
    const username = req.user?.username || 'непознат корисник';

    await authService.logout(username, ip);

    res.status(200).json({
      success: true,
      message: messages.auth.logoutSuccess,
      code: 'LOGOUT_SUCCESS'
    });

  } catch (error) {
    logger.error('Грешка при одјави корисника:', error);
    res.status(500).json({
      error: messages.errors.serverError,
      message: 'Дошло је до грешке при одјави',
      code: 'LOGOUT_ERROR'
    });
  }
});

// GET /api/auth/profile - Подаци о кориснику
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: messages.auth.tokenInvalid,
        code: 'USER_NOT_AUTHENTICATED'
      });
      return;
    }

    const safeUser = {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      displayName: req.user.displayName,
      department: req.user.department,
      isActive: req.user.isActive,
      lastLogin: req.user.lastLogin,
      role: {
        id: req.user.role.id,
        name: req.user.role.name,
        displayName: req.user.role.displayName,
        permissions: req.user.role.permissions,
      }
    };

    res.status(200).json({
      success: true,
      message: 'Подаци о кориснику',
      user: safeUser
    });

  } catch (error) {
    logger.error('Грешка при добијању података о кориснику:', error);
    res.status(500).json({
      error: messages.errors.serverError,
      message: 'Дошло је до грешке при учитавању профила',
      code: 'PROFILE_ERROR'
    });
  }
});

// POST /api/auth/change-password - Промена лозинке
router.post('/change-password', [
  body('oldPassword')
    .notEmpty()
    .withMessage('Стара лозинка је обавезна'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage(messages.validation.passwordMinLength)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(messages.validation.passwordComplexity),
], handleValidationErrors, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: messages.auth.tokenInvalid,
        code: 'USER_NOT_AUTHENTICATED'
      });
      return;
    }

    const { oldPassword, newPassword } = req.body;

    const result = await authService.changePassword(req.user.id, oldPassword, newPassword);

    if (!result.success) {
      res.status(400).json({
        error: messages.errors.validationError,
        message: result.message,
        code: 'PASSWORD_CHANGE_FAILED'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: result.message,
      code: 'PASSWORD_CHANGED'
    });

  } catch (error) {
    logger.error('Грешка при промени лозинке:', error);
    res.status(500).json({
      error: messages.errors.serverError,
      message: 'Дошло је до грешке при промени лозинке',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

// GET /api/auth/check - Провера валидности токена
router.get('/check', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        valid: false,
        message: messages.auth.tokenInvalid,
        code: 'TOKEN_INVALID'
      });
      return;
    }

    res.status(200).json({
      valid: true,
      message: 'Токен је важећи',
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role.name,
      },
      code: 'TOKEN_VALID'
    });

  } catch (error) {
    logger.error('Грешка при провери токена:', error);
    res.status(500).json({
      valid: false,
      message: 'Дошло је до грешке при провери токена',
      code: 'TOKEN_CHECK_ERROR'
    });
  }
});

export default router; 