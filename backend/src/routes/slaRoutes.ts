import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import SlaService from '../services/SlaService';
import SlaMonitoringService from '../services/SlaMonitoringService';
import SlaReportingService from '../services/SlaReportingService';
import WebSocketService from '../services/WebSocketService';
import { PrismaClient } from '@prisma/client';
import { subDays, subWeeks, subMonths } from 'date-fns';

const router = Router();
const prisma = new PrismaClient();

// Примена аутентификације на све SLA руте
router.use(authMiddleware);

/**
 * GET /api/sla/calculate/:ticketId
 * Израчунава SLA метрике за специфичан тикет
 */
router.get('/calculate/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: 'Недостаје ID тикета'
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { category: true }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Тикет није пронађен'
      });
    }

    const slaResult = await SlaService.calculateSlaForTicket(
      ticket.id,
      ticket.categoryId,
      ticket.priority,
      ticket.createdAt
    );

    res.json({
      success: true,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ...slaResult,
        calculatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Грешка при рачунању SLA метрика:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при рачунању SLA метрика',
      error: error.message
    });
  }
});

/**
 * PUT /api/sla/update/:ticketId
 * Ажурира SLA метрике за тикет
 */
router.put('/update/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: 'Недостаје ID тикета'
      });
    }

    const slaResult = await SlaService.updateTicketSlaMetrics(ticketId);

    res.json({
      success: true,
      message: 'SLA метрике успешно ажуриране',
      data: slaResult
    });
  } catch (error: any) {
    console.error('Грешка при ажурирању SLA метрика:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при ажурирању SLA метрика',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/policies
 * Добија све активне SLA политике
 */
router.get('/policies', async (req: Request, res: Response) => {
  try {
    const policies = await prisma.slaPolicy.findMany({
      where: { isActive: true },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: policies
    });
  } catch (error: any) {
    console.error('Грешка при добијању SLA политика:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању SLA политика',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/business-hours
 * Добија радне сате
 */
router.get('/business-hours', async (req: Request, res: Response) => {
  try {
    const businessHours = await prisma.businessHours.findMany({
      orderBy: { dayOfWeek: 'asc' }
    });

    // Мапирање дана недеље на српски
    const daysMap: { [key: number]: string } = {
      0: 'Недеља',
      1: 'Понедељак', 
      2: 'Уторак',
      3: 'Среда',
      4: 'Четвртак',
      5: 'Петак',
      6: 'Субота'
    };

    const formattedHours = businessHours.map(bh => ({
      ...bh,
      dayName: daysMap[bh.dayOfWeek],
      isWorkingDayText: bh.isWorkingDay ? 'Радни дан' : 'Нерадни дан'
    }));

    res.json({
      success: true,
      data: formattedHours
    });
  } catch (error: any) {
    console.error('Грешка при добијању радних сати:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању радних сати',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/holidays
 * Добија празнике за тренутну годину
 */
router.get('/holidays', async (req: Request, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    const year = parseInt(req.query.year as string) || currentYear;

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`)
        },
        isActive: true
      },
      orderBy: { date: 'asc' }
    });

    res.json({
      success: true,
      data: holidays,
      meta: {
        year,
        count: holidays.length
      }
    });
  } catch (error: any) {
    console.error('Грешка при добијању празника:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању празника',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/metrics/:ticketId
 * Добија детаљне SLA метрике за тикет
 */
router.get('/metrics/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: 'Недостаје ID тикета'
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { category: true }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Тикет није пронађен'
      });
    }

    const endDate = ticket.resolvedAt || new Date();
    const metrics = await SlaService.calculateSlaMetrics(
      ticket.createdAt,
      endDate,
      true // business hours only
    );

    res.json({
      success: true,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        createdAt: ticket.createdAt,
        resolvedAt: ticket.resolvedAt,
        status: ticket.status,
        ...metrics
      }
    });
  } catch (error: any) {
    console.error('Грешка при добијању SLA метрика:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању SLA метрика',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/events/:ticketId
 * Добија SLA догађаје за тикет
 */
router.get('/events/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: 'Недостаје ID тикета'
      });
    }

    const events = await prisma.slaEvent.findMany({
      where: { ticketId },
      include: {
        slaPolicy: {
          select: {
            id: true,
            name: true
          }
        },
        escalatedToUser: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: events
    });
  } catch (error: any) {
    console.error('Грешка при добијању SLA догађаја:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању SLA догађаја',
      error: error.message
    });
  }
});

/**
 * POST /api/sla/events
 * Креира нови SLA догађај
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { ticketId, slaPolicyId, eventType, dueDate, message } = req.body;

    if (!ticketId || !slaPolicyId || !eventType || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Недостају обавезни параметри: ticketId, slaPolicyId, eventType, dueDate'
      });
    }

    const event = await SlaService.createSlaEvent(
      ticketId,
      slaPolicyId,
      eventType,
      new Date(dueDate),
      message
    );

    res.status(201).json({
      success: true,
      message: 'SLA gebeurtenaj успешно креиран',
      data: event
    });
  } catch (error: any) {
    console.error('Грешка при креирању SLA догађаја:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при креирању SLA догађаја',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/dashboard
 * Добија SLA дашборд податке
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    // Преглед тикета по SLA статусу
    const slaStatusCounts = await prisma.ticket.groupBy({
      by: ['slaStatus'],
      _count: {
        id: true
      },
      where: {
        status: {
          notIn: ['closed', 'cancelled']
        }
      }
    });

    // Тикети у опасности од прекршаја SLA
    const riskTickets = await prisma.ticket.findMany({
      where: {
        slaStatus: 'warning',
        status: {
          notIn: ['closed', 'resolved', 'cancelled']
        }
      },
      include: {
        category: true,
        requester: {
          select: {
            displayName: true,
            email: true
          }
        }
      },
      orderBy: {
        slaResolutionDue: 'asc'
      },
      take: 10
    });

    // SLA прекршаји данас
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const todayBreaches = await prisma.ticket.count({
      where: {
        slaStatus: 'breached',
        updatedAt: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });

    res.json({
      success: true,
      data: {
        slaStatusCounts,
        riskTickets,
        todayBreaches,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Грешка при добијању дашборд података:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању дашборд података',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/monitoring/status
 * Добија статус SLA мониторинга
 */
router.get('/monitoring/status', async (req: Request, res: Response) => {
  try {
    const status = SlaMonitoringService.getStatus();
    
    res.json({
      success: true,
      data: {
        ...status,
        message: status.isRunning 
          ? `SLA мониторинг активан (провера сваки ${status.checkInterval / 1000} секунди)`
          : 'SLA мониторинг није активан'
      }
    });
  } catch (error: any) {
    console.error('Грешка при добијању статуса мониторинга:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању статуса мониторинга',
      error: error.message
    });
  }
});

/**
 * POST /api/sla/monitoring/start
 * Покреће SLA мониторинг
 */
router.post('/monitoring/start', async (req: Request, res: Response) => {
  try {
    SlaMonitoringService.start();
    
    res.json({
      success: true,
      message: 'SLA мониторинг покренут'
    });
  } catch (error: any) {
    console.error('Грешка при покретању мониторинга:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при покретању мониторинга',
      error: error.message
    });
  }
});

/**
 * POST /api/sla/monitoring/stop
 * Зауставља SLA мониторинг
 */
router.post('/monitoring/stop', async (req: Request, res: Response) => {
  try {
    SlaMonitoringService.stop();
    
    res.json({
      success: true,
      message: 'SLA мониторинг заустављен'
    });
  } catch (error: any) {
    console.error('Грешка при заустављању мониторинга:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при заустављању мониторинга',
      error: error.message
    });
  }
});

/**
 * POST /api/sla/monitoring/check
 * Форсира проверу SLA статуса
 */
router.post('/monitoring/check', async (req: Request, res: Response) => {
  try {
    await SlaMonitoringService.forceCheck();
    
    res.json({
      success: true,
      message: 'SLA провера завршена'
    });
  } catch (error: any) {
    console.error('Грешка при форсираној провери:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при форсираној провери',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/alerts
 * Добија најновије SLA алерте
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const alerts = await prisma.slaEvent.findMany({
      where: {
        eventType: {
          in: ['response_warning', 'response_breach', 'resolution_warning', 'resolution_breach']
        }
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            priority: true,
            status: true
          }
        },
        slaPolicy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    res.json({
      success: true,
      data: alerts,
      meta: {
        limit,
        offset,
        count: alerts.length
      }
    });
  } catch (error: any) {
    console.error('Грешка при добијању алерата:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању алерата',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/escalations
 * Добија ескалације
 */
router.get('/escalations', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const escalations = await prisma.slaEvent.findMany({
      where: {
        eventType: 'escalation'
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            priority: true,
            status: true
          }
        },
        escalatedToUser: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    res.json({
      success: true,
      data: escalations,
      meta: {
        limit,
        offset,
        count: escalations.length
      }
    });
  } catch (error: any) {
    console.error('Грешка при добијању ескалација:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању ескалација',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/websocket/status
 * Добија статус WebSocket сервиса
 */
router.get('/websocket/status', async (req: Request, res: Response) => {
  try {
    const status = WebSocketService.getStatus();
    
    res.json({
      success: true,
      data: {
        ...status,
        message: status.isRunning 
          ? `WebSocket активан (${status.connectedUsers} корисника, ${status.activeConnections} конекција)`
          : 'WebSocket није активан'
      }
    });
  } catch (error: any) {
    console.error('Грешка при добијању WebSocket статуса:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању WebSocket статуса',
      error: error.message
    });
  }
});

/**
 * POST /api/sla/websocket/test
 * Тестира WebSocket нотификације
 */
router.post('/websocket/test', async (req: Request, res: Response) => {
  try {
    const { userId, message } = req.body;
    
    WebSocketService.sendToUser(userId || 'test', {
      type: 'system_notification',
      title: 'Тест нотификација',
      message: message || 'Ово је тест real-time нотификације',
      priority: 'medium',
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Тест нотификација послата'
    });
  } catch (error: any) {
    console.error('Грешка при слању тест нотификације:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при слању тест нотификације',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/reports/generate
 * Генерише SLA извештај за дати период
 */
router.get('/reports/generate', async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate, 
      reportType = 'weekly',
      preset 
    } = req.query;

    let fromDate: Date;
    let toDate: Date = new Date();

    // Обради preset период-е
    if (preset) {
      switch (preset) {
        case 'last7days':
          fromDate = subDays(toDate, 7);
          break;
        case 'last30days':
          fromDate = subDays(toDate, 30);
          break;
        case 'lastWeek':
          fromDate = subWeeks(toDate, 1);
          break;
        case 'lastMonth':
          fromDate = subMonths(toDate, 1);
          break;
        case 'last3months':
          fromDate = subMonths(toDate, 3);
          break;
        default:
          fromDate = subDays(toDate, 7);
      }
    } else {
      // Користи дате из query-ја
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Недостају датуми или preset период'
        });
      }
      fromDate = new Date(startDate as string);
      toDate = new Date(endDate as string);
    }

    const report = await SlaReportingService.generateSlaReport(
      fromDate,
      toDate,
      reportType as 'daily' | 'weekly' | 'monthly'
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    console.error('Грешка при генерисању SLA извештаја:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при генерисању SLA извештаја',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/reports/metrics
 * Добија основне SLA метрике за период
 */
router.get('/reports/metrics', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Недостају датуми периода'
      });
    }

    const fromDate = new Date(startDate as string);
    const toDate = new Date(endDate as string);

    const metrics = await SlaReportingService.calculateSlaMetrics(fromDate, toDate);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    console.error('Грешка при рачунању SLA метрика:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при рачунању SLA метрика',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/reports/performance-trend
 * Добија тренд перформанси за период
 */
router.get('/reports/performance-trend', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, reportType = 'daily' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Недостају датуми периода'
      });
    }

    const fromDate = new Date(startDate as string);
    const toDate = new Date(endDate as string);

    const trend = await SlaReportingService.generatePerformanceTrend(
      fromDate,
      toDate,
      reportType as 'daily' | 'weekly' | 'monthly'
    );

    res.json({
      success: true,
      data: trend
    });
  } catch (error: any) {
    console.error('Грешка при генерисању тренда перформанси:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при генерисању тренда перформанси',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/reports/breach-analysis
 * Анализира SLA прекршаје за период
 */
router.get('/reports/breach-analysis', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Недостају датуми периода'
      });
    }

    const fromDate = new Date(startDate as string);
    const toDate = new Date(endDate as string);

    const analysis = await SlaReportingService.analyzeSlaBreaches(fromDate, toDate);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    console.error('Грешка при анализи SLA прекршаја:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при анализи SLA прекршаја',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/reports/top-violating-categories
 * Добија категорије са највише SLA прекршаја
 */
router.get('/reports/top-violating-categories', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, limit = 5 } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Недостају датуми периода'
      });
    }

    const fromDate = new Date(startDate as string);
    const toDate = new Date(endDate as string);

    const categories = await SlaReportingService.getTopViolatingCategories(
      fromDate,
      toDate,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: categories
    });
  } catch (error: any) {
    console.error('Грешка при добијању категорија са прекршајима:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању категорија са прекршајима',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/reports/export/csv
 * Експортује SLA извештај у CSV формат
 */
router.get('/reports/export/csv', async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate, 
      reportType = 'weekly' 
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Недостају датуми периода'
      });
    }

    const fromDate = new Date(startDate as string);
    const toDate = new Date(endDate as string);

    const report = await SlaReportingService.generateSlaReport(
      fromDate,
      toDate,
      reportType as 'daily' | 'weekly' | 'monthly'
    );

    const csvContent = await SlaReportingService.exportReportToCsv(report);

    // Подеси CSV response headers
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="SLA_Izvestaj_${fromDate.toISOString().split('T')[0]}_${toDate.toISOString().split('T')[0]}.csv"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Додај BOM за правилан приказ српских карактера у Excel-у
    res.send('\uFEFF' + csvContent);
  } catch (error: any) {
    console.error('Грешка при експорту CSV-а:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при експорту CSV-а',
      error: error.message
    });
  }
});

/**
 * GET /api/sla/reports/dashboard-summary
 * Добија сажетак за SLA дашборд
 */
router.get('/reports/dashboard-summary', async (req: Request, res: Response) => {
  try {
    // Метрике за задњих 7 дана
    const last7Days = subDays(new Date(), 7);
    const today = new Date();

    const currentMetrics = await SlaReportingService.calculateSlaMetrics(last7Days, today);
    
    // Поређење са претходних 7 дана
    const previous7Days = subDays(last7Days, 7);
    const previousMetrics = await SlaReportingService.calculateSlaMetrics(previous7Days, last7Days);

    // Рачунај промене у процентима
    const complianceChange = currentMetrics.complianceRate - previousMetrics.complianceRate;
    const responseTimeChange = currentMetrics.averageResponseTime - previousMetrics.averageResponseTime;
    const resolutionTimeChange = currentMetrics.averageResolutionTime - previousMetrics.averageResolutionTime;

    // Топ категорије са прекршајима (задњих 30 дана)
    const last30Days = subDays(new Date(), 30);
    const topCategories = await SlaReportingService.getTopViolatingCategories(last30Days, today, 5);

    // Тренд прекршаја за задњих 14 дана
    const last14Days = subDays(new Date(), 14);
    const breachAnalysis = await SlaReportingService.analyzeSlaBreaches(last14Days, today);

    res.json({
      success: true,
      data: {
        currentPeriod: {
          from: last7Days,
          to: today,
          metrics: currentMetrics
        },
        previousPeriod: {
          from: previous7Days,
          to: last7Days,
          metrics: previousMetrics
        },
        changes: {
          complianceRate: Math.round(complianceChange * 100) / 100,
          averageResponseTime: Math.round(responseTimeChange * 100) / 100,
          averageResolutionTime: Math.round(resolutionTimeChange * 100) / 100
        },
        topViolatingCategories: topCategories,
        breachTrend: breachAnalysis.breachTrend.slice(-7), // Задњих 7 дана
        summary: {
          label: 'SLA Дашборд - Преглед задњих 7 дана',
          generatedAt: new Date().toISOString()
        }
      }
    });
  } catch (error: any) {
    console.error('Грешка при генерисању дашборд сажетка:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при генерисању дашборд сажетка',
      error: error.message
    });
  }
});

export default router; 