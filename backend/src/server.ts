import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createServer } from 'http';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import SlaMonitoringService from './services/SlaMonitoringService.js';
import WebSocketService from './services/WebSocketService.js';
import securityScanScheduler from './services/securityScanScheduler.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import ticketRoutes from './routes/tickets.js';
import slaRoutes from './routes/slaRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import kbRoutes from './routes/kbRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import anonymizationRoutes from './routes/anonymizationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import ticketRoutingRoutes from './routes/ticketRouting.js';
import manualOverrideRoutes from './routes/manualOverrideRoutes.js';
import routingNotificationRoutes from './routes/routingNotificationRoutes.js';
import routingDashboardRoutes from './routes/routingDashboardRoutes.js';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Превише захтева са ове IP адресе. Покушајте поново за 15 минута.',
    message: 'Too many requests from this IP. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// Static files middleware - служење upload-ованих фајлова
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  maxAge: '1y', // Cache за годину дана
  etag: true,
  lastModified: true
}));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'PIO Help Desk API је активан',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: 'Not connected (development mode)',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/tickets', authMiddleware, ticketRoutes);
app.use('/api/sla', authMiddleware, slaRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/anonymization', anonymizationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/routing', authMiddleware, ticketRoutingRoutes);
app.use('/api/overrides', authMiddleware, manualOverrideRoutes);
app.use('/api/notifications/routing', authMiddleware, routingNotificationRoutes);
app.use('/api/routing/dashboard', authMiddleware, routingDashboardRoutes);

// Serbian language error messages for 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Страница није пронађена',
    message: 'Захтевана страница не постоји',
    path: req.originalUrl,
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown handlers
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} signal received. Shutting down gracefully...`);
  
  // Зауставља SLA мониторинг
  SlaMonitoringService.stop();
  
  // Зауставља security scan scheduler
  securityScanScheduler.stopAll();
  
  try {
    // Try to disconnect from database if connected
    const { disconnectDatabase } = await import('./database/prisma.js');
    await disconnectDatabase();
  } catch (error) {
    logger.warn('Database was not connected or failed to disconnect');
  }
  
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = config.server.port || 5000;

// Initialize database connection (optional in development)
async function initializeDatabase() {
  try {
    const { connectDatabase } = await import('./database/prisma.js');
    await connectDatabase();
    logger.info('✅ База података је успешно повезана');
    
    // Покрени SLA мониторинг након успешног повезивања
    SlaMonitoringService.start();
    
    // Покрени security scan scheduler
    try {
      securityScanScheduler.initialize();
      logger.info('✅ Security scan scheduler је покренут');
    } catch (error) {
      logger.warn('⚠️ Security scan scheduler није могао бити покренут:', error);
    }
    
  } catch (error) {
    logger.warn('⚠️ База података није доступна - покретање у development режиму');
    logger.warn('Неке функције неће бити доступне без базе података');
  }
}

// Креирај HTTP сервер за Socket.io интеграцију
const httpServer = createServer(app);

// Иницијализуј WebSocket сервер
WebSocketService.initialize(httpServer);

httpServer.listen(PORT, async () => {
  logger.info(`🚀 PIO Help Desk Server покренут на порту ${PORT}`);
  logger.info(`📚 API документација: http://localhost:${PORT}/api/docs`);
  logger.info(`🌐 Језик: Српски (примарни)`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(`⚡ WebSocket нотификације: ws://localhost:${PORT}`);
  
  // Try to initialize database after server starts
  await initializeDatabase();
}); 