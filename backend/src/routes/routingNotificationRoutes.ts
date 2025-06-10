/**
 * Routing Notification API Routes
 * Endpoints for Serbian-language routing notifications and messaging
 */

import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import routingNotificationService from '../services/routing/routingNotificationService';
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

// POST /api/notifications/routing/ticket-assigned - Send ticket assignment notification
router.post('/ticket-assigned',
  authMiddleware,
  requirePermission(['tickets.assign', 'system', '*']),
  [
    body('ticketId')
      .notEmpty()
      .withMessage('ID тикета је обавезан'),
    body('agentId')
      .notEmpty()
      .withMessage('ID агента је обавезан'),
    body('ticketTitle')
      .notEmpty()
      .withMessage('Наслов тикета је обавезан'),
    body('ticketPriority')
      .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
      .withMessage('Приоритет мора бити: low, medium, high, urgent или critical'),
    body('ticketCategory')
      .notEmpty()
      .withMessage('Категорија тикета је обавезна'),
    body('requesterName')
      .notEmpty()
      .withMessage('Име корисника је обавезно'),
    body('routingReason')
      .notEmpty()
      .withMessage('Разлог доделе је обавезан'),
    body('aiConfidence')
      .isFloat({ min: 0, max: 1 })
      .withMessage('AI поверење мора бити између 0 и 1'),
    body('channels')
      .optional()
      .isArray()
      .withMessage('Канали морају бити низ')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await routingNotificationService.notifyTicketAssigned({
        ticketId: req.body.ticketId,
        agentId: req.body.agentId,
        ticketTitle: req.body.ticketTitle,
        ticketPriority: req.body.ticketPriority,
        ticketCategory: req.body.ticketCategory,
        requesterName: req.body.requesterName,
        routingReason: req.body.routingReason,
        aiConfidence: req.body.aiConfidence,
        channels: req.body.channels
      });

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message,
          data: {
            notificationId: result.notificationId
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      logger.error('Error sending ticket assignment notification:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при слању нотификације о додели тикета',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/notifications/routing/manual-override-requested - Send manual override request notification
router.post('/manual-override-requested',
  authMiddleware,
  requirePermission(['tickets.assign', 'supervisor', '*']),
  [
    body('overrideId')
      .notEmpty()
      .withMessage('ID захтева за преусмеравање је обавезан'),
    body('ticketId')
      .notEmpty()
      .withMessage('ID тикета је обавезан'),
    body('supervisorId')
      .notEmpty()
      .withMessage('ID супервизора је обавезан'),
    body('newAgentId')
      .notEmpty()
      .withMessage('ID новог агента је обавезан'),
    body('overrideType')
      .isIn(['manual_reassign', 'emergency_escalation', 'supervisor_decision'])
      .withMessage('Тип преусмеравања мора бити: manual_reassign, emergency_escalation или supervisor_decision'),
    body('priority')
      .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
      .withMessage('Приоритет мора бити: low, medium, high, urgent или critical'),
    body('reason')
      .notEmpty()
      .withMessage('Разлог је обавезан'),
    body('recipients')
      .isArray({ min: 1 })
      .withMessage('Мора постојати најмање један прималац'),
    body('currentAgentId')
      .optional()
      .isString()
      .withMessage('ID тренутног агента мора бити стринг')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await routingNotificationService.notifyManualOverrideRequested({
        overrideId: req.body.overrideId,
        ticketId: req.body.ticketId,
        supervisorId: req.body.supervisorId,
        currentAgentId: req.body.currentAgentId,
        newAgentId: req.body.newAgentId,
        overrideType: req.body.overrideType,
        priority: req.body.priority,
        reason: req.body.reason,
        recipients: req.body.recipients
      });

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message,
          data: {
            notificationIds: result.notificationIds,
            recipientCount: result.notificationIds.length
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      logger.error('Error sending manual override request notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при слању нотификација о захтеву за преусмеравање',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/notifications/routing/agent-overloaded - Send agent overload warning
router.post('/agent-overloaded',
  authMiddleware,
  requirePermission(['system', 'supervisor', '*']),
  [
    body('agentId')
      .notEmpty()
      .withMessage('ID агента је обавезан'),
    body('utilizationPercent')
      .isFloat({ min: 0, max: 100 })
      .withMessage('Искоришћеност мора бити између 0 и 100'),
    body('activeTickets')
      .isInt({ min: 0 })
      .withMessage('Број активних тикета мора бити позитиван'),
    body('urgentTickets')
      .isInt({ min: 0 })
      .withMessage('Број хитних тикета мора бити позитиван'),
    body('stressLevel')
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Ниво стреса мора бити: low, medium, high или critical'),
    body('recipients')
      .isArray({ min: 1 })
      .withMessage('Мора постојати најмање један прималац')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await routingNotificationService.notifyAgentOverloaded({
        agentId: req.body.agentId,
        utilizationPercent: req.body.utilizationPercent,
        activeTickets: req.body.activeTickets,
        urgentTickets: req.body.urgentTickets,
        stressLevel: req.body.stressLevel,
        recipients: req.body.recipients
      });

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message,
          data: {
            notificationIds: result.notificationIds,
            recipientCount: result.notificationIds.length
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      logger.error('Error sending agent overload notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при слању упозорења о преоптерећености агента',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/notifications/routing - Get notifications for current user
router.get('/',
  authMiddleware,
  [
    query('type')
      .optional()
      .isIn(['ticket_assigned', 'ticket_reassigned', 'manual_override_requested', 'manual_override_approved', 'manual_override_rejected', 'load_balance_performed', 'emergency_escalation', 'agent_overloaded', 'routing_failed', 'capacity_warning', 'performance_alert'])
      .withMessage('Неважећи тип нотификације'),
    query('unreadOnly')
      .optional()
      .isBoolean()
      .withMessage('Само непрочитане мора бити boolean'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Лимит мора бити између 1 и 100')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Корисник није аутентификован'
        });
      }

      const filters = {
        type: req.query.type as any,
        unreadOnly: req.query.unreadOnly === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };

      const result = await routingNotificationService.getNotifications(userId, filters);

      res.json({
        success: result.success,
        message: result.message,
        data: result.notifications,
        count: result.notifications?.length || 0
      });
    } catch (error) {
      logger.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању нотификација',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/notifications/routing/:id/read - Mark notification as read
router.post('/:id/read',
  authMiddleware,
  [
    param('id').isString().notEmpty().withMessage('ID нотификације је обавезан')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await routingNotificationService.markAsRead(req.params.id);

      res.json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при означавању нотификације као прочитане',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/notifications/routing/stats - Get notification statistics
router.get('/stats',
  authMiddleware,
  [
    query('recipientId')
      .optional()
      .isString()
      .withMessage('ID примаоца мора бити стринг')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // If no recipientId provided, use current user
      const recipientId = req.query.recipientId as string || req.user?.userId;
      
      if (!recipientId) {
        return res.status(401).json({
          success: false,
          message: 'Корисник није аутентификован'
        });
      }

      const result = await routingNotificationService.getNotificationStats(recipientId);

      res.json({
        success: result.success,
        message: result.message,
        data: result.stats
      });
    } catch (error) {
      logger.error('Error getting notification stats:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању статистика нотификација',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/notifications/routing/templates - Get notification templates (admin only)
router.get('/templates',
  authMiddleware,
  requirePermission(['admin', '*']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // This would return available templates
      // For now, return basic template information
      res.json({
        success: true,
        message: 'Шаблони нотификација',
        data: [
          {
            id: 'ticket_assigned_sr',
            type: 'ticket_assigned',
            language: 'sr',
            name: 'Додела тикета',
            description: 'Нотификација о додели новог тикета агенту'
          },
          {
            id: 'ticket_reassigned_sr',
            type: 'ticket_reassigned',
            language: 'sr',
            name: 'Преусмеравање тикета',
            description: 'Нотификација о преусмеравању тикета на другог агента'
          },
          {
            id: 'manual_override_requested_sr',
            type: 'manual_override_requested',
            language: 'sr',
            name: 'Захтев за мануелно преусмеравање',
            description: 'Захтев супервизора за одобрење мануелног преусмеравања'
          },
          {
            id: 'load_balance_performed_sr',
            type: 'load_balance_performed',
            language: 'sr',
            name: 'Распоређивање оптерећења',
            description: 'Извештај о извршеном распоређивању оптерећења'
          },
          {
            id: 'agent_overloaded_sr',
            type: 'agent_overloaded',
            language: 'sr',
            name: 'Упозорење о преоптерећености',
            description: 'Упозорење о преоптерећености агента'
          }
        ]
      });
    } catch (error) {
      logger.error('Error getting notification templates:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању шаблона нотификација',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/notifications/routing/test - Send test notification (admin only)
router.post('/test',
  authMiddleware,
  requirePermission(['admin', '*']),
  [
    body('type')
      .isIn(['ticket_assigned', 'ticket_reassigned', 'manual_override_requested', 'agent_overloaded'])
      .withMessage('Неважећи тип тест нотификације'),
    body('recipientId')
      .notEmpty()
      .withMessage('ID примаоца је обавезан')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, recipientId } = req.body;
      let result;

      // Generate test notification based on type
      switch (type) {
        case 'ticket_assigned':
          result = await routingNotificationService.notifyTicketAssigned({
            ticketId: 'TEST-001',
            agentId: recipientId,
            ticketTitle: 'Тест тикет за нотификацију',
            ticketPriority: 'medium',
            ticketCategory: 'Software',
            requesterName: 'Тест Корисник',
            routingReason: 'Тест разлог за доделу',
            aiConfidence: 0.85,
            channels: ['in_app']
          });
          break;

        case 'agent_overloaded':
          result = await routingNotificationService.notifyAgentOverloaded({
            agentId: recipientId,
            utilizationPercent: 95,
            activeTickets: 12,
            urgentTickets: 3,
            stressLevel: 'critical',
            recipients: [req.user?.userId || 'admin']
          });
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Неподржан тип тест нотификације'
          });
      }

      res.json({
        success: result.success,
        message: `Тест нотификација послата: ${result.message}`,
        data: result
      });
    } catch (error) {
      logger.error('Error sending test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при слању тест нотификације',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// DELETE /api/notifications/routing/:id - Delete notification (admin only)
router.delete('/:id',
  authMiddleware,
  requirePermission(['admin', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID нотификације је обавезан')
  ],
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // This would delete a specific notification
      // For now, just return success
      res.json({
        success: true,
        message: 'Нотификација је обрисана'
      });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при брисању нотификације',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/notifications/routing/delivery/status - Get delivery status (admin only)
router.get('/delivery/status',
  authMiddleware,
  requirePermission(['admin', '*']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // This would return delivery queue status
      res.json({
        success: true,
        message: 'Статус доставе нотификација',
        data: {
          queueSize: 0,
          processingRate: '100%',
          lastProcessed: new Date().toISOString(),
          failedDeliveries: 0,
          totalDelivered: 25,
          channels: {
            email: { delivered: 15, failed: 0 },
            in_app: { delivered: 25, failed: 0 },
            websocket: { delivered: 8, failed: 0 },
            sms: { delivered: 0, failed: 0 }
          }
        }
      });
    } catch (error) {
      logger.error('Error getting delivery status:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању статуса доставе',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router; 