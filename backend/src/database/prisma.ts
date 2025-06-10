import { PrismaClient } from '@prisma/client';
import { logger, logDatabase } from '../utils/logger.js';

// Create Prisma client with Serbian language error handling
export const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
  errorFormat: 'pretty',
});

// Event listeners with Serbian language logging
prisma.$on('query', (e: any) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`Упит: ${e.query}`);
    logger.debug(`Параметри: ${e.params}`);
    logger.debug(`Трајање: ${e.duration}ms`);
  }
});

prisma.$on('error', (e: any) => {
  logDatabase.queryError(e.target, e.message);
});

prisma.$on('info', (e: any) => {
  logger.info(`База података: ${e.message}`);
});

prisma.$on('warn', (e: any) => {
  logger.warn(`База података упозорење: ${e.message}`);
});

// Connection test function
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logDatabase.connectionSuccess();
    
    // Test query to verify connection
    await prisma.$queryRaw`SELECT 1 as test`;
    logger.info('✅ Тест упит успешан - веза са базом података је активна');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Непозната грешка';
    logDatabase.connectionError(errorMessage);
    
    logger.error('❌ Неуспешно повезивање са базом података:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    
    throw new Error(`Грешка при повезивању са базом података: ${errorMessage}`);
  }
}

// Graceful disconnect
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('🔌 Веза са базом података је затворена');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Непозната грешка';
    logger.error(`Грешка при затварању везе са базом података: ${errorMessage}`);
  }
}

// Helper function for transaction with Serbian error handling
export async function withTransaction<T>(
  callback: (prisma: any) => Promise<T>
): Promise<T> {
  try {
    const result = await prisma.$transaction(async (tx: any) => {
      return await callback(tx);
    });
    
    logger.debug('📋 Трансакција успешно завршена');
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Непозната грешка';
    logger.error(`Грешка у трансакцији: ${errorMessage}`);
    throw new Error(`Трансакција неуспешна: ${errorMessage}`);
  }
}

// Database health check function
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latency: number;
  message: string;
}> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1 as health_check`;
    const latency = Date.now() - start;
    
    return {
      connected: true,
      latency,
      message: `База података је активна (${latency}ms)`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Непозната грешка';
    return {
      connected: false,
      latency: -1,
      message: `Грешка при провери стања базе: ${errorMessage}`,
    };
  }
} 