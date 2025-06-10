import { Router, Request, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import EmailService from '../services/EmailService.js';
import { PrismaClient } from '@prisma/client';
import { SerbianFormat } from '../utils/serbianFormatting';

const router = Router();
const prisma = new PrismaClient();

// Примени аутентификацију на све email руте
router.use(authMiddleware);

/**
 * GET /api/email/config/test
 * Тестира email конфигурацију
 */
router.get('/config/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Провери да ли корисник има админске дозволе
    const user = req.user;
    if (user?.role?.name !== 'admin' && !user?.role?.permissions?.includes('manage_email')) {
      return res.status(403).json({
        success: false,
        message: 'Немате дозволу за тестирање email конфигурације',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const testResult = await EmailService.testEmailConfiguration();
    
    res.json({
      success: testResult.success,
      message: testResult.message,
      isAvailable: EmailService.isAvailable()
    });
  } catch (error: any) {
    console.error('Грешка при тестирању email конфигурације:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при тестирању email конфигурације',
      error: error.message
    });
  }
});

/**
 * POST /api/email/test
 * Шаље тест email
 */
router.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (user?.role?.name !== 'admin' && !user?.role?.permissions?.includes('manage_email')) {
      return res.status(403).json({
        success: false,
        message: 'Немате дозволу за слање тест email-а',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Недостају обавезни параметри: to, subject, message',
        code: 'MISSING_PARAMETERS'
      });
    }

    if (!EmailService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Email сервис није доступан',
        code: 'EMAIL_SERVICE_UNAVAILABLE'
      });
    }

    const testHtml = `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Тест Email</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Тест Email</h1>
            <p>PIO Help Desk систем</p>
        </div>
        <div class="content">
            <h2>Тест порука</h2>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <p><small>Послао: ${user?.displayName} (${user?.email})</small></p>
            <p><small>Време: ${SerbianFormat.formatDateTime(new Date())}</small></p>
        </div>
        <div class="footer">
            <p>Ово је тест порука из PIO Help Desk система.</p>
            <p>Републички фонд за пензијско и инвалидско осигурање</p>
        </div>
    </div>
</body>
</html>`;

    const success = await EmailService.sendEmail(to, subject, testHtml);

    if (success) {
      res.json({
        success: true,
        message: 'Тест email је успешно послат'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Грешка при слању тест email-а'
      });
    }
  } catch (error: any) {
    console.error('Грешка при слању тест email-а:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при слању тест email-а',
      error: error.message
    });
  }
});

/**
 * POST /api/email/notifications/ticket-created
 * Шаље нотификацију о креираном тикету
 */
router.post('/notifications/ticket-created', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: 'Недостаје ID тикета',
        code: 'MISSING_TICKET_ID'
      });
    }

    // Добиј тикет са свим потребним подацима
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: {
          select: {
            displayName: true,
            email: true
          }
        },
        assignee: {
          select: {
            displayName: true,
            email: true
          }
        },
        category: {
          select: {
            name: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Тикет није пронађен',
        code: 'TICKET_NOT_FOUND'
      });
    }

    if (!EmailService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Email сервис није доступан',
        code: 'EMAIL_SERVICE_UNAVAILABLE'
      });
    }

    const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}`;

    const emailData = {
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      category: ticket.category?.name || undefined,
      requesterName: ticket.requester.displayName || 'Непознат корисник',
      requesterEmail: ticket.requester.email,
      assigneeName: ticket.assignee?.displayName || undefined,
      assigneeEmail: ticket.assignee?.email || undefined,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      ticketUrl
    };

    const success = await EmailService.sendNewTicketNotification(emailData);

    if (success) {
      res.json({
        success: true,
        message: 'Нотификација о новом тикету је послата'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Грешка при слању нотификације'
      });
    }
  } catch (error: any) {
    console.error('Грешка при слању нотификације о тикету:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при слању нотификације о тикету',
      error: error.message
    });
  }
});

/**
 * POST /api/email/notifications/ticket-updated
 * Шаље нотификацију о ажурираном тикету
 */
router.post('/notifications/ticket-updated', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ticketId, updateType, resolutionNotes } = req.body;

    if (!ticketId || !updateType) {
      return res.status(400).json({
        success: false,
        message: 'Недостају обавезни параметри: ticketId, updateType',
        code: 'MISSING_PARAMETERS'
      });
    }

    const validUpdateTypes = ['status', 'assignment', 'comment', 'resolution'];
    if (!validUpdateTypes.includes(updateType)) {
      return res.status(400).json({
        success: false,
        message: 'Неважећи тип ажурирања',
        code: 'INVALID_UPDATE_TYPE'
      });
    }

    // Добиј тикет са свим потребним подацима
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: {
          select: {
            displayName: true,
            email: true
          }
        },
        assignee: {
          select: {
            displayName: true,
            email: true
          }
        },
        category: {
          select: {
            name: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Тикет није пронађен',
        code: 'TICKET_NOT_FOUND'
      });
    }

    if (!EmailService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Email сервис није доступан',
        code: 'EMAIL_SERVICE_UNAVAILABLE'
      });
    }

    const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}`;

    const emailData = {
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      category: ticket.category?.name || undefined,
      requesterName: ticket.requester.displayName || 'Непознат корисник',
      requesterEmail: ticket.requester.email,
      assigneeName: ticket.assignee?.displayName || undefined,
      assigneeEmail: ticket.assignee?.email || undefined,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolutionNotes: resolutionNotes || ticket.resolutionNotes,
      ticketUrl
    };

    const success = await EmailService.sendTicketUpdateNotification(emailData, updateType);

    if (success) {
      res.json({
        success: true,
        message: 'Нотификација о ажурирању тикета је послата'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Грешка при слању нотификације'
      });
    }
  } catch (error: any) {
    console.error('Грешка при слању нотификације о ажурирању:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при слању нотификације о ажурирању',
      error: error.message
    });
  }
});

/**
 * GET /api/email/status
 * Добија статус email сервиса
 */
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAvailable = EmailService.isAvailable();
    let testResult = null;

    if (isAvailable) {
      testResult = await EmailService.testEmailConfiguration();
    }

    res.json({
      success: true,
      data: {
        isAvailable,
        isConfigured: isAvailable,
        testResult: testResult || {
          success: false,
          message: 'Email сервис није конфигурисан'
        },
        configuration: {
          host: process.env.EMAIL_HOST || 'Није конфигурисано',
          port: process.env.EMAIL_PORT || 'Није конфигурисано',
          from: process.env.EMAIL_FROM || 'Није конфигурисано',
          hasCredentials: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
        }
      }
    });
  } catch (error: any) {
    console.error('Грешка при добијању статуса email сервиса:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању статуса email сервиса',
      error: error.message
    });
  }
});

export default router; 