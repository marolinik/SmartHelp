import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { SlaAlert } from './SlaMonitoringService.js';

export interface WebSocketNotification {
  type: 'sla_alert' | 'sla_escalation' | 'ticket_update' | 'system_notification';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  data?: any;
  timestamp: Date;
  userId?: string; // За персонализоване нотификације
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers = new Map<string, Set<string>>(); // userId -> socketIds

  /**
   * Иницијализује WebSocket сервер
   */
  initialize(httpServer: HttpServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: ["http://localhost:3000", "http://localhost:3001"],
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    logger.info('🔗 WebSocket сервер покренут за real-time нотификације');
  }

  /**
   * Обрађује нову WebSocket конекцију
   */
  private handleConnection(socket: Socket): void {
    logger.info(`👤 Нова WebSocket конекција: ${socket.id}`);

    // Аутентификација корисника
    socket.on('authenticate', (data: { userId: string, token: string }) => {
      // Овде би требало валидирати токен
      // За сада једноставно бележимо корисника
      this.addUserConnection(data.userId, socket.id);
      socket.join(`user_${data.userId}`);
      socket.emit('authenticated', { 
        success: true, 
        message: 'Успешно повезани за нотификације' 
      });
      
      logger.info(`✅ Корисник ${data.userId} аутентификован (socket: ${socket.id})`);
    });

    // Подршка за админе да се придруже свим канадима
    socket.on('join_admin', (data: { userId: string }) => {
      socket.join('admin_notifications');
      socket.join('sla_alerts');
      logger.info(`👑 Админ ${data.userId} придружен свим каналима`);
    });

    socket.on('disconnect', () => {
      this.removeUserConnection(socket.id);
      logger.info(`👋 WebSocket конекција затворена: ${socket.id}`);
    });
  }

  /**
   * Додаје корисникову конекцију
   */
  private addUserConnection(userId: string, socketId: string): void {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)?.add(socketId);
  }

  /**
   * Уклања корисникову конекцију
   */
  private removeUserConnection(socketId: string): void {
    for (const [userId, socketIds] of this.connectedUsers.entries()) {
      if (socketIds.has(socketId)) {
        socketIds.delete(socketId);
        if (socketIds.size === 0) {
          this.connectedUsers.delete(userId);
        }
        break;
      }
    }
  }

  /**
   * Шаље нотификацију одређеном кориснику
   */
  sendToUser(userId: string, notification: WebSocketNotification): void {
    if (!this.io) return;

    const userSockets = this.connectedUsers.get(userId);
    if (userSockets && userSockets.size > 0) {
      userSockets.forEach(socketId => {
        this.io?.to(socketId).emit('notification', notification);
      });
      logger.info(`📤 Нотификација послата кориснику ${userId}: ${notification.message}`);
    }
  }

  /**
   * Шаље нотификацију свим админима
   */
  sendToAdmins(notification: WebSocketNotification): void {
    if (!this.io) return;

    this.io.to('admin_notifications').emit('notification', notification);
    logger.info(`📤 Админ нотификација: ${notification.message}`);
  }

  /**
   * Шаље нотификацију свим корисницима
   */
  broadcast(notification: WebSocketNotification): void {
    if (!this.io) return;

    this.io.emit('notification', notification);
    logger.info(`📢 Глобална нотификација: ${notification.message}`);
  }

  /**
   * Шаље SLA алерт као real-time нотификацију
   */
  sendSlaAlert(alert: SlaAlert, ticketData?: any): void {
    if (!this.io) return;

    const isBreech = alert.alertType.includes('breach');
    const notification: WebSocketNotification = {
      type: 'sla_alert',
      title: isBreech ? '🚨 SLA Прекршај!' : '⚠️ SLA Упозорење',
      message: alert.message,
      priority: alert.priority as any,
      timestamp: new Date(),
      data: {
        ticketId: alert.ticketId,
        ticketNumber: alert.ticketNumber,
        alertType: alert.alertType,
        category: alert.category,
        dueDate: alert.dueDate,
        timeRemaining: alert.timeRemaining,
        ...ticketData
      }
    };

    // Пошаљи свим админима
    this.sendToAdmins(notification);

    // Пошаљи додељеном кориснику ако постоји
    if (ticketData?.assignedTo) {
      this.sendToUser(ticketData.assignedTo, notification);
    }

    // Пошаљи кориснику који је креирао тикет
    if (ticketData?.requesterId) {
      this.sendToUser(ticketData.requesterId, notification);
    }

    // За критичне прекршаје, пошаљи свима
    if (isBreech && alert.priority === 'critical') {
      this.broadcast(notification);
    }
  }

  /**
   * Шаље нотификацију о ескалацији
   */
  sendEscalationAlert(ticketNumber: string, level: number, escalatedTo: string, message: string): void {
    const notification: WebSocketNotification = {
      type: 'sla_escalation',
      title: `🔺 Ескалација Нивоа ${level}`,
      message: message,
      priority: 'high',
      timestamp: new Date(),
      data: {
        ticketNumber,
        escalationLevel: level,
        escalatedTo
      }
    };

    // Пошаљи админима и ескалираном кориснику
    this.sendToAdmins(notification);
    this.sendToUser(escalatedTo, notification);
  }

  /**
   * Шаље нотификацију о ажурирању тикета
   */
  sendTicketUpdate(ticketId: string, ticketNumber: string, change: string, userId?: string): void {
    const notification: WebSocketNotification = {
      type: 'ticket_update',
      title: 'Тикет Ажуриран',
      message: `Тикет ${ticketNumber}: ${change}`,
      priority: 'medium',
      timestamp: new Date(),
      data: {
        ticketId,
        ticketNumber,
        change
      }
    };

    if (userId) {
      this.sendToUser(userId, notification);
    } else {
      this.sendToAdmins(notification);
    }
  }

  /**
   * Добија број повезаних корисника
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Добија број активних конекција
   */
  getActiveConnectionsCount(): number {
    let total = 0;
    this.connectedUsers.forEach(socketIds => {
      total += socketIds.size;
    });
    return total;
  }

  /**
   * Добија статус WebSocket сервера
   */
  getStatus(): { 
    isRunning: boolean; 
    connectedUsers: number; 
    activeConnections: number; 
  } {
    return {
      isRunning: this.io !== null,
      connectedUsers: this.getConnectedUsersCount(),
      activeConnections: this.getActiveConnectionsCount()
    };
  }
}

export default new WebSocketService(); 