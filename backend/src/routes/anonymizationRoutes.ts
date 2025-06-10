import express, { Request, Response } from 'express';
import dataAnonymizationService, { DataType, AnonymizationStrategy } from '../services/dataAnonymizationService';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/adminMiddleware';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

/**
 * GET /api/anonymization/statistics
 * Добија статистике анонимизације
 */
router.get('/statistics', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = dataAnonymizationService.getAnonymizationStatistics();
    
    res.json({
      success: true,
      message: 'Статистике анонимизације успешно преузете',
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Грешка при преузимању статистика анонимизације:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при преузимању статистика'
    });
  }
});

/**
 * POST /api/anonymization/dataset
 * Анонимизује дати скуп података
 */
router.post('/dataset', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, config, filename } = req.body;
    
    // Валидација
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'Неважећи подаци',
        message: 'Подаци морају бити низ објеката'
      });
    }
    
    if (!config || !Array.isArray(config)) {
      return res.status(400).json({
        success: false,
        error: 'Неважећа конфигурација',
        message: 'Конфигурација анонимизације је обавезна'
      });
    }
    
    // Анонимизуј податке
    const { anonymizedData, result } = dataAnonymizationService.anonymizeDataset(data, config);
    
    // Сачувај ако је дато име фајла
    let filePath: string | null = null;
    if (filename) {
      filePath = await dataAnonymizationService.saveAnonymizedData(
        anonymizedData, 
        result, 
        filename.endsWith('.json') ? filename : `${filename}.json`
      );
    }
    
    res.json({
      success: true,
      message: `Анонимизација завршена: ${result.recordsProcessed} записа обрађено`,
      data: {
        anonymizationId: result.id,
        recordsProcessed: result.recordsProcessed,
        fieldsProcessed: result.fieldsProcessed,
        verification: result.verification,
        filePath: filePath ? path.basename(filePath) : null,
        anonymizedData: anonymizedData
      }
    });
    
  } catch (error) {
    console.error('❌ Грешка при анонимизацији скупа података:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при анонимизацији података'
    });
  }
});

/**
 * POST /api/anonymization/database
 * Покреће анонимизацију целе базе података
 */
router.post('/database', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { verify = false } = req.body;
    
    console.log(`🔒 ${req.user?.username} покреће анонимизацију базе података...`);
    
    // Покрени script за анонимизацију базе
    const scriptPath = path.join(process.cwd(), 'scripts', 'anonymize-database.ts');
    const command = verify ? 
      `npx ts-node ${scriptPath} --verify` : 
      `npx ts-node ${scriptPath}`;
    
    // Покрени асинхроно
    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Грешка при извршавању script-а за анонимизацију:', error);
      } else {
        console.log('✅ Script за анонимизацију завршен успешно');
        console.log(stdout);
      }
      
      if (stderr) {
        console.warn('⚠️ Упозорења током анонимизације:', stderr);
      }
    });
    
    res.json({
      success: true,
      message: 'Анонимизација базе података је покренута у позадини',
      data: {
        verify,
        scriptPath: path.basename(scriptPath),
        startedBy: req.user?.username,
        startedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Грешка при покретању анонимизације базе:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при покретању анонимизације'
    });
  }
});

/**
 * GET /api/anonymization/reports
 * Добија листу извештаја о анонимизацији
 */
router.get('/reports', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonymizedDir = path.join(process.cwd(), 'data', 'anonymized');
    
    if (!fs.existsSync(anonymizedDir)) {
      return res.json({
        success: true,
        message: 'Нема доступних извештаја о анонимизацији',
        data: []
      });
    }
    
    const files = fs.readdirSync(anonymizedDir)
      .filter(f => f.endsWith('.json'))
      .map(filename => {
        const filePath = path.join(anonymizedDir, filename);
        const stats = fs.statSync(filePath);
        
        return {
          filename,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isMasterReport: filename.includes('master-report'),
          isAnonymizedData: filename.includes('anonymized')
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());
    
    res.json({
      success: true,
      message: `Пронађено ${files.length} извештаја о анонимизацији`,
      data: files
    });
    
  } catch (error) {
    console.error('❌ Грешка при преузимању извештаја:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при преузимању извештаја'
    });
  }
});

/**
 * GET /api/anonymization/reports/:filename
 * Преузима одређени извештај о анонимизацији
 */
router.get('/reports/:filename', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { filename } = req.params;
    
    // Безбедносна провера - само дозвољени фајлови
    if (!filename.endsWith('.json') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Неважеће име фајла',
        message: 'Име фајла садржи недозвољене карактере'
      });
    }
    
    const filePath = path.join(process.cwd(), 'data', 'anonymized', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Фајл није пронађен',
        message: 'Захтевани извештај не постоји'
      });
    }
    
    // Пошаљи фајл као download
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('❌ Грешка при преузимању извештаја:', err);
        res.status(500).json({
          success: false,
          error: 'Грешка при преузимању',
          message: 'Дошло је до грешке при преузимању извештаја'
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Грешка при преузимању извештаја:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при преузимању извештаја'
    });
  }
});

/**
 * POST /api/anonymization/verify/:filename
 * Верификује анонимизовани фајл
 */
router.post('/verify/:filename', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { filename } = req.params;
    
    // Безбедносна провера
    if (!filename.endsWith('.json') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Неважеће име фајла',
        message: 'Име фајла садржи недозвољене карактере'
      });
    }
    
    const filePath = path.join(process.cwd(), 'data', 'anonymized', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Фајл није пронађен',
        message: 'Захтевани фајл не постоји'
      });
    }
    
    // Учитај и анализирај фајл
    const content = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    
    // Проверај да ли има личних података
    const contentStr = JSON.stringify(data.data || data);
    
    const personalDataPatterns = [
      { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, name: 'Email адресе' },
      { pattern: /\+?\d{1,4}[- ]?\(?\d{1,3}\)?[- ]?\d{1,4}[- ]?\d{1,9}/, name: 'Телефонски бројеви' },
      { pattern: /\b[А-ЯЁЂШЧЋЖРЛН][а-яёђшчћжрлн]+\s+[А-ЯЁЂШЧЋЖРЛН][а-яёђшчћжрлн]+\b/, name: 'Српска имена' },
      { pattern: /\d{13}/, name: 'ЈМБГ' },
      { pattern: /\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/, name: 'Кредитне картице' }
    ];
    
    const foundPatterns = personalDataPatterns.filter(p => p.pattern.test(contentStr));
    const isValid = foundPatterns.length === 0;
    
    res.json({
      success: true,
      message: isValid ? 'Фајл је правилно анонимизован' : 'Пронађени потенцијални лични подаци',
      data: {
        filename,
        isValid,
        foundPatterns: foundPatterns.map(p => p.name),
        fileSize: content.length,
        recordCount: Array.isArray(data.data) ? data.data.length : 'Непознато',
        verifiedAt: new Date(),
        verifiedBy: req.user?.username
      }
    });
    
  } catch (error) {
    console.error('❌ Грешка при верификацији фајла:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при верификацији фајла'
    });
  }
});

/**
 * GET /api/anonymization/strategies
 * Добија доступне стратегије и типове анонимизације
 */
router.get('/strategies', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const strategies = Object.values(AnonymizationStrategy).map(strategy => ({
      value: strategy,
      label: this.getStrategyLabel(strategy),
      description: this.getStrategyDescription(strategy)
    }));
    
    const dataTypes = Object.values(DataType).map(type => ({
      value: type,
      label: this.getDataTypeLabel(type),
      description: this.getDataTypeDescription(type)
    }));
    
    res.json({
      success: true,
      message: 'Доступне стратегије и типови анонимизације',
      data: {
        strategies,
        dataTypes,
        examples: this.getAnonymizationExamples()
      }
    });
    
  } catch (error) {
    console.error('❌ Грешка при преузимању стратегија:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при преузимању стратегија'
    });
  }
});

// Помоћне функције за описе стратегија и типова
function getStrategyLabel(strategy: AnonymizationStrategy): string {
  const labels: Record<AnonymizationStrategy, string> = {
    [AnonymizationStrategy.HASH]: 'Хеширање',
    [AnonymizationStrategy.PSEUDONYMIZE]: 'Псеудонимизација',
    [AnonymizationStrategy.MASK]: 'Маскирање',
    [AnonymizationStrategy.RANDOMIZE]: 'Рандомизација',
    [AnonymizationStrategy.TRUNCATE]: 'Скраћивање',
    [AnonymizationStrategy.NULLIFY]: 'Постављање на null'
  };
  return labels[strategy] || strategy;
}

function getStrategyDescription(strategy: AnonymizationStrategy): string {
  const descriptions: Record<AnonymizationStrategy, string> = {
    [AnonymizationStrategy.HASH]: 'Необратимо претварање у хеш вредност',
    [AnonymizationStrategy.PSEUDONYMIZE]: 'Замена реалистичним фиктивним вредностима',
    [AnonymizationStrategy.MASK]: 'Скривање дела података звездицама',
    [AnonymizationStrategy.RANDOMIZE]: 'Замена потпуно случајним вредностима',
    [AnonymizationStrategy.TRUNCATE]: 'Уклањање дела података',
    [AnonymizationStrategy.NULLIFY]: 'Постављање вредности на null'
  };
  return descriptions[strategy] || 'Непознат опис';
}

function getDataTypeLabel(dataType: DataType): string {
  const labels: Record<DataType, string> = {
    [DataType.EMAIL]: 'Email адреса',
    [DataType.PHONE]: 'Телефонски број',
    [DataType.NAME]: 'Име и презиме',
    [DataType.ADDRESS]: 'Адреса',
    [DataType.IP_ADDRESS]: 'IP адреса',
    [DataType.USER_AGENT]: 'User Agent',
    [DataType.TEXT_CONTENT]: 'Текстуални садржај',
    [DataType.DATE]: 'Датум',
    [DataType.NUMBER]: 'Број'
  };
  return labels[dataType] || dataType;
}

function getDataTypeDescription(dataType: DataType): string {
  const descriptions: Record<DataType, string> = {
    [DataType.EMAIL]: 'Email адресе са @ симболом',
    [DataType.PHONE]: 'Телефонски бројеви (+381, 064...)',
    [DataType.NAME]: 'Српска имена и презимена',
    [DataType.ADDRESS]: 'Физичке адресе',
    [DataType.IP_ADDRESS]: 'IP адресе (IPv4/IPv6)',
    [DataType.USER_AGENT]: 'Browser User Agent строгови',
    [DataType.TEXT_CONTENT]: 'Произвољни текстуални садржај',
    [DataType.DATE]: 'Датуми у различитим форматима',
    [DataType.NUMBER]: 'Нумеричке вредности'
  };
  return descriptions[dataType] || 'Непознат опис';
}

function getAnonymizationExamples(): any[] {
  return [
    {
      originalValue: 'marko.petrovic@example.com',
      dataType: DataType.EMAIL,
      strategy: AnonymizationStrategy.PSEUDONYMIZE,
      anonymizedValue: 'korisnik123abc@example.com',
      description: 'Email са очуваним доменом'
    },
    {
      originalValue: '+381641234567',
      dataType: DataType.PHONE,
      strategy: AnonymizationStrategy.MASK,
      anonymizedValue: '+38***4567',
      description: 'Телефон са маскираним средњим цифрама'
    },
    {
      originalValue: 'Марко Петровић',
      dataType: DataType.NAME,
      strategy: AnonymizationStrategy.PSEUDONYMIZE,
      anonymizedValue: 'Милош1a2b',
      description: 'Српско име замењено псеудонимом'
    }
  ];
}

export default router; 