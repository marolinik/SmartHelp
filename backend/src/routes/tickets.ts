import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { TicketService } from '../services/ticketService.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { TicketWorkflow, TicketStatus } from '../utils/ticketWorkflow.js';

const router = Router();
const ticketService = new TicketService();

// Validation rules
const createTicketValidation = [
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
  body('categoryId')
    .optional()
    .isString()
    .withMessage('Категорија мора бити валидна'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Приоритет мора бити: low, medium, high или critical'),
  body('assignedTo')
    .optional()
    .isString()
    .withMessage('Додељено мора бити валидан корисник'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Тагови морају бити низ'),
];

const updateTicketValidation = [
  param('id')
    .isString()
    .notEmpty()
    .withMessage('ID тикета је обавезан'),
  body('title')
    .optional()
    .isLength({ min: 5, max: 255 })
    .withMessage('Наслов мора бити између 5 и 255 карактера'),
  body('description')
    .optional()
    .isLength({ min: 10 })
    .withMessage('Опис мора имати најмање 10 карактера'),
  body('status')
    .optional()
    .isIn(['new', 'assigned', 'in_progress', 'pending_user', 'pending_vendor', 'resolved', 'closed', 'on_hold', 'cancelled'])
    .withMessage('Статус није валидан'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Приоритет мора бити: low, medium, high или critical'),
];

// Helper function to handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Грешка валидације',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// GET /api/tickets/categories - Get available categories (move before /:id route)
router.get('/categories',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const categories = await ticketService.getCategories();

      res.json({
        success: true,
        message: 'Категорије успешно учитане',
        data: categories
      });
    } catch (error) {
      logger.error('Грешка при учитавању категорија:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при учитавању категорија'
      });
    }
  }
);

// GET /api/tickets - Get all tickets with filtering and pagination
router.get('/', 
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Страница мора бити позитиван број'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Лимит мора бити између 1 и 100'),
    query('status').optional().isString().withMessage('Статус мора бити стринг'),
    query('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Приоритет није валидан'),
    query('categoryId').optional().isString().withMessage('Категорија мора бити стринг'),
    query('assignedTo').optional().isString().withMessage('Додељено мора бити стринг'),
    query('search').optional().isString().withMessage('Претрага мора бити стринг'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const filters = {
        status: req.query.status as string,
        priority: req.query.priority as string,
        categoryId: req.query.categoryId as string,
        assignedTo: req.query.assignedTo as string,
        requesterId: req.query.requesterId as string,
        search: req.query.search as string,
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });

      const result = await ticketService.getTickets(filters, page, limit);

      res.json({
        success: true,
        message: 'Тикети успешно учитани',
        data: result
      });
    } catch (error) {
      logger.error('Грешка при учитавању тикета:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању тикета',
        error: error instanceof Error ? error.message : 'Непозната грешка'
      });
    }
  }
);

// GET /api/tickets/:id - Get ticket by ID
router.get('/:id',
  authMiddleware,
  [
    param('id').isString().notEmpty().withMessage('ID тикета је обавезан'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const ticket = await ticketService.getTicketById(req.params.id, req.user?.userId);

      res.json({
        success: true,
        message: 'Тикет успешно учитан',
        data: ticket
      });
    } catch (error) {
      logger.error('Грешка при учитавању тикета:', error);
      const statusCode = error instanceof Error && error.message === 'Тикет није пронађен' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при учитавању тикета'
      });
    }
  }
);

// POST /api/tickets - Create new ticket
router.post('/',
  authMiddleware,
  createTicketValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const ticketData = {
        ...req.body,
        requesterId: req.user?.userId || req.body.requesterId
      };

      const ticket = await ticketService.createTicket(ticketData);

      res.status(201).json({
        success: true,
        message: 'Тикет успешно креиран',
        data: ticket
      });
    } catch (error) {
      logger.error('Грешка при креирању тикета:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при креирању тикета'
      });
    }
  }
);

// PUT /api/tickets/:id - Update ticket
router.put('/:id',
  authMiddleware,
  updateTicketValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const ticket = await ticketService.updateTicket(
        req.params.id,
        req.body,
        req.user?.userId || 'unknown'
      );

      res.json({
        success: true,
        message: 'Тикет успешно ажуриран',
        data: ticket
      });
    } catch (error) {
      logger.error('Грешка при ажурирању тикета:', error);
      const statusCode = error instanceof Error && error.message === 'Тикет није пронађен' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при ажурирању тикета'
      });
    }
  }
);

// PUT /api/tickets/:id/assign - Assign ticket to user
router.put('/:id/assign',
  authMiddleware,
  requirePermission(['tickets.assign', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID тикета је обавезан'),
    body('assignedTo').isString().notEmpty().withMessage('Корисник за доделу је обавезан'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const ticket = await ticketService.assignTicket(
        req.params.id,
        req.body.assignedTo,
        req.user?.userId || 'unknown'
      );

      res.json({
        success: true,
        message: 'Тикет успешно додељен',
        data: ticket
      });
    } catch (error) {
      logger.error('Грешка при додели тикета:', error);
      const statusCode = error instanceof Error && error.message === 'Тикет није пронађен' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при додели тикета'
      });
    }
  }
);

// DELETE /api/tickets/:id - Delete (cancel) ticket
router.delete('/:id',
  authMiddleware,
  requirePermission(['tickets.delete', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID тикета је обавезан'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      await ticketService.deleteTicket(req.params.id, req.user?.userId || 'unknown');

      res.json({
        success: true,
        message: 'Тикет успешно обрисан'
      });
    } catch (error) {
      logger.error('Грешка при брисању тикета:', error);
      const statusCode = error instanceof Error && error.message === 'Тикет није пронађен' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при брисању тикета'
      });
    }
  }
);

// GET /api/tickets/workflow/statuses - Get all available statuses with Serbian labels
router.get('/workflow/statuses',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const statuses = TicketWorkflow.getAllStatuses();

      res.json({
        success: true,
        message: 'Статуси успешно учитани',
        data: statuses
      });
    } catch (error) {
      logger.error('Грешка при учитавању статуса:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при учитавању статуса'
      });
    }
  }
);

// GET /api/tickets/workflow/priorities - Get all available priorities with Serbian labels
router.get('/workflow/priorities',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const priorities = TicketWorkflow.getAllPriorities();

      res.json({
        success: true,
        message: 'Приоритети успешно учитани',
        data: priorities
      });
    } catch (error) {
      logger.error('Грешка при учитавању приоритета:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при учитавању приоритета'
      });
    }
  }
);

// GET /api/tickets/:id/workflow/transitions - Get allowed status transitions for specific ticket
router.get('/:id/workflow/transitions',
  authMiddleware,
  [
    param('id').isString().notEmpty().withMessage('ID тикета је обавезан'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const ticket = await ticketService.getTicketById(req.params.id);
      const currentStatus = ticket.status as TicketStatus;
      const allowedTransitions = TicketWorkflow.getAllowedTransitions(currentStatus);
      
      const transitionsWithLabels = allowedTransitions.map(status => ({
        value: status,
        label: TicketWorkflow.getStatusLabel(status),
        description: TicketWorkflow.getStatusDescription(status),
        color: TicketWorkflow.getStatusColor(status)
      }));

      res.json({
        success: true,
        message: 'Дозвољене транзиције успешно учитане',
        data: {
          currentStatus: {
            value: currentStatus,
            label: TicketWorkflow.getStatusLabel(currentStatus),
            description: TicketWorkflow.getStatusDescription(currentStatus),
            color: TicketWorkflow.getStatusColor(currentStatus)
          },
          allowedTransitions: transitionsWithLabels
        }
      });
    } catch (error) {
      logger.error('Грешка при учитавању транзиција:', error);
      const statusCode = error instanceof Error && error.message === 'Тикет није пронађен' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при учитавању транзиција'
      });
    }
  }
);

// PUT /api/tickets/:id/status - Change ticket status with workflow validation
router.put('/:id/status',
  authMiddleware,
  [
    param('id').isString().notEmpty().withMessage('ID тикета је обавезан'),
    body('status').isString().notEmpty().withMessage('Статус је обавезан'),
    body('resolutionNotes').optional().isString().withMessage('Напомене решења морају бити стринг'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const ticket = await ticketService.updateTicket(
        req.params.id,
        { 
          status: req.body.status as TicketStatus,
          resolutionNotes: req.body.resolutionNotes 
        },
        req.user?.userId || 'unknown'
      );

      res.json({
        success: true,
        message: `Статус тикета промењен на "${TicketWorkflow.getStatusLabel(req.body.status)}"`,
        data: ticket
      });
    } catch (error) {
      logger.error('Грешка при промени статуса:', error);
      const statusCode = error instanceof Error && error.message === 'Тикет није пронађен' ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при промени статуса'
      });
    }
  }
);

export default router; 