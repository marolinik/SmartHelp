import express, { Request, Response } from 'express';
import securityScanService, { ScanType, ScanStatus } from '../services/securityScanService';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/adminMiddleware';

const router = express.Router();

// Интерфејс за аутентификовани захтев
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

/**
 * GET /api/security/scans
 * Добија листу свих сканирања са филтерима
 */
router.get('/scans', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, status, limit = '50', offset = '0' } = req.query;
    
    const filters = {
      type: type as ScanType,
      status: status as ScanStatus,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };
    
    const scans = securityScanService.getScanResults(filters);
    
    res.json({
      success: true,
      message: 'Листа сканирања успешно преузета',
      data: scans,
      total: scans.length
    });
    
  } catch (error) {
    console.error('❌ Грешка при преузимању листе сканирања:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при преузимању листе сканирања'
    });
  }
});

/**
 * GET /api/security/scans/active
 * Добија тренутно активно сканирање
 */
router.get('/scans/active', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeScan = securityScanService.getActiveScan();
    
    res.json({
      success: true,
      message: activeScan ? 'Активно сканирање пронађено' : 'Нема активног сканирања',
      data: activeScan
    });
    
  } catch (error) {
    console.error('❌ Грешка при преузимању активног сканирања:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при преузимању активног сканирања'
    });
  }
});

/**
 * POST /api/security/scans/dependency
 * Покреће сканирање зависности
 */
router.post('/scans/dependency', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeScan = securityScanService.getActiveScan();
    if (activeScan) {
      return res.status(409).json({
        success: false,
        error: 'Сканирање у току',
        message: 'Друго сканирање је тренутно у току. Сачекајте да се заврши.'
      });
    }
    
    // Покрени сканирање асинхроно
    securityScanService.scanDependencies()
      .then((result) => {
        console.log(`✅ Dependency сканирање завршено: ${result.summary.total} рањивости`);
      })
      .catch((error) => {
        console.error('❌ Dependency сканирање неуспешно:', error);
      });
    
    res.json({
      success: true,
      message: 'Сканирање зависности је покренуто',
      data: { type: ScanType.DEPENDENCY_SCAN, status: ScanStatus.RUNNING }
    });
    
  } catch (error) {
    console.error('❌ Грешка при покретању dependency сканирања:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при покретању сканирања зависности'
    });
  }
});

/**
 * POST /api/security/scans/code
 * Покреће сканирање кода
 */
router.post('/scans/code', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeScan = securityScanService.getActiveScan();
    if (activeScan) {
      return res.status(409).json({
        success: false,
        error: 'Сканирање у току',
        message: 'Друго сканирање је тренутно у току. Сачекајте да се заврши.'
      });
    }
    
    // Покрени сканирање асинхроно
    securityScanService.scanCode()
      .then((result) => {
        console.log(`✅ Code сканирање завршено: ${result.summary.total} проблема`);
      })
      .catch((error) => {
        console.error('❌ Code сканирање неуспешно:', error);
      });
    
    res.json({
      success: true,
      message: 'Сканирање кода је покренуто',
      data: { type: ScanType.CODE_SECURITY_SCAN, status: ScanStatus.RUNNING }
    });
    
  } catch (error) {
    console.error('❌ Грешка при покретању code сканирања:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при покретању сканирања кода'
    });
  }
});

/**
 * POST /api/security/scans/configuration
 * Покреће сканирање конфигурације
 */
router.post('/scans/configuration', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeScan = securityScanService.getActiveScan();
    if (activeScan) {
      return res.status(409).json({
        success: false,
        error: 'Сканирање у току',
        message: 'Друго сканирање је тренутно у току. Сачекајте да се заврши.'
      });
    }
    
    // Покрени сканирање асинхроно
    securityScanService.scanConfiguration()
      .then((result) => {
        console.log(`✅ Configuration сканирање завршено: ${result.summary.total} проблема`);
      })
      .catch((error) => {
        console.error('❌ Configuration сканирање неуспешно:', error);
      });
    
    res.json({
      success: true,
      message: 'Сканирање конфигурације је покренуто',
      data: { type: ScanType.CONFIGURATION_SCAN, status: ScanStatus.RUNNING }
    });
    
  } catch (error) {
    console.error('❌ Грешка при покретању configuration сканирања:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при покретању сканирања конфигурације'
    });
  }
});

/**
 * POST /api/security/scans/comprehensive
 * Покреће комплетно сканирање
 */
router.post('/scans/comprehensive', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeScan = securityScanService.getActiveScan();
    if (activeScan) {
      return res.status(409).json({
        success: false,
        error: 'Сканирање у току',
        message: 'Друго сканирање је тренутно у току. Сачекајте да се заврши.'
      });
    }
    
    // Покрени сканирање асинхроно
    securityScanService.performComprehensiveScan()
      .then((result) => {
        console.log(`✅ Comprehensive сканирање завршено: ${result.summary.total} укупних проблема`);
      })
      .catch((error) => {
        console.error('❌ Comprehensive сканирање неуспешно:', error);
      });
    
    res.json({
      success: true,
      message: 'Комплетно безбедносно сканирање је покренуто',
      data: { type: ScanType.COMPREHENSIVE_SCAN, status: ScanStatus.RUNNING }
    });
    
  } catch (error) {
    console.error('❌ Грешка при покретању comprehensive сканирања:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при покретању комплетног сканирања'
    });
  }
});

/**
 * GET /api/security/config
 * Добија тренутну конфигурацију безбедносног сканирања
 */
router.get('/config', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = securityScanService.getConfiguration();
    
    res.json({
      success: true,
      message: 'Конфигурација успешно преузета',
      data: config
    });
    
  } catch (error) {
    console.error('❌ Грешка при преузимању конфигурације:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при преузимању конфигурације'
    });
  }
});

/**
 * PUT /api/security/config
 * Ажурира конфигурацију безбедносног сканирања
 */
router.put('/config', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const newConfig = req.body;
    
    // Валидација конфигурације
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Неважећи подаци',
        message: 'Конфигурација мора бити важећи JSON објекат'
      });
    }
    
    securityScanService.updateConfiguration(newConfig);
    
    res.json({
      success: true,
      message: 'Конфигурација је успешно ажурирана',
      data: securityScanService.getConfiguration()
    });
    
  } catch (error) {
    console.error('❌ Грешка при ажурирању конфигурације:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при ажурирању конфигурације'
    });
  }
});

/**
 * GET /api/security/stats
 * Добија статистике безбедносних сканирања
 */
router.get('/stats', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = securityScanService.getScanStatistics();
    
    res.json({
      success: true,
      message: 'Статистике успешно преузете',
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Грешка при преузимању статистика:', error);
    res.status(500).json({
      success: false,
      error: 'Грешка сервера',
      message: 'Дошло је до грешке при преузимању статистика'
    });
  }
});

/**
 * GET /api/security/scans/:id/report
 * Преузима извештај о сканирању
 */
router.get('/scans/:id/report', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Пронађи сканирање по ID-у
    const scans = securityScanService.getScanResults({ limit: 1000 });
    const scan = scans.find(s => s.id === id);
    
    if (!scan) {
      return res.status(404).json({
        success: false,
        error: 'Сканирање није пронађено',
        message: `Сканирање са ID ${id} не постоји`
      });
    }
    
    if (!scan.reportPath) {
      return res.status(404).json({
        success: false,
        error: 'Извештај није доступан',
        message: 'Извештај за ово сканирање није генерисан'
      });
    }
    
    // Пошаљи фајл као download
    res.download(scan.reportPath, `security-scan-${id}.json`, (err) => {
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

export default router; 