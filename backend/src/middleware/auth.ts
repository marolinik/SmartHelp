import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config, messages } from '../config/config.js';
import { logger, logAuth } from '../utils/logger.js';
import { prisma } from '../database/prisma.js';

// Extend Request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: any; // Will be properly typed after Prisma client is fully set up
  token?: string;
}

// JWT payload interface
interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  roleId: string;
  iat: number;
  exp: number;
}

// Authentication middleware
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: messages.auth.tokenInvalid,
        code: 'TOKEN_MISSING'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    req.token = token;

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    
    // Get user from database with role information
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true }
    });

    if (!user) {
      logAuth.tokenExpired(decoded.username);
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: messages.auth.userNotFound,
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    if (!user.isActive) {
      const ip = req.ip || req.socket.remoteAddress || 'неупозната IP';
      logAuth.accessDenied(user.username, req.path, ip);
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: messages.auth.userInactive,
        code: 'USER_INACTIVE'
      });
      return;
    }

    // Attach user to request
    req.user = user;
    
    next();

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: messages.auth.tokenExpired,
        code: 'TOKEN_EXPIRED'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: messages.auth.tokenInvalid,
        code: 'TOKEN_INVALID'
      });
      return;
    }

    logger.error('Грешка у authentication middleware:', error);
    res.status(500).json({
      error: messages.errors.serverError,
      message: 'Дошло је до грешке при провери аутентификације',
      code: 'AUTH_ERROR'
    });
  }
}

// Permission check middleware factory
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: messages.auth.tokenInvalid,
        code: 'USER_NOT_AUTHENTICATED'
      });
      return;
    }

    const userPermissions = req.user.role.permissions as string[];
    
    if (!userPermissions.includes(permission) && !userPermissions.includes('*')) {
      const ip = req.ip || req.socket.remoteAddress || 'неупозната IP';
      logAuth.accessDenied(req.user.username, req.path, ip);
      res.status(403).json({
        error: messages.errors.forbidden,
        message: messages.auth.accessDenied,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredPermission: permission
      });
      return;
    }

    next();
  };
}

// Role check middleware factory
export function requireRole(roleName: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: messages.errors.unauthorized,
        message: messages.auth.tokenInvalid,
        code: 'USER_NOT_AUTHENTICATED'
      });
      return;
    }

    if (req.user.role.name !== roleName && req.user.role.name !== 'admin') {
      const ip = req.ip || req.socket.remoteAddress || 'неупозната IP';
      logAuth.accessDenied(req.user.username, req.path, ip);
      res.status(403).json({
        error: messages.errors.forbidden,
        message: messages.auth.accessDenied,
        code: 'INSUFFICIENT_ROLE',
        requiredRole: roleName,
        userRole: req.user.role.name
      });
      return;
    }

    next();
  };
}

// Admin only middleware
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: messages.errors.unauthorized,
      message: messages.auth.tokenInvalid,
      code: 'USER_NOT_AUTHENTICATED'
    });
    return;
  }

  if (req.user.role.name !== 'admin') {
    const ip = req.ip || req.socket.remoteAddress || 'неупозната IP';
    logAuth.accessDenied(req.user.username, req.path, ip);
    res.status(403).json({
      error: messages.errors.forbidden,
      message: 'Само администратори имају приступ овом ресурсу',
      code: 'ADMIN_REQUIRED'
    });
    return;
  }

  next();
}

// Optional authentication middleware (doesn't fail if no token)
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  // If token exists, validate it
  authMiddleware(req, res, next);
} 