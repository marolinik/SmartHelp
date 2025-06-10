import { Router, Request, Response } from 'express';
import { SystemHealthService } from '../services/SystemHealthService';
import { logger } from '../utils/logger';
import { SerbianFormat } from '../utils/serbianFormatting';

const router = Router();
const healthService = new SystemHealthService();

/**
 * @route GET /api/health
 * @desc Основна провера здравља система (јавно доступна)
 * @access Public
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Основна провера без детаљних метрика
    const basicHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      message: 'PIO Help Desk систем функционише исправно'
    };

    const responseTime = Date.now() - startTime;
    
    res.status(200).json({
      success: true,
      data: {
        ...basicHealth,
        responseTime
      }
    });

  } catch (error) {
    logger.error('Грешка при основној провери здравља', { error });
    
    res.status(503).json({
      success: false,
      error: 'Систем није доступан',
      message: 'Дошло је до грешке при провери статуса система'
    });
  }
});

/**
 * @route GET /api/health/detailed
 * @desc Детаљна провера здравља система са метрикама
 * @access Public (засад без аутентификације)
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    logger.info('Покрећем детаљну проверу здравља система');

    const healthReport = await healthService.performHealthCheck();

    const statusCode = healthReport.status === 'critical' ? 503 : 
                      healthReport.status === 'warning' ? 200 : 200;

    res.status(statusCode).json({
      success: true,
      data: healthReport
    });

  } catch (error) {
    logger.error('Грешка при детаљној провери здравља', { error });

    res.status(500).json({
      success: false,
      error: 'Грешка при провери здравља система',
      message: error instanceof Error ? error.message : 'Непозната грешка'
    });
  }
});

/**
 * @route GET /api/health/metrics
 * @desc Системске метрике за мониторинг
 * @access Public (засад без аутентификације)
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const healthReport = await healthService.performHealthCheck();
    
    // Враћање само метрика за мониторинг системе
    const metrics = {
      timestamp: healthReport.timestamp,
      status: healthReport.status,
      metrics: healthReport.metrics,
      summary: healthReport.summary,
      checks: healthReport.checks.map(check => ({
        name: check.name,
        status: check.status,
        responseTime: check.responseTime
      }))
    };

    res.status(200).json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Грешка при прикупљању метрика', { error });

    res.status(500).json({
      success: false,
      error: 'Грешка при прикупљању метрика',
      message: error instanceof Error ? error.message : 'Непозната грешка'
    });
  }
});

/**
 * @route GET /api/health/prometheus
 * @desc Prometheus формат метрика
 * @access Public (за Prometheus scraper)
 */
router.get('/prometheus', async (req: Request, res: Response) => {
  try {
    const healthReport = await healthService.performHealthCheck();
    
    // Генерисање Prometheus формата метрика
    let prometheusMetrics = '';
    
    // Општи статус система
    prometheusMetrics += `# HELP pio_system_health Статус здравља PIO система\n`;
    prometheusMetrics += `# TYPE pio_system_health gauge\n`;
    prometheusMetrics += `pio_system_health{status="${healthReport.status}"} ${healthReport.status === 'healthy' ? 1 : healthReport.status === 'warning' ? 0.5 : 0}\n\n`;

    // Метрике меморије
    prometheusMetrics += `# HELP pio_memory_usage_percent Проценат коришћења меморије\n`;
    prometheusMetrics += `# TYPE pio_memory_usage_percent gauge\n`;
    prometheusMetrics += `pio_memory_usage_percent ${SerbianFormat.formatDecimal(healthReport.metrics.memory.percentage, 2)}\n\n`;

    // CPU метрике
    prometheusMetrics += `# HELP pio_cpu_usage_percent Проценат коришћења CPU\n`;
    prometheusMetrics += `# TYPE pio_cpu_usage_percent gauge\n`;
    prometheusMetrics += `pio_cpu_usage_percent ${SerbianFormat.formatDecimal(healthReport.metrics.cpu.usage, 2)}\n\n`;

    // Uptime
    prometheusMetrics += `# HELP pio_uptime_seconds Време рада система у секундама\n`;
    prometheusMetrics += `# TYPE pio_uptime_seconds counter\n`;
    prometheusMetrics += `pio_uptime_seconds ${healthReport.metrics.uptime}\n\n`;

    // Провере компоненти
    prometheusMetrics += `# HELP pio_component_health Статус здравља компонената\n`;
    prometheusMetrics += `# TYPE pio_component_health gauge\n`;
    
    healthReport.checks.forEach(check => {
      const value = check.status === 'healthy' ? 1 : check.status === 'warning' ? 0.5 : 0;
      const componentName = check.name.replace(/\s+/g, '_').toLowerCase();
      prometheusMetrics += `pio_component_health{component="${componentName}"} ${value}\n`;
    });

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(prometheusMetrics);

  } catch (error) {
    logger.error('Грешка при генерисању Prometheus метрика', { error });
    res.status(500).send('# Грешка при генерисању метрика\n');
  }
});

/**
 * @route POST /api/health/trigger-check
 * @desc Покретање ручне провере здравља система
 * @access Public (засад без аутентификације)
 */
router.post('/trigger-check', async (req: Request, res: Response) => {
  try {
    logger.info('Покрећем ручну проверу здравља система');

    const healthReport = await healthService.performHealthCheck();

    res.status(200).json({
      success: true,
      data: healthReport,
      message: 'Провера здравља система успешно извршена'
    });

  } catch (error) {
    logger.error('Грешка при ручној провери здравља', { error });

    res.status(500).json({
      success: false,
      error: 'Грешка при провери здравља',
      message: error instanceof Error ? error.message : 'Непозната грешка'
    });
  }
});

export default router; 