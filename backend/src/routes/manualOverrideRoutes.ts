/**
 * Manual Override and Load Balancing API Routes
 * Endpoints for supervisor intervention and automated load distribution
 */

import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import manualOverrideService from '../services/routing/manualOverrideService';
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

// POST /api/overrides/request - Request manual override
router.post('/request',
  authMiddleware,
  requirePermission(['tickets.assign', 'supervisor', '*']),
  [
    body('ticketId')
      .notEmpty()
      .withMessage('ID тикета је обавезан'),
    body('toAgentId')
      .notEmpty()
      .withMessage('ID циљног агента је обавезан'),
    body('reason')
      .notEmpty()
      .withMessage('Разлог за преусмеравање је обавезан')
      .isLength({ min: 10 })
      .withMessage('Разлог мора имати најмање 10 карактера'),
    body('overrideType')
      .isIn(['manual_reassign', 'emergency_escalation', 'supervisor_decision'])
      .withMessage('Тип преусмеравања мора бити: manual_reassign, emergency_escalation или supervisor_decision'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Приоритет мора бити: low, medium, high или critical'),
    body('requiresApproval')
      .optional()
      .isBoolean()
      .withMessage('Захтева одобрење мора бити boolean')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await manualOverrideService.requestManualOverride({
        ticketId: req.body.ticketId,
        toAgentId: req.body.toAgentId,
        supervisorId: req.user?.userId || 'unknown',
        reason: req.body.reason,
        overrideType: req.body.overrideType,
        priority: req.body.priority,
        requiresApproval: req.body.requiresApproval
      });

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message,
          data: {
            overrideId: result.overrideId
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
      logger.error('Error requesting manual override:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при захтеву за мануелно преусмеравање',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/overrides/:id/approve - Approve manual override
router.post('/:id/approve',
  authMiddleware,
  requirePermission(['supervisor', 'admin', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID захтева за преусмеравање је обавезан'),
    body('notes')
      .optional()
      .isString()
      .withMessage('Напомене морају бити стринг')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await manualOverrideService.approveOverride(
        req.params.id,
        req.user?.userId || 'unknown',
        req.body.notes
      );

      res.json({
        success: result.success,
        message: result.message,
        error: result.error
      });
    } catch (error) {
      logger.error('Error approving override:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при одобравању преусмеравања',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/overrides/:id/reject - Reject manual override
router.post('/:id/reject',
  authMiddleware,
  requirePermission(['supervisor', 'admin', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID захтева за преусмеравање је обавезан'),
    body('reason')
      .notEmpty()
      .withMessage('Разлог за одбацивање је обавезан')
      .isLength({ min: 5 })
      .withMessage('Разлог мора имати најмање 5 карактера')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await manualOverrideService.rejectOverride(
        req.params.id,
        req.user?.userId || 'unknown',
        req.body.reason
      );

      res.json({
        success: result.success,
        message: result.message,
        error: result.error
      });
    } catch (error) {
      logger.error('Error rejecting override:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при одбацивању захтева',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/overrides/pending - Get pending override requests
router.get('/pending',
  authMiddleware,
  requirePermission(['supervisor', 'admin', '*']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await manualOverrideService.getPendingOverrides();

      res.json({
        success: result.success,
        message: result.message,
        data: result.overrides,
        error: result.error
      });
    } catch (error) {
      logger.error('Error getting pending overrides:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању захтева на чекању',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/overrides/history - Get override history with filters
router.get('/history',
  authMiddleware,
  requirePermission(['supervisor', 'admin', '*']),
  [
    query('supervisorId')
      .optional()
      .isString()
      .withMessage('ID супервизора мора бити стринг'),
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'processed', 'cancelled'])
      .withMessage('Статус мора бити: pending, approved, rejected, processed или cancelled'),
    query('fromDate')
      .optional()
      .isISO8601()
      .withMessage('Датум од мора бити валидан ISO8601 формат'),
    query('toDate')
      .optional()
      .isISO8601()
      .withMessage('Датум до мора бити валидан ISO8601 формат')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const filters = {
        supervisorId: req.query.supervisorId as string,
        status: req.query.status as string,
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });

      const result = await manualOverrideService.getOverrideHistory(filters);

      res.json({
        success: result.success,
        message: result.message,
        data: result.overrides,
        error: result.error
      });
    } catch (error) {
      logger.error('Error getting override history:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању историје преусмеравања',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/overrides/load-balance - Perform manual load balancing
router.post('/load-balance',
  authMiddleware,
  requirePermission(['supervisor', 'admin', '*']),
  [
    body('reason')
      .notEmpty()
      .withMessage('Разлог за распоређивање је обавезан')
      .isLength({ min: 5 })
      .withMessage('Разлог мора имати најмање 5 карактера'),
    body('configId')
      .optional()
      .isString()
      .withMessage('ID конфигурације мора бити стринг'),
    body('dryRun')
      .optional()
      .isBoolean()
      .withMessage('Пробни рад мора бити boolean')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await manualOverrideService.performLoadBalancing({
        configId: req.body.configId,
        triggeredBy: req.user?.userId || 'unknown',
        reason: req.body.reason,
        dryRun: req.body.dryRun || false
      });

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          data: {
            actionId: result.actionId,
            preview: result.preview
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
      logger.error('Error performing load balancing:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при распоређивању оптерећења',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/overrides/load-balance/preview - Preview load balancing changes
router.post('/load-balance/preview',
  authMiddleware,
  requirePermission(['supervisor', 'admin', '*']),
  [
    body('reason')
      .notEmpty()
      .withMessage('Разлог за распоређивање је обавезан'),
    body('configId')
      .optional()
      .isString()
      .withMessage('ID конфигурације мора бити стринг')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await manualOverrideService.performLoadBalancing({
        configId: req.body.configId,
        triggeredBy: req.user?.userId || 'unknown',
        reason: req.body.reason,
        dryRun: true // Force dry run for preview
      });

      res.json({
        success: result.success,
        message: result.message,
        data: result.preview,
        error: result.error
      });
    } catch (error) {
      logger.error('Error previewing load balancing:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при приказу распоређивања оптерећења',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/overrides/emergency-rebalance - Emergency load rebalancing
router.post('/emergency-rebalance',
  authMiddleware,
  requirePermission(['supervisor', 'admin', '*']),
  [
    body('reason')
      .notEmpty()
      .withMessage('Разлог за хитно распоређивање је обавезан')
      .isLength({ min: 10 })
      .withMessage('Разлог мора имати најмање 10 карактера')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Emergency rebalancing bypasses normal thresholds
      const result = await manualOverrideService.performLoadBalancing({
        triggeredBy: req.user?.userId || 'unknown',
        reason: `ХИТНО: ${req.body.reason}`,
        dryRun: false
      });

      if (result.success) {
        res.json({
          success: true,
          message: `Хитно распоређивање извршено: ${result.message}`,
          data: {
            actionId: result.actionId
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
      logger.error('Error performing emergency rebalancing:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при хитном распоређивању оптерећења',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/overrides/load-balance/status - Get load balancing status
router.get('/load-balance/status',
  authMiddleware,
  requirePermission(['supervisor', 'admin', '*']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // This would return current load balancing status
      // For now, return basic status
      res.json({
        success: true,
        message: 'Статус распоређивања оптерећења',
        data: {
          status: 'operational',
          lastRebalance: null,
          nextScheduledRebalance: null,
          isEmergencyMode: false,
          totalActiveAgents: 4,
          averageUtilization: 65
        }
      });
    } catch (error) {
      logger.error('Error getting load balance status:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању статуса распоређивања',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/overrides/initialize - Initialize default configurations
router.post('/initialize',
  authMiddleware,
  requirePermission(['admin', '*']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await manualOverrideService.initializeDefaultConfig();

      res.json({
        success: true,
        message: 'Основне конфигурације за мануелно преусмеравање и распоређивање оптерећења су иницијализоване'
      });
    } catch (error) {
      logger.error('Error initializing override configurations:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при иницијализацији конфигурација',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router; 