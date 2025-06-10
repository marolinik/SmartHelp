import winston from 'winston';
import { config } from '../config/config.js';

// Custom format for Serbian language logging
const serbianFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'DD.MM.YYYY HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (stack) {
      log += `\nStack trace: ${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: serbianFormat,
  defaultMeta: { 
    service: 'pio-help-desk',
    language: 'sr',
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Console transport for development
if (config.server.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss',
      }),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} ${level}: ${message}`;
      })
    ),
  }));
}

// Helper functions with Serbian language context
export const logAuth = {
  loginAttempt: (username: string, ip: string) => {
    logger.info(`Покушај пријаве за корисника: ${username} са IP: ${ip}`);
  },
  
  loginSuccess: (username: string, ip: string) => {
    logger.info(`Успешна пријава корисника: ${username} са IP: ${ip}`);
  },
  
  loginFailure: (username: string, ip: string, reason: string) => {
    logger.warn(`Неуспешна пријава корисника: ${username} са IP: ${ip}. Разлог: ${reason}`);
  },
  
  logout: (username: string, ip: string) => {
    logger.info(`Одјава корисника: ${username} са IP: ${ip}`);
  },
  
  tokenExpired: (username: string) => {
    logger.info(`Истекао токен за корисника: ${username}`);
  },
  
  accessDenied: (username: string, resource: string, ip: string) => {
    logger.warn(`Одбијен приступ кориснику: ${username} за ресурс: ${resource} са IP: ${ip}`);
  },
};

export const logDatabase = {
  connectionError: (error: string) => {
    logger.error(`Грешка при повезивању са базом података: ${error}`);
  },
  
  queryError: (query: string, error: string) => {
    logger.error(`Грешка при извршавању упита: ${query}. Грешка: ${error}`);
  },
  
  connectionSuccess: () => {
    logger.info('Успешно повезивање са базом података');
  },
};

export const logLDAP = {
  connectionError: (error: string) => {
    logger.error(`Грешка при повезивању са LDAP/AD: ${error}`);
  },
  
  authError: (username: string, error: string) => {
    logger.error(`LDAP аутентификација неуспешна за корисника: ${username}. Грешка: ${error}`);
  },
  
  connectionSuccess: () => {
    logger.info('Успешно повезивање са LDAP/AD');
  },
  
  userNotFound: (username: string) => {
    logger.warn(`Корисник није пронађен у LDAP/AD: ${username}`);
  },
};

export const logSystem = {
  startup: (port: number) => {
    logger.info(`🚀 PIO Help Desk сервер покренут на порту ${port}`);
  },
  
  shutdown: () => {
    logger.info('🛑 PIO Help Desk сервер се гаси...');
  },
  
  error: (error: string, stack?: string) => {
    logger.error(`Системска грешка: ${error}`, { stack });
  },
  
  configLoaded: (environment: string) => {
    logger.info(`⚙️ Конфигурација учитана за ${environment} окружење`);
  },
}; 