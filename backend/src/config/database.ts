import { PrismaClient } from '@prisma/client';
import { encryptionMiddleware } from '../middleware/encryptionMiddleware';

// Прошируј Prisma client типове за глобални објекат
declare global {
  var prisma: PrismaClient | undefined;
}

// Креирај Prisma client инстанцу
const prisma = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Додај encryption middleware за аутоматску енкрипцију/декрипцију
prisma.$use(encryptionMiddleware);

// У development окружењу, користи глобални објекат за hot reload
if (process.env.NODE_ENV === 'development') {
  globalThis.prisma = prisma;
}

// Функција за тестирање конекције базе података
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    console.log('✅ Успешно повезано са базом података');
    return true;
  } catch (error) {
    console.error('❌ Грешка при повезивању са базом података:', error);
    return false;
  }
}

// Функција за затварање конекције
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('🔌 Конекција са базом података је затворена');
  } catch (error) {
    console.error('Грешка при затварању конекције:', error);
  }
}

// Експортуј Prisma client инстанцу
export { prisma };
export default prisma; 