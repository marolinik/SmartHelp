import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { messages } from '../config/config.js';

// Error interface
interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

// Global error handler middleware
export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const {
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    stack
  } = error;

  // Log error with Serbian context
  logger.error('🔥 Грешка у апликацији:', {
    message: error.message,
    statusCode,
    code,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    stack: stack || 'Stack trace није доступан',
  });

  // Development vs Production error responses
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Prepare error response
  const errorResponse: any = {
    error: true,
    message: isDevelopment ? error.message : getTranslatedError(error),
    code,
    timestamp: new Date().toISOString(),
  };

  // Add stack trace in development
  if (isDevelopment) {
    errorResponse.stack = stack;
    errorResponse.details = {
      originalMessage: error.message,
      path: req.path,
      method: req.method,
    };
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

// Translate common errors to Serbian
function getTranslatedError(error: AppError): string {
  const errorMessage = error.message.toLowerCase();

  // Database errors
  if (errorMessage.includes('database') || errorMessage.includes('prisma')) {
    return messages.errors.databaseError;
  }

  // LDAP/Authentication errors
  if (errorMessage.includes('ldap') || errorMessage.includes('authentication')) {
    return messages.errors.ldapError;
  }

  // Validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return messages.errors.validationError;
  }

  // Not found errors
  if (error.statusCode === 404) {
    return messages.errors.notFound;
  }

  // Forbidden errors
  if (error.statusCode === 403) {
    return messages.errors.forbidden;
  }

  // Unauthorized errors
  if (error.statusCode === 401) {
    return messages.errors.unauthorized;
  }

  // Default server error
  return messages.errors.serverError;
}

// 404 handler
export function notFoundHandler(req: Request, res: Response): void {
  logger.warn(`🔍 404 - Страница није пронађена: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    error: true,
    message: messages.errors.notFound,
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Create application error
export function createError(
  message: string,
  statusCode: number = 500,
  code: string = 'APP_ERROR'
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('🚨 Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
  });
  
  // Optionally exit the process
  // process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('🚨 Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
  });
  
  // Exit the process as the application is in an unstable state
  process.exit(1);
}); 