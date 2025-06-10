import prisma from '../../config/database';
import { oauthService } from './oauthService';
import { fieldMappingService } from './fieldMappingService';
import { TicketService } from '../ticketService';
import { logger } from '../../utils/logger';
import { differenceInMinutes } from 'date-fns';

const ticketService = new TicketService();

// Типови за синхронизацију
export interface SyncOperation {
  id?: string;
  connectionId: string;
  ticketId?: string;
  vendorTicketId?: string;
  operationType: 'create' | 'update' | 'delete' | 'comment_add';
  direction: 'inbound' | 'outbound';
  payload: any;
  priority?: number;
}

export interface SyncResult {
  success: boolean;
  ticketId?: string;
  vendorTicketId?: string;
  error?: string;
  conflictResolution?: string;
}

export interface ConflictInfo {
  field: string;
  internalValue: any;
  vendorValue: any;
  lastModifiedInternal?: Date;
  lastModifiedVendor?: Date;
}

// Стратегије решавања конфликата
export enum ConflictResolutionStrategy {
  VENDOR_WINS = 'vendor_wins',
  INTERNAL_WINS = 'internal_wins',
  NEWEST_WINS = 'newest_wins',
  MANUAL = 'manual',
  MERGE = 'merge'
}

/**
 * Главни сервис за синхронизацију са vendor системима
 */
export class VendorSyncService {
  private readonly BATCH_SIZE = 50;
  private readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Процесира queue за синхронизацију
   */
  async processSyncQueue(connectionId?: string): Promise<void> {
    try {
      const whereClause = {
        status: 'pending',
        ...(connectionId ? { connectionId } : {}),
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } }
        ]
      };

      const queueItems = await prisma.vendorSyncQueue.findMany({
        where: whereClause,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ],
        take: this.BATCH_SIZE,
        include: {
          connection: {
            include: { vendorSystem: true }
          }
        }
      });

      logger.info(`Процесирање ${queueItems.length} ставки из sync queue`);

      for (const item of queueItems) {
        await this.processSyncItem(item);
      }

    } catch (error) {
      logger.error('Грешка при процесирању sync queue:', error);
    }
  }

  /**
   * Процесира појединачну ставку синхронизације
   */
  private async processSyncItem(item: any): Promise<void> {
    try {
      // Ажурирај статус на processing
      await prisma.vendorSyncQueue.update({
        where: { id: item.id },
        data: { status: 'processing' }
      });

      let result: SyncResult;

      switch (item.operationType) {
        case 'create':
          result = await this.syncTicketCreate(item);
          break;
        case 'update':
          result = await this.syncTicketUpdate(item);
          break;
        case 'delete':
          result = await this.syncTicketDelete(item);
          break;
        case 'comment_add':
          result = await this.syncCommentAdd(item);
          break;
        default:
          throw new Error(`Непозната операција: ${item.operationType}`);
      }

      if (result.success) {
        // Успешна синхронизација
        await prisma.vendorSyncQueue.update({
          where: { id: item.id },
          data: {
            status: 'completed',
            processedAt: new Date()
          }
        });

        // Ажурирај sync history
        await this.logSyncHistory(item.connectionId, 'single_ticket', item.direction, true);
      } else {
        // Неуспешна синхронизација
        await this.handleSyncError(item, result.error || 'Непозната грешка');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Непозната грешка';
      await this.handleSyncError(item, errorMessage);
    }
  }

  /**
   * Синхронизује креирање тикета
   */
  private async syncTicketCreate(item: any): Promise<SyncResult> {
    try {
      const { connection } = item;
      const payload = JSON.parse(item.payload);

      if (item.direction === 'outbound') {
        // Креирај тикет у vendor систему
        const vendorData = await fieldMappingService.mapToVendor(
          payload,
          connection.vendorSystemId,
          'ticket'
        );

        const vendorTicket = await this.createVendorTicket(
          connection,
          vendorData
        );

        // Креирај мапирање
        await prisma.vendorTicketMapping.create({
          data: {
            connectionId: connection.id,
            internalTicketId: item.ticketId!,
            vendorTicketId: vendorTicket.id,
            vendorTicketKey: vendorTicket.key,
            lastSyncAt: new Date(),
            lastSyncDirection: 'outbound',
            syncStatus: 'active'
          }
        });

        return {
          success: true,
          ticketId: item.ticketId,
          vendorTicketId: vendorTicket.id
        };

      } else {
        // Креирај тикет у интерном систему
        const internalData = await fieldMappingService.mapFromVendor(
          payload,
          connection.vendorSystemId,
          'ticket'
        );

        const ticket = await ticketService.createTicket(internalData);

        // Креирај мапирање
        await prisma.vendorTicketMapping.create({
          data: {
            connectionId: connection.id,
            internalTicketId: ticket.id,
            vendorTicketId: item.vendorTicketId!,
            vendorTicketKey: payload.key,
            lastSyncAt: new Date(),
            lastSyncDirection: 'inbound',
            syncStatus: 'active'
          }
        });

        return {
          success: true,
          ticketId: ticket.id,
          vendorTicketId: item.vendorTicketId
        };
      }

    } catch (error) {
      logger.error('Грешка при синхронизацији креирања тикета:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Непозната грешка'
      };
    }
  }

  /**
   * Синхронизује ажурирање тикета
   */
  private async syncTicketUpdate(item: any): Promise<SyncResult> {
    try {
      const { connection } = item;
      const payload = JSON.parse(item.payload);

      // Пронађи мапирање
      const mapping = await prisma.vendorTicketMapping.findFirst({
        where: {
          connectionId: connection.id,
          ...(item.direction === 'outbound' ? 
            { internalTicketId: item.ticketId } : 
            { vendorTicketId: item.vendorTicketId })
        }
      });

      if (!mapping) {
        throw new Error('Мапирање тикета није пронађено');
      }

      // Провери конфликте
      const conflicts = await this.detectConflicts(mapping, payload, item.direction);
      
      if (conflicts.length > 0) {
        const resolution = await this.resolveConflicts(
          conflicts,
          connection.vendorSystem.vendorType
        );
        
        if (!resolution.proceed) {
          return {
            success: false,
            error: 'Конфликт података - потребна мануелна интервенција',
            conflictResolution: resolution.strategy
          };
        }

        // Примени резолуцију конфликта
        Object.assign(payload, resolution.mergedData);
      }

      if (item.direction === 'outbound') {
        // Ажурирај тикет у vendor систему
        const vendorData = await fieldMappingService.mapToVendor(
          payload,
          connection.vendorSystemId,
          'ticket'
        );

        await this.updateVendorTicket(
          connection,
          mapping.vendorTicketId,
          vendorData
        );
      } else {
        // Ажурирај тикет у интерном систему
        const internalData = await fieldMappingService.mapFromVendor(
          payload,
          connection.vendorSystemId,
          'ticket'
        );

        await ticketService.updateTicket(
          mapping.internalTicketId,
          internalData
        );
      }

      // Ажурирај мапирање
      await prisma.vendorTicketMapping.update({
        where: { id: mapping.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncDirection: item.direction,
          vendorData: JSON.stringify(payload)
        }
      });

      return {
        success: true,
        ticketId: mapping.internalTicketId,
        vendorTicketId: mapping.vendorTicketId
      };

    } catch (error) {
      logger.error('Грешка при синхронизацији ажурирања тикета:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Непозната грешка'
      };
    }
  }

  /**
   * Синхронизује брисање тикета
   */
  private async syncTicketDelete(item: any): Promise<SyncResult> {
    try {
      const { connection } = item;

      // Пронађи мапирање
      const mapping = await prisma.vendorTicketMapping.findFirst({
        where: {
          connectionId: connection.id,
          ...(item.direction === 'outbound' ? 
            { internalTicketId: item.ticketId } : 
            { vendorTicketId: item.vendorTicketId })
        }
      });

      if (!mapping) {
        return { success: true }; // Већ обрисано
      }

      if (item.direction === 'outbound') {
        // Обриши тикет у vendor систему
        await this.deleteVendorTicket(connection, mapping.vendorTicketId);
      } else {
        // У интерном систему не бришемо, само означавамо као cancelled
        await ticketService.updateTicket(mapping.internalTicketId, {
          status: 'cancelled',
          resolutionNotes: 'Тикет је обрисан у vendor систему'
        });
      }

      // Ажурирај мапирање
      await prisma.vendorTicketMapping.update({
        where: { id: mapping.id },
        data: {
          syncStatus: 'suspended',
          lastSyncAt: new Date()
        }
      });

      return {
        success: true,
        ticketId: mapping.internalTicketId,
        vendorTicketId: mapping.vendorTicketId
      };

    } catch (error) {
      logger.error('Грешка при синхронизацији брисања тикета:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Непозната грешка'
      };
    }
  }

  /**
   * Синхронизује додавање коментара
   */
  private async syncCommentAdd(item: any): Promise<SyncResult> {
    try {
      const { connection } = item;
      const payload = JSON.parse(item.payload);

      // Пронађи мапирање
      const mapping = await prisma.vendorTicketMapping.findFirst({
        where: {
          connectionId: connection.id,
          ...(item.direction === 'outbound' ? 
            { internalTicketId: item.ticketId } : 
            { vendorTicketId: item.vendorTicketId })
        }
      });

      if (!mapping) {
        throw new Error('Мапирање тикета није пронађено');
      }

      if (item.direction === 'outbound') {
        // Додај коментар у vendor систему
        const vendorComment = await fieldMappingService.mapToVendor(
          payload,
          connection.vendorSystemId,
          'comment'
        );

        await this.addVendorComment(
          connection,
          mapping.vendorTicketId,
          vendorComment
        );
      } else {
        // Додај коментар у интерном систему
        const internalComment = await fieldMappingService.mapFromVendor(
          payload,
          connection.vendorSystemId,
          'comment'
        );

        await prisma.ticketComment.create({
          data: {
            ticketId: mapping.internalTicketId,
            authorId: internalComment.authorId || 'system',
            content: internalComment.content,
            isPublic: internalComment.isPublic ?? true
          }
        });
      }

      return {
        success: true,
        ticketId: mapping.internalTicketId,
        vendorTicketId: mapping.vendorTicketId
      };

    } catch (error) {
      logger.error('Грешка при синхронизацији коментара:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Непозната грешка'
      };
    }
  }

  /**
   * Детектује конфликте између локалних и vendor података
   */
  private async detectConflicts(
    mapping: any,
    incomingData: any,
    direction: 'inbound' | 'outbound'
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    try {
      // Преузми тренутне податке са обе стране
      const [internalTicket, vendorData] = await Promise.all([
        prisma.ticket.findUnique({
          where: { id: mapping.internalTicketId },
          include: { category: true }
        }),
        mapping.vendorData ? JSON.parse(mapping.vendorData) : null
      ]);

      if (!internalTicket || !vendorData) {
        return conflicts;
      }

      // Поља за проверу конфликата
      const fieldsToCheck = ['title', 'description', 'status', 'priority'];

      for (const field of fieldsToCheck) {
        const internalValue = (internalTicket as any)[field];
        const vendorValue = vendorData[field];
        const incomingValue = incomingData[field];

        // Провери да ли се вредности разликују
        if (internalValue !== vendorValue && incomingValue !== undefined) {
          conflicts.push({
            field,
            internalValue,
            vendorValue: incomingValue,
            lastModifiedInternal: internalTicket.updatedAt,
            lastModifiedVendor: new Date() // Vendor време ажурирања
          });
        }
      }

      return conflicts;
    } catch (error) {
      logger.error('Грешка при детекцији конфликата:', error);
      return conflicts;
    }
  }

  /**
   * Решава конфликте према стратегији
   */
  private async resolveConflicts(
    conflicts: ConflictInfo[],
    vendorType: string
  ): Promise<{ proceed: boolean; strategy: string; mergedData?: any }> {
    if (conflicts.length === 0) {
      return { proceed: true, strategy: 'no_conflicts' };
    }

    // Преузми стратегију за vendor
    const strategy = await this.getConflictStrategy(vendorType);

    switch (strategy) {
      case ConflictResolutionStrategy.VENDOR_WINS:
        return {
          proceed: true,
          strategy: 'vendor_wins',
          mergedData: conflicts.reduce((acc, conflict) => {
            acc[conflict.field] = conflict.vendorValue;
            return acc;
          }, {})
        };

      case ConflictResolutionStrategy.INTERNAL_WINS:
        return {
          proceed: true,
          strategy: 'internal_wins',
          mergedData: conflicts.reduce((acc, conflict) => {
            acc[conflict.field] = conflict.internalValue;
            return acc;
          }, {})
        };

      case ConflictResolutionStrategy.NEWEST_WINS:
        const mergedData: any = {};
        
        for (const conflict of conflicts) {
          if (!conflict.lastModifiedInternal || !conflict.lastModifiedVendor) {
            mergedData[conflict.field] = conflict.vendorValue;
            continue;
          }

          const internalMinutes = differenceInMinutes(
            new Date(),
            conflict.lastModifiedInternal
          );
          const vendorMinutes = differenceInMinutes(
            new Date(),
            conflict.lastModifiedVendor
          );

          mergedData[conflict.field] = internalMinutes < vendorMinutes ?
            conflict.internalValue : conflict.vendorValue;
        }

        return {
          proceed: true,
          strategy: 'newest_wins',
          mergedData
        };

      case ConflictResolutionStrategy.MANUAL:
        // Логуј конфликт за мануелну резолуцију
        await this.logConflictForManualResolution(conflicts);
        return {
          proceed: false,
          strategy: 'manual_required'
        };

      default:
        return {
          proceed: false,
          strategy: 'unknown_strategy'
        };
    }
  }

  /**
   * Добија стратегију за решавање конфликата
   */
  private async getConflictStrategy(vendorType: string): Promise<ConflictResolutionStrategy> {
    // TODO: Учитати из конфигурације
    const strategies: Record<string, ConflictResolutionStrategy> = {
      jira: ConflictResolutionStrategy.NEWEST_WINS,
      servicenow: ConflictResolutionStrategy.VENDOR_WINS,
      zendesk: ConflictResolutionStrategy.INTERNAL_WINS,
      freshdesk: ConflictResolutionStrategy.MANUAL
    };

    return strategies[vendorType.toLowerCase()] || ConflictResolutionStrategy.MANUAL;
  }

  /**
   * Логује конфликт за мануелну резолуцију
   */
  private async logConflictForManualResolution(conflicts: ConflictInfo[]): Promise<void> {
    // TODO: Имплементирати логовање конфликата
    logger.warn('Детектовани конфликти који захтевају мануелну резолуцију:', conflicts);
  }

  /**
   * Рукује грешкама синхронизације
   */
  private async handleSyncError(item: any, error: string): Promise<void> {
    const retryCount = item.retryCount + 1;

    if (retryCount >= this.MAX_RETRY_ATTEMPTS) {
      // Максималан број покушаја достигнут
      await prisma.vendorSyncQueue.update({
        where: { id: item.id },
        data: {
          status: 'failed',
          errorMessage: error,
          processedAt: new Date()
        }
      });

      // Логуј грешку
      await prisma.vendorSyncError.create({
        data: {
          connectionId: item.connectionId,
          ticketId: item.ticketId,
          vendorTicketId: item.vendorTicketId,
          errorType: 'sync_failed',
          errorMessage: error,
          errorDetails: JSON.stringify(item)
        }
      });

      // Ажурирај статус конекције ако је потребно
      await this.updateConnectionHealth(item.connectionId, false);
    } else {
      // Заказуј retry са exponential backoff
      const nextRetryAt = new Date();
      nextRetryAt.setMinutes(nextRetryAt.getMinutes() + Math.pow(2, retryCount));

      await prisma.vendorSyncQueue.update({
        where: { id: item.id },
        data: {
          status: 'pending',
          retryCount,
          nextRetryAt,
          errorMessage: error
        }
      });
    }
  }

  /**
   * Креира тикет у vendor систему
   */
  private async createVendorTicket(connection: any, data: any): Promise<any> {
    const vendorType = connection.vendorSystem.vendorType.toLowerCase();
    
    switch (vendorType) {
      case 'jira':
        const { jiraAdapter } = await import('./adapters/jiraAdapter');
        return await jiraAdapter.createTicket(connection, data);
      
      case 'servicenow':
        // TODO: Имплементирати ServiceNow адаптер
        logger.info(`Креирање тикета у ServiceNow:`, data);
        return {
          id: `SN-${Date.now()}`,
          key: `INC${Date.now()}`
        };
      
      case 'zendesk':
        // TODO: Имплементирати Zendesk адаптер
        logger.info(`Креирање тикета у Zendesk:`, data);
        return {
          id: `${Date.now()}`,
          key: `ZD-${Date.now()}`
        };
      
      case 'freshdesk':
        // TODO: Имплементирати Freshdesk адаптер
        logger.info(`Креирање тикета у Freshdesk:`, data);
        return {
          id: `${Date.now()}`,
          key: `FD-${Date.now()}`
        };
      
      default:
        throw new Error(`Непознат vendor тип: ${vendorType}`);
    }
  }

  /**
   * Ажурира тикет у vendor систему
   */
  private async updateVendorTicket(connection: any, vendorTicketId: string, data: any): Promise<void> {
    const vendorType = connection.vendorSystem.vendorType.toLowerCase();
    
    switch (vendorType) {
      case 'jira':
        const { jiraAdapter } = await import('./adapters/jiraAdapter');
        await jiraAdapter.updateTicket(connection, vendorTicketId, data);
        break;
      
      case 'servicenow':
        // TODO: Имплементирати ServiceNow адаптер
        logger.info(`Ажурирање тикета ${vendorTicketId} у ServiceNow:`, data);
        break;
      
      case 'zendesk':
        // TODO: Имплементирати Zendesk адаптер
        logger.info(`Ажурирање тикета ${vendorTicketId} у Zendesk:`, data);
        break;
      
      case 'freshdesk':
        // TODO: Имплементирати Freshdesk адаптер
        logger.info(`Ажурирање тикета ${vendorTicketId} у Freshdesk:`, data);
        break;
      
      default:
        throw new Error(`Непознат vendor тип: ${vendorType}`);
    }
  }

  /**
   * Брише тикет у vendor систему
   */
  private async deleteVendorTicket(connection: any, vendorTicketId: string): Promise<void> {
    const vendorType = connection.vendorSystem.vendorType.toLowerCase();
    
    switch (vendorType) {
      case 'jira':
        // JIRA doesn't support hard delete via API, only archive
        logger.warn(`JIRA не подржава брисање тикета - тикет ${vendorTicketId} ће бити архивиран`);
        break;
      
      case 'servicenow':
        // TODO: Имплементирати ServiceNow адаптер
        logger.info(`Брисање тикета ${vendorTicketId} у ServiceNow`);
        break;
      
      case 'zendesk':
        // TODO: Имплементирати Zendesk адаптер
        logger.info(`Брисање тикета ${vendorTicketId} у Zendesk`);
        break;
      
      case 'freshdesk':
        // TODO: Имплементирати Freshdesk адаптер
        logger.info(`Брисање тикета ${vendorTicketId} у Freshdesk`);
        break;
      
      default:
        throw new Error(`Непознат vendor тип: ${vendorType}`);
    }
  }

  /**
   * Додаје коментар у vendor систему
   */
  private async addVendorComment(connection: any, vendorTicketId: string, comment: any): Promise<void> {
    const vendorType = connection.vendorSystem.vendorType.toLowerCase();
    
    switch (vendorType) {
      case 'jira':
        const { jiraAdapter } = await import('./adapters/jiraAdapter');
        await jiraAdapter.addComment(connection, vendorTicketId, comment.content || comment.text);
        break;
      
      case 'servicenow':
        // TODO: Имплементирати ServiceNow адаптер
        logger.info(`Додавање коментара на тикет ${vendorTicketId} у ServiceNow:`, comment);
        break;
      
      case 'zendesk':
        // TODO: Имплементирати Zendesk адаптер
        logger.info(`Додавање коментара на тикет ${vendorTicketId} у Zendesk:`, comment);
        break;
      
      case 'freshdesk':
        // TODO: Имплементирати Freshdesk адаптер
        logger.info(`Додавање коментара на тикет ${vendorTicketId} у Freshdesk:`, comment);
        break;
      
      default:
        throw new Error(`Непознат vendor тип: ${vendorType}`);
    }
  }

  /**
   * Ажурира health статус конекције
   */
  private async updateConnectionHealth(connectionId: string, isHealthy: boolean): Promise<void> {
    await prisma.vendorConnection.update({
      where: { id: connectionId },
      data: {
        connectionStatus: isHealthy ? 'active' : 'failed',
        lastConnectedAt: isHealthy ? new Date() : undefined
      }
    });
  }

  /**
   * Логује историју синхронизације
   */
  private async logSyncHistory(
    connectionId: string,
    syncType: string,
    direction: string,
    success: boolean
  ): Promise<void> {
    // Пронађи или креирај тренутни sync history запис
    const existing = await prisma.vendorSyncHistory.findFirst({
      where: {
        connectionId,
        status: 'running',
        syncType,
        syncDirection: direction
      },
      orderBy: { startedAt: 'desc' }
    });

    if (existing) {
      // Ажурирај постојећи
      await prisma.vendorSyncHistory.update({
        where: { id: existing.id },
        data: {
          totalRecords: existing.totalRecords + 1,
          successfulRecords: existing.successfulRecords + (success ? 1 : 0),
          failedRecords: existing.failedRecords + (success ? 0 : 1)
        }
      });
    } else {
      // Креирај нови
      await prisma.vendorSyncHistory.create({
        data: {
          connectionId,
          syncType,
          syncDirection: direction,
          startedAt: new Date(),
          status: 'running',
          totalRecords: 1,
          successfulRecords: success ? 1 : 0,
          failedRecords: success ? 0 : 1
        }
      });
    }
  }

  /**
   * Додаје операцију у sync queue
   */
  async queueSyncOperation(operation: SyncOperation): Promise<void> {
    await prisma.vendorSyncQueue.create({
      data: {
        connectionId: operation.connectionId,
        ticketId: operation.ticketId,
        vendorTicketId: operation.vendorTicketId,
        operationType: operation.operationType,
        direction: operation.direction,
        priority: operation.priority || 5,
        payload: JSON.stringify(operation.payload),
        status: 'pending'
      }
    });
  }

  /**
   * Покреће пуну синхронизацију за конекцију
   */
  async runFullSync(connectionId: string): Promise<void> {
    try {
      const connection = await prisma.vendorConnection.findUnique({
        where: { id: connectionId },
        include: { vendorSystem: true }
      });

      if (!connection) {
        throw new Error('Конекција није пронађена');
      }

      // Креирај sync history запис
      const syncHistory = await prisma.vendorSyncHistory.create({
        data: {
          connectionId,
          syncType: 'full',
          syncDirection: 'bidirectional',
          startedAt: new Date(),
          status: 'running',
          totalRecords: 0,
          successfulRecords: 0,
          failedRecords: 0
        }
      });

      // TODO: Имплементирати логику за пуну синхронизацију
      logger.info(`Покренута пуна синхронизација за конекцију ${connectionId}`);

      // Заврши sync history
      await prisma.vendorSyncHistory.update({
        where: { id: syncHistory.id },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Грешка при пуној синхронизацији:', error);
      throw error;
    }
  }
}

// Експортуј singleton инстанцу
export const vendorSyncService = new VendorSyncService();
export default vendorSyncService; 