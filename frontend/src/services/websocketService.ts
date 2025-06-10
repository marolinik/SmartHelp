import { io, Socket } from 'socket.io-client';

export interface WebSocketNotification {
  type: 'sla_alert' | 'sla_escalation' | 'ticket_update' | 'system_notification';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  data?: any;
  timestamp: Date;
  userId?: string;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private notifications: WebSocketNotification[] = [];
  private listeners: ((notification: WebSocketNotification) => void)[] = [];

  /**
   * Повеже се са WebSocket сервером
   */
  connect(userId: string, token: string): void {
    if (this.socket?.connected) {
      console.log('WebSocket је већ повезан');
      return;
    }

    this.socket = io('http://localhost:5000', {
      auth: {
        token: token
      },
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket повезан са сервером');
      this.isConnected = true;
      
      // Аутентификуј корисника
      this.socket?.emit('authenticate', { userId, token });
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ WebSocket аутентификација успешна:', data.message);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ WebSocket веза прекинута');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket грешка при повезивању:', error);
      this.isConnected = false;
    });

    // Слушај нотификације
    this.socket.on('notification', (notification: WebSocketNotification) => {
      console.log('📤 Нова WebSocket нотификација:', notification);
      this.handleNotification(notification);
    });
  }

  /**
   * Прекида WebSocket везу
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 WebSocket веза затворена');
    }
  }

  /**
   * Обрађује приспелу нотификацију
   */
  private handleNotification(notification: WebSocketNotification): void {
    // Додај нотификацију у листу
    this.notifications.unshift(notification);
    
    // Ограничи број нотификација на 50
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }

    // Обавести све listener-е
    this.listeners.forEach(listener => listener(notification));

    // Прикажи browser нотификацију за SLA алерте
    if (notification.type === 'sla_alert' || notification.type === 'sla_escalation') {
      this.showBrowserNotification(notification);
    }
  }

  /**
   * Прикажи browser нотификацију
   */
  private showBrowserNotification(notification: WebSocketNotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.type
      });

      // Затвори нотификацију после 5 секунди
      setTimeout(() => browserNotification.close(), 5000);
    }
  }

  /**
   * Пријави listener за нотификације
   */
  addNotificationListener(listener: (notification: WebSocketNotification) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Уклони listener за нотификације
   */
  removeNotificationListener(listener: (notification: WebSocketNotification) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Добиј све нотификације
   */
  getNotifications(): WebSocketNotification[] {
    return [...this.notifications];
  }

  /**
   * Обриши све нотификације
   */
  clearNotifications(): void {
    this.notifications = [];
  }

  /**
   * Провери да ли је повезан
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Затражи дозволу за browser нотификације
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('Browser нотификације:', permission);
      return permission;
    }
    return 'denied';
  }

  /**
   * Пошаљи тест нотификацију (за дебаговање)
   */
  sendTestNotification(message: string = 'Тест нотификација'): void {
    if (this.socket?.connected) {
      this.socket.emit('test_notification', { message });
    }
  }
}

// Singleton инстанца
export const websocketService = new WebSocketService(); 