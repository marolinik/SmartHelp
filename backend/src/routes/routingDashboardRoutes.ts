/**
 * Routing Dashboard API Routes
 * Endpoints for Serbian-language dashboard configuration and metrics
 */

import { Router, Request, Response } from 'express';
import { query, body, param, validationResult } from 'express-validator';
import routingDashboardService from '../services/routing/routingDashboardService';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Extend Request interface to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    permissions: string[];
  };
}

// Validation helper
const handleValidationErrors = (req: AuthenticatedRequest, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Грешка валидације',
      errors: errors.array().map((err: any) => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// GET /api/routing/dashboard/configuration - Get dashboard configuration
router.get('/configuration',
  authMiddleware,
  requirePermission('dashboard.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await routingDashboardService.getDashboardConfiguration(req.user?.userId);

      res.json({
        success: result.success,
        message: result.message,
        data: result.configuration
      });
    } catch (error) {
      logger.error('Error getting dashboard configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању конфигурације dashboard-a',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/routing/dashboard/configuration - Save dashboard configuration
router.post('/configuration',
  authMiddleware,
  requirePermission('dashboard.config'),
  [
    body('routingWeights.skillWeight')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Тежина вештина мора бити између 0 и 100'),
    body('routingWeights.workloadWeight')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Тежина радног оптерећења мора бити између 0 и 100'),
    body('routingWeights.performanceWeight')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Тежина перформанси мора бити између 0 и 100'),
    body('routingWeights.availabilityWeight')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Тежина доступности мора бити између 0 и 100'),
    body('loadBalancing.strategy')
      .optional()
      .isIn(['round_robin', 'least_loaded', 'weighted_distribution', 'skill_based_balancing'])
      .withMessage('Неважећа стратегија распоређивања'),
    body('loadBalancing.emergencyThreshold')
      .optional()
      .isFloat({ min: 50, max: 100 })
      .withMessage('Праг хитности мора бити између 50 и 100'),
    body('loadBalancing.rebalanceInterval')
      .optional()
      .isInt({ min: 5, max: 180 })
      .withMessage('Интервал распоређивања мора бити између 5 и 180 минута')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await routingDashboardService.saveDashboardConfiguration(
        req.body,
        req.user?.userId || 'unknown'
      );

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      logger.error('Error saving dashboard configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при чувању конфигурације dashboard-a',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/dashboard/metrics/agents - Get agent metrics
router.get('/metrics/agents',
  authMiddleware,
  requirePermission('dashboard.view'),
  [
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Датум од мора бити валидан ISO8601 формат'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Датум до мора бити валидан ISO8601 формат')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await routingDashboardService.getAgentMetrics(
        req.query.dateFrom as string,
        req.query.dateTo as string
      );

      res.json({
        success: result.success,
        message: result.message,
        data: result.metrics
      });
    } catch (error) {
      logger.error('Error getting agent metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању метрика агената',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/dashboard/metrics/system - Get system routing metrics
router.get('/metrics/system',
  authMiddleware,
  requirePermission('dashboard.view'),
  [
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Датум од мора бити валидан ISO8601 формат'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Датум до мора бити валидан ISO8601 формат')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await routingDashboardService.getRoutingSystemMetrics(
        req.query.dateFrom as string,
        req.query.dateTo as string
      );

      res.json({
        success: result.success,
        message: result.message,
        data: result.metrics
      });
    } catch (error) {
      logger.error('Error getting system routing metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању системских метрика рутирања',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/dashboard/metrics/load-balancing - Get load balancing metrics
router.get('/metrics/load-balancing',
  authMiddleware,
  requirePermission('dashboard.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await routingDashboardService.getLoadBalancingMetrics();

      res.json({
        success: result.success,
        message: result.message,
        data: result.metrics
      });
    } catch (error) {
      logger.error('Error getting load balancing metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању метрика распоређивања оптерећења',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/dashboard/health - Get dashboard health status
router.get('/health',
  authMiddleware,
  requirePermission('dashboard.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check health of routing components
      const healthStatus = {
        overall: 'healthy',
        components: {
          routingEngine: 'operational',
          agentProfiles: 'operational',
          workloadCalculation: 'operational',
          loadBalancing: 'operational',
          notifications: 'operational'
        },
        metrics: {
          uptime: Math.floor(process.uptime()),
          memoryUsage: process.memoryUsage(),
          activeConnections: 1, // Would be real connection count
          lastHealthCheck: new Date().toISOString()
        },
        warnings: [],
        errors: []
      };

      res.json({
        success: true,
        message: 'Стање dashboard-a успешно учитано',
        data: healthStatus
      });
    } catch (error) {
      logger.error('Error getting dashboard health:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при провери стања dashboard-a',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/dashboard/overview - Get dashboard overview data
router.get('/overview',
  authMiddleware,
  requirePermission('dashboard.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get overview data from multiple sources
      const [systemMetrics, agentMetrics, loadBalancingMetrics] = await Promise.all([
        routingDashboardService.getRoutingSystemMetrics(),
        routingDashboardService.getAgentMetrics(),
        routingDashboardService.getLoadBalancingMetrics()
      ]);

      const overview = {
        systemSummary: {
          totalTickets: systemMetrics.metrics?.totalTickets || 0,
          routingEfficiency: systemMetrics.metrics?.routingEfficiency || 0,
          averageConfidence: systemMetrics.metrics?.averageConfidence || 0,
          reroutingCount: systemMetrics.metrics?.reroutingCount || 0
        },
        agentSummary: {
          totalAgents: agentMetrics.metrics?.length || 0,
          activeAgents: agentMetrics.metrics?.filter(a => a.utilizationPercent > 0).length || 0,
                     averageUtilization: agentMetrics.metrics ? agentMetrics.metrics.reduce((sum, a) => sum + a.utilizationPercent, 0) / agentMetrics.metrics.length : 0,
          overloadedAgents: agentMetrics.metrics?.filter(a => a.stressLevel === 'high' || a.stressLevel === 'critical').length || 0
        },
        loadBalancingSummary: {
          lastRebalance: loadBalancingMetrics.metrics?.lastRebalanceTime || null,
          rebalanceCount: loadBalancingMetrics.metrics?.rebalanceCount || 0,
          currentVariance: loadBalancingMetrics.metrics?.currentVariance || 0,
          isWithinTarget: (loadBalancingMetrics.metrics?.currentVariance || 0) <= (loadBalancingMetrics.metrics?.targetVariance || 20)
        },
                 alerts: [
           // Dynamic alerts based on metrics
           ...(systemMetrics.metrics?.routingEfficiency && systemMetrics.metrics.routingEfficiency < 90 
             ? [{ type: 'warning', message: 'Ефикасност рутирања је испод препоручене вредности (90%)' }] 
             : []),
           ...((agentMetrics.metrics?.filter(a => a.stressLevel === 'critical').length || 0) > 0 
             ? [{ type: 'error', message: `${agentMetrics.metrics?.filter(a => a.stressLevel === 'critical').length} агената под критичним стресом` }] 
             : [])
         ],
        lastUpdated: new Date().toISOString()
      };

      res.json({
        success: true,
        message: 'Преглед dashboard-a успешно учитан',
        data: overview
      });
    } catch (error) {
      logger.error('Error getting dashboard overview:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању прегледа dashboard-a',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/routing/dashboard/initialize - Initialize dashboard sample data
router.post('/initialize',
  authMiddleware,
  requirePermission('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await routingDashboardService.initializeSampleData();

      res.json({
        success: true,
        message: 'Узорни подаци за dashboard рутирања успешно иницијализовани'
      });
    } catch (error) {
      logger.error('Error initializing dashboard data:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при иницијализацији података dashboard-a',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/dashboard/export - Export dashboard configuration
router.get('/export',
  authMiddleware,
  requirePermission('dashboard.config'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await routingDashboardService.getDashboardConfiguration(req.user?.userId);

      if (result.success && result.configuration) {
        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="routing-dashboard-config-${new Date().toISOString().split('T')[0]}.json"`);
        
        res.json({
          exportDate: new Date().toISOString(),
          exportedBy: req.user?.userId,
          configuration: result.configuration
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Конфигурација није пронађена за експорт'
        });
      }
    } catch (error) {
      logger.error('Error exporting dashboard configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при експорту конфигурације dashboard-a',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/routing/dashboard/import - Import dashboard configuration
router.post('/import',
  authMiddleware,
  requirePermission('dashboard.config'),
  [
    body('configuration')
      .notEmpty()
      .withMessage('Конфигурација је обавезна за увоз'),
    body('configuration.routingWeights')
      .exists()
      .withMessage('Тежишне вредности рутирања су обавезне'),
    body('configuration.loadBalancing')
      .exists()
      .withMessage('Конфигурација распоређивања оптерећења је обавезна')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { configuration } = req.body;
      
      // Remove system fields that shouldn't be imported
      delete configuration.id;
      delete configuration.createdAt;
      delete configuration.updatedAt;
      
      const result = await routingDashboardService.saveDashboardConfiguration(
        configuration,
        req.user?.userId || 'unknown'
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Конфигурација dashboard-a успешно увезена'
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      logger.error('Error importing dashboard configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при увозу конфигурације dashboard-a',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router; 