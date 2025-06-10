/**
 * Smart Ticket Routing API Routes
 * Endpoints for automated ticket routing functionality
 */

import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import ticketRoutingService from '../services/routing/ticketRoutingService';
import agentProfileService from '../services/routing/agentProfileService';
import workloadCalculationService from '../services/routing/workloadCalculationService';
import smartRoutingEngine from '../services/routing/smartRoutingEngine';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { logger } from '../utils/logger';

// Extend Request interface to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    permissions: string[];
  };
}

const router = Router();

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

// POST /api/routing/tickets - Create ticket with automatic routing
router.post('/tickets',
  authMiddleware,
  [
    body('title')
      .notEmpty()
      .withMessage('Наслов тикета је обавезан')
      .isLength({ min: 5, max: 255 })
      .withMessage('Наслов мора бити између 5 и 255 карактера'),
    body('description')
      .notEmpty()
      .withMessage('Опис тикета је обавезан')
      .isLength({ min: 10 })
      .withMessage('Опис мора имати најмање 10 карактера'),
    body('priority')
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Приоритет мора бити: low, medium, high или critical'),
    body('aiCategory')
      .optional()
      .isString()
      .withMessage('AI категорија мора бити стринг'),
    body('aiCategoryDisplayName')
      .optional()
      .isString()
      .withMessage('AI назив категорије мора бити стринг'),
    body('aiConfidence')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('AI поверење мора бити између 0 и 1'),
    body('preferredAgentId')
      .optional()
      .isString()
      .withMessage('Преферирани агент мора бити валидан ID'),
    body('excludedAgentIds')
      .optional()
      .isArray()
      .withMessage('Искључени агенти морају бити низ'),
    body('bypassRouting')
      .optional()
      .isBoolean()
      .withMessage('Заобилажење рутирања мора бити boolean'),
    body('customerTier')
      .optional()
      .isIn(['basic', 'premium', 'enterprise'])
      .withMessage('Ниво корисника мора бити: basic, premium или enterprise')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const requestData = {
        ticketId: `temp-${Date.now()}`, // Will be replaced with actual ticket ID
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        aiCategory: req.body.aiCategory,
        aiCategoryDisplayName: req.body.aiCategoryDisplayName,
        aiConfidence: req.body.aiConfidence,
        aiAlternativeCategories: req.body.aiAlternativeCategories,
        preferredAgentId: req.body.preferredAgentId,
        excludedAgentIds: req.body.excludedAgentIds || [],
        bypassRouting: req.body.bypassRouting || false,
        customerTier: req.body.customerTier,
        requesterId: req.user?.userId || 'unknown'
      };

      const result = await ticketRoutingService.createTicketWithRouting(requestData);

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message,
          data: {
            ticket: result.ticket,
            routing: result.routingResult
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Error in smart ticket creation:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при креирању тикета са паметним рутирањем',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/routing/tickets/:id/reroute - Re-route existing ticket
router.post('/tickets/:id/reroute',
  authMiddleware,
  requirePermission(['tickets.assign', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID тикета је обавезан'),
    body('reason')
      .notEmpty()
      .withMessage('Разлог за поновно рутирање је обавезан')
      .isLength({ min: 5 })
      .withMessage('Разлог мора имати најмање 5 карактера'),
    body('excludeCurrentAgent')
      .optional()
      .isBoolean()
      .withMessage('Искључи тренутни агент мора бити boolean')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const result = await ticketRoutingService.rerouteTicket(
        req.params.id,
        req.body.reason,
        req.body.excludeCurrentAgent !== false, // Default to true
        req.user?.userId || 'unknown'
      );

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          data: {
            ticket: result.ticket,
            routing: result.routingResult
          }
        });
      } else {
        const statusCode = result.error === 'Ticket not found' ? 404 : 400;
        res.status(statusCode).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Error in ticket re-routing:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при поновном рутирању тикета',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/routing/recommendations - Get routing recommendation without creating ticket
router.post('/recommendations',
  authMiddleware,
  [
    body('title')
      .notEmpty()
      .withMessage('Наслов је обавезан')
      .isLength({ min: 5, max: 255 })
      .withMessage('Наслов мора бити између 5 и 255 карактера'),
    body('description')
      .notEmpty()
      .withMessage('Опис је обавезан')
      .isLength({ min: 10 })
      .withMessage('Опис мора имати најмање 10 карактера'),
    body('priority')
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Приоритет мора бити: low, medium, high или critical'),
    body('aiCategory')
      .optional()
      .isString()
      .withMessage('AI категорија мора бити стринг'),
    body('preferredAgentId')
      .optional()
      .isString()
      .withMessage('Преферирани агент мора бити валидан ID'),
    body('excludedAgentIds')
      .optional()
      .isArray()
      .withMessage('Искључени агенти морају бити низ')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const result = await ticketRoutingService.getRoutingRecommendation({
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        aiCategory: req.body.aiCategory,
        aiCategoryDisplayName: req.body.aiCategoryDisplayName,
        preferredAgentId: req.body.preferredAgentId,
        excludedAgentIds: req.body.excludedAgentIds
      });

      res.json({
        success: result.success,
        message: result.message,
        data: result.recommendation
      });
    } catch (error) {
      logger.error('Error getting routing recommendation:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при генерисању препоруке рутирања',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/insights - Get routing insights and statistics
router.get('/insights',
  authMiddleware,
  requirePermission(['reports.view', '*']),
  async (req: Request, res: Response) => {
    try {
      const result = await ticketRoutingService.getRoutingInsights();

      res.json({
        success: result.success,
        message: result.message,
        data: result.insights
      });
    } catch (error) {
      logger.error('Error getting routing insights:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању статистика рутирања',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/tickets/:id/history - Get routing history for a ticket
router.get('/tickets/:id/history',
  authMiddleware,
  [
    param('id').isString().notEmpty().withMessage('ID тикета је обавезан')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const result = await ticketRoutingService.getTicketRoutingHistory(req.params.id);

      res.json({
        success: result.success,
        message: result.message,
        data: result.history
      });
    } catch (error) {
      logger.error('Error getting ticket routing history:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању историје рутирања',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/statistics - Get overall routing statistics
router.get('/statistics',
  authMiddleware,
  requirePermission(['reports.view', '*']),
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
  async (req: Request, res: Response) => {
    try {
      const result = await ticketRoutingService.getRoutingStatistics(
        req.query.dateFrom as string,
        req.query.dateTo as string
      );

      res.json({
        success: result.success,
        message: result.message,
        data: result.statistics
      });
    } catch (error) {
      logger.error('Error getting routing statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању статистика рутирања',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/agents - Get all agent profiles with routing info
router.get('/agents',
  authMiddleware,
  requirePermission(['agents.view', '*']),
  async (req: Request, res: Response) => {
    try {
      const [profiles, workloads] = await Promise.all([
        agentProfileService.getAllAgentProfiles(),
        workloadCalculationService.calculateAllAgentWorkloads()
      ]);

      // Combine profiles with workload data
      const agentsWithWorkload = profiles.map(profile => {
        const workload = workloads.find(w => w.agentId === profile.id);
        return {
          ...profile,
          workload: workload || null
        };
      });

      res.json({
        success: true,
        message: 'Подаци о агентима успешно учитани',
        data: agentsWithWorkload
      });
    } catch (error) {
      logger.error('Error getting agents with routing info:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању података о агентима',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/routing/agents/:id/workload - Get specific agent workload
router.get('/agents/:id/workload',
  authMiddleware,
  requirePermission(['agents.view', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID агента је обавезан')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const workload = await workloadCalculationService.calculateAgentWorkload(req.params.id);

      if (!workload) {
        return res.status(404).json({
          success: false,
          message: 'Агент није пронађен или нема доступне податке о радном оптерећењу'
        });
      }

      res.json({
        success: true,
        message: 'Подаци о радном оптерећењу успешно учитани',
        data: workload
      });
    } catch (error) {
      logger.error('Error getting agent workload:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању података о радном оптерећењу',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/routing/initialize - Initialize sample routing data
router.post('/initialize',
  authMiddleware,
  requirePermission(['admin', '*']),
  async (req: Request, res: Response) => {
    try {
      await ticketRoutingService.initializeSampleData();

      res.json({
        success: true,
        message: 'Узорни подаци за рутирање успешно иницијализовани'
      });
    } catch (error) {
      logger.error('Error initializing routing data:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при иницијализацији података за рутирање',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/routing/simulate - Simulate routing for multiple tickets
router.post('/simulate',
  authMiddleware,
  requirePermission(['reports.view', '*']),
  [
    body('tickets')
      .isArray({ min: 1 })
      .withMessage('Морате проследити најмање један тикет за симулацију'),
    body('tickets.*.title')
      .notEmpty()
      .withMessage('Наслов тикета је обавезан'),
    body('tickets.*.description')
      .notEmpty()
      .withMessage('Опис тикета је обавезан'),
    body('tickets.*.priority')
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Приоритет мора бити: low, medium, high или urgent')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const simulationRequests = req.body.tickets.map((ticket: any, index: number) => ({
        ticketId: `simulation-${Date.now()}-${index}`,
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        category: ticket.category || 'other',
        categoryDisplayName: ticket.categoryDisplayName || 'Остало',
        aiConfidence: ticket.aiConfidence || 0.7,
        customerTier: ticket.customerTier || 'basic',
        createdAt: new Date().toISOString(),
        requiresUrgentHandling: ticket.priority === 'urgent'
      }));

      const result = await smartRoutingEngine.simulateRouting(simulationRequests);

      res.json({
        success: true,
        message: 'Симулација рутирања успешно завршена',
        data: result
      });
    } catch (error) {
      logger.error('Error simulating routing:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при симулацији рутирања',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router; 