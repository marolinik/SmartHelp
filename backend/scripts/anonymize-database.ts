#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import dataAnonymizationService, { DataType, AnonymizationStrategy, FieldAnonymizationConfig } from '../src/services/dataAnonymizationService';
import fs from 'fs';
import path from 'path';

/**
 * Script за анонимизацију продукционе базе података за коришћење у тест окружењима
 * Овај script обезбеђује да се сви лични подаци правилно анонимизују
 */

const prisma = new PrismaClient();

/**
 * Конфигурација анонимизације за различите табеле
 */
const ANONYMIZATION_CONFIG: Record<string, FieldAnonymizationConfig[]> = {
  // Табела корисника
  users: [
    { fieldName: 'email', dataType: DataType.EMAIL, strategy: AnonymizationStrategy.PSEUDONYMIZE, preserveFormat: true },
    { fieldName: 'firstName', dataType: DataType.NAME, strategy: AnonymizationStrategy.PSEUDONYMIZE },
    { fieldName: 'lastName', dataType: DataType.NAME, strategy: AnonymizationStrategy.PSEUDONYMIZE },
    { fieldName: 'phone', dataType: DataType.PHONE, strategy: AnonymizationStrategy.PSEUDONYMIZE, preserveFormat: true },
    { fieldName: 'department', dataType: DataType.TEXT_CONTENT, strategy: AnonymizationStrategy.RANDOMIZE }
  ],

  // Табела тикета
  tickets: [
    { fieldName: 'title', dataType: DataType.TEXT_CONTENT, strategy: AnonymizationStrategy.MASK },
    { fieldName: 'description', dataType: DataType.TEXT_CONTENT, strategy: AnonymizationStrategy.MASK },
    { fieldName: 'solution', dataType: DataType.TEXT_CONTENT, strategy: AnonymizationStrategy.MASK }
  ],

  // Коментари на тикетима
  ticketComments: [
    { fieldName: 'content', dataType: DataType.TEXT_CONTENT, strategy: AnonymizationStrategy.MASK }
  ],

  // Чланци базе знања
  kbArticles: [
    { fieldName: 'title', dataType: DataType.TEXT_CONTENT, strategy: AnonymizationStrategy.MASK },
    { fieldName: 'content', dataType: DataType.TEXT_CONTENT, strategy: AnonymizationStrategy.MASK }
  ],

  // Audit логови
  auditLogs: [
    { fieldName: 'username', dataType: DataType.NAME, strategy: AnonymizationStrategy.PSEUDONYMIZE },
    { fieldName: 'ipAddress', dataType: DataType.IP_ADDRESS, strategy: AnonymizationStrategy.HASH },
    { fieldName: 'userAgent', dataType: DataType.USER_AGENT, strategy: AnonymizationStrategy.HASH }
  ]
};

/**
 * Главна функција за анонимизацију базе података
 */
async function anonymizeDatabase(): Promise<void> {
  console.log('🔒 Започиње анонимизација продукционе базе података за тест сврхе...');
  
  try {
    // Провери да ли је база доступна
    await prisma.$connect();
    console.log('✅ Успешно повезан са базом података');

    const anonymizationResults: any[] = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Анонимизуј корисничке податке
    console.log('\n📋 Анонимизујем корисничке податке...');
    const users = await prisma.user.findMany();
    if (users.length > 0) {
      const { anonymizedData: anonymizedUsers, result: usersResult } = dataAnonymizationService.anonymizeDataset(
        users, 
        ANONYMIZATION_CONFIG.users
      );
      
      // Сачувај анонимизоване кориснике
      await dataAnonymizationService.saveAnonymizedData(
        anonymizedUsers, 
        usersResult, 
        `users-anonymized-${timestamp}.json`
      );
      
      anonymizationResults.push({
        table: 'users',
        ...usersResult
      });
    }

    // Анонимизуј тикете
    console.log('\n🎫 Анонимизујем тикете...');
    const tickets = await prisma.ticket.findMany({
      include: {
        comments: true
      }
    });
    
    if (tickets.length > 0) {
      const { anonymizedData: anonymizedTickets, result: ticketsResult } = dataAnonymizationService.anonymizeDataset(
        tickets,
        ANONYMIZATION_CONFIG.tickets
      );

      await dataAnonymizationService.saveAnonymizedData(
        anonymizedTickets,
        ticketsResult,
        `tickets-anonymized-${timestamp}.json`
      );

      anonymizationResults.push({
        table: 'tickets',
        ...ticketsResult
      });
    }

    // Анонимизуј коментаре посебно ако постоје
    console.log('\n💬 Анонимизујем коментаре на тикетима...');
    const comments = await prisma.ticketComment.findMany();
    if (comments.length > 0) {
      const { anonymizedData: anonymizedComments, result: commentsResult } = dataAnonymizationService.anonymizeDataset(
        comments,
        ANONYMIZATION_CONFIG.ticketComments
      );

      await dataAnonymizationService.saveAnonymizedData(
        anonymizedComments,
        commentsResult,
        `ticket-comments-anonymized-${timestamp}.json`
      );

      anonymizationResults.push({
        table: 'ticketComments',
        ...commentsResult
      });
    }

    // Анонимизуј чланке базе знања
    console.log('\n📚 Анонимизујем чланке базе знања...');
    const kbArticles = await prisma.kbArticle.findMany();
    if (kbArticles.length > 0) {
      const { anonymizedData: anonymizedArticles, result: articlesResult } = dataAnonymizationService.anonymizeDataset(
        kbArticles,
        ANONYMIZATION_CONFIG.kbArticles
      );

      await dataAnonymizationService.saveAnonymizedData(
        anonymizedArticles,
        articlesResult,
        `kb-articles-anonymized-${timestamp}.json`
      );

      anonymizationResults.push({
        table: 'kbArticles',
        ...articlesResult
      });
    }

    // Генериши комплетан извештај
    const masterReport = {
      timestamp: new Date(),
      database: 'PIO Help Desk',
      environment: 'production-to-test',
      totalTables: Object.keys(ANONYMIZATION_CONFIG).length,
      processedTables: anonymizationResults.length,
      overallVerification: {
        allTablesProcessed: anonymizationResults.every(r => r.verification.noPersonalDataDetected),
        allDataIrreversible: anonymizationResults.every(r => r.verification.irreversible),
        formatPreserved: anonymizationResults.every(r => r.verification.formatPreserved)
      },
      tables: anonymizationResults,
      warnings: [
        'ОВИ ПОДАЦИ СУ АНОНИМИЗОВАНИ И НАМЕЊЕНИ СУ ИСКЉУЧИВО ЗА ТЕСТ СВРХЕ',
        'НЕ КОРИСТИТИ АНОНИМИЗОВАНЕ ПОДАТКЕ У ПРОДУКЦИОНОМ ОКРУЖЕЊУ',
        'АНОНИМИЗАЦИЈА ЈЕ НЕОБРАТИМА И НЕ МОЖЕ СЕ ВРАТИТИ НА ОРИГИНАЛНЕ ПОДАТКЕ'
      ]
    };

    // Сачувај мастер извештај
    const reportPath = path.join(process.cwd(), 'data', 'anonymized', `anonymization-master-report-${timestamp}.json`);
    await fs.promises.writeFile(reportPath, JSON.stringify(masterReport, null, 2), 'utf8');

    console.log('\n✅ Анонимизација базе података успешно завршена!');
    console.log(`📊 Обрађено табела: ${anonymizationResults.length}`);
    console.log(`📁 Мастер извештај: ${reportPath}`);
    
    // Прикажи резиме
    console.log('\n📋 Резиме анонимизације:');
    anonymizationResults.forEach(result => {
      console.log(`   • ${result.table}: ${result.recordsProcessed} записа, ${result.fieldsProcessed} поља`);
      console.log(`     ✓ Без личних података: ${result.verification.noPersonalDataDetected ? 'ДА' : 'НЕ'}`);
      console.log(`     ✓ Необратимо: ${result.verification.irreversible ? 'ДА' : 'НЕ'}`);
    });

    console.log('\n⚠️  УПОЗОРЕЊЕ: Проверите анонимизоване фајлове пре коришћења у тест окружењу!');

  } catch (error) {
    console.error('❌ Грешка при анонимизацији базе података:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Верификација анонимизације - проверава да нема личних података
 */
async function verifyAnonymization(filePath: string): Promise<boolean> {
  try {
    console.log(`🔍 Верификујем анонимизацију: ${filePath}`);
    
    const content = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    
    // Проверај да ли има личних података у садржају
    const contentStr = JSON.stringify(data.data);
    
    // Образци који указују на личне податке
    const personalDataPatterns = [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email адресе
      /\+?\d{1,4}[- ]?\(?\d{1,3}\)?[- ]?\d{1,4}[- ]?\d{1,9}/, // Телефонски бројеви
      /\b[А-ЯЁЂШЧЋЖРЛН][а-яёђшчћжрлн]+\s+[А-ЯЁЂШЧЋЖРЛН][а-яёђшчћжрлн]+\b/, // Српска имена
      /\d{13}/, // ЈМБГ
      /\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/ // Кредитне картице
    ];
    
    for (const pattern of personalDataPatterns) {
      if (pattern.test(contentStr)) {
        console.warn(`⚠️  Пронађени потенцијални лични подаци у ${filePath}`);
        return false;
      }
    }
    
    console.log(`✅ Верификација прошла: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Грешка при верификацији ${filePath}:`, error);
    return false;
  }
}

/**
 * Покрени script
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔒 PIO Help Desk - Script за анонимизацију базе података

Употреба:
  npm run anonymize-db              # Анонимизуј целу базу
  npm run anonymize-db --verify     # Анонимизуј и верификуј резултате
  npm run anonymize-db --help       # Прикажи ову помоћ

Опције:
  --verify    Верификуј анонимизоване фајлове након процесирања
  --help      Прикажи ову помоћ

Напомене:
  • Овај script анонимизује производне податке за коришћење у тест окружењима
  • Анонимизација је необратима
  • Сви анонимизовани фајлови се чувају у директоријуму data/anonymized/
  • Увек верификујте резултате пре коришћења
    `);
    process.exit(0);
  }
  
  anonymizeDatabase()
    .then(async () => {
      if (args.includes('--verify')) {
        console.log('\n🔍 Покретање верификације анонимизованих фајлова...');
        
        const anonymizedDir = path.join(process.cwd(), 'data', 'anonymized');
        const files = fs.readdirSync(anonymizedDir)
          .filter(f => f.endsWith('.json') && f.includes('anonymized'))
          .map(f => path.join(anonymizedDir, f));
        
        const verificationResults = await Promise.all(
          files.map(file => verifyAnonymization(file))
        );
        
        const allPassed = verificationResults.every(result => result === true);
        
        if (allPassed) {
          console.log('\n✅ Сва верификација прошла успешно!');
        } else {
          console.log('\n❌ Неке верификације нису прошле. Проверите логове.');
          process.exit(1);
        }
      }
    })
    .catch(error => {
      console.error('❌ Фатална грешка:', error);
      process.exit(1);
    });
} 