import { logger } from '../utils/logger.js';
import { messages } from '../config/config.js';
import { prisma } from '../database/prisma.js';
import { TicketWorkflow, TicketStatus, TicketPriority } from '../utils/ticketWorkflow.js';
import SlaService from './SlaService.js';
import EmailService from './EmailService.js';

// Ticket interfaces
export interface CreateTicketRequest {
  title: string;
  description: string;
  categoryId?: string;
  priority?: TicketPriority;
  requesterId: string;
  assignedTo?: string;
  tags?: string[];
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  categoryId?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignedTo?: string;
  resolutionNotes?: string;
  tags?: string[];
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  categoryId?: string;
  assignedTo?: string;
  requesterId?: string;
  search?: string;
}

// Serbian status labels
export const statusLabels = {
  open: 'Отворен',
  in_progress: 'У раду',
  pending: 'На чекању',
  resolved: 'Решен',
  closed: 'Затворен',
  cancelled: 'Отказан'
};

// Serbian priority labels  
export const priorityLabels = {
  low: 'Низак',
  medium: 'Средњи',
  high: 'Висок',
  critical: 'Критичан'
};

export class TicketService {
  // Generate unique ticket number
  private async generateTicketNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Find the last ticket created today
    const lastTicket = await prisma.ticket.findFirst({
      where: {
        ticketNumber: {
          startsWith: dateStr
        }
      },
      orderBy: {
        ticketNumber: 'desc'
      }
    });

    let nextNumber = 1;
    if (lastTicket?.ticketNumber) {
      const parts = lastTicket.ticketNumber.split('-');
      if (parts.length > 1) {
        const lastNumber = parseInt(parts[1]);
        nextNumber = lastNumber + 1;
      }
    }

    return `${dateStr}-${nextNumber.toString().padStart(4, '0')}`;
  }

  // Calculate SLA due date based on category
  private async calculateSlaDueDate(categoryId?: string, priority: string = 'medium'): Promise<Date | null> {
    if (!categoryId) return null;

    try {
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });

      if (!category) return null;

      const hours = priority === 'critical' ? Math.floor(category.slaResponseHours / 2) : category.slaResponseHours;
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + hours);

      return dueDate;
    } catch (error) {
      logger.error('Грешка при рачунању SLA датума:', error);
      return null;
    }
  }

  // Create new ticket with SLA calculation
  async createTicket(data: CreateTicketRequest): Promise<any> {
    try {
      const ticketNumber = await this.generateTicketNumber();

      // Create ticket first
      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          title: data.title,
          description: data.description,
          categoryId: data.categoryId,
          priority: data.priority || 'medium',
          status: 'new',
          requesterId: data.requesterId,
          assignedTo: data.assignedTo,
          tags: data.tags ? JSON.stringify(data.tags) : undefined,
        },
        include: {
          category: true,
          requester: {
            select: {
              id: true,
              displayName: true,
              email: true,
              department: true
            }
          },
          assignee: {
            select: {
              id: true,
              displayName: true,
              email: true,
              department: true
            }
          },
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          attachments: true
        }
      });

      // Calculate and update SLA metrics
      try {
        const slaResult = await SlaService.calculateSlaForTicket(
          ticket.id,
          ticket.categoryId,
          ticket.priority,
          ticket.createdAt
        );

        // Update ticket with SLA information
        const updatedTicket = await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            slaResponseDue: slaResult.responseDueDate,
            slaResolutionDue: slaResult.resolutionDueDate,
            slaStatus: slaResult.slaStatus
          },
          include: {
            category: true,
            requester: {
              select: {
                id: true,
                displayName: true,
                email: true,
                department: true
              }
            },
            assignee: {
              select: {
                id: true,
                displayName: true,
                email: true,
                department: true
              }
            },
            comments: {
              include: {
                author: {
                  select: {
                    id: true,
                    displayName: true
                  }
                }
              },
              orderBy: {
                createdAt: 'desc'
              }
            },
            attachments: true
          }
        });

        logger.info(`🎫 Нови тикет креиран са SLA: ${updatedTicket.ticketNumber} - ${updatedTicket.title}`);
        logger.info(`⏰ SLA одзив до: ${slaResult.responseDueDate.toISOString()}`);
        logger.info(`⏰ SLA решење до: ${slaResult.resolutionDueDate.toISOString()}`);
        
        // Пошаљи email нотификацију о новом тикету
        this.sendNewTicketEmailNotification(updatedTicket);
        
        return updatedTicket;
      } catch (slaError) {
        logger.warn(`SLA рачунање неуспешно за тикет ${ticket.ticketNumber}:`, slaError);
        return ticket; // Return ticket without SLA info if calculation fails
      }
    } catch (error) {
      logger.error('Грешка при креирању тикета:', error);
      throw new Error('Грешка при креирању тикета');
    }
  }

  // Get ticket by ID
  async getTicketById(id: string, userId?: string): Promise<any> {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: {
          category: true,
          requester: {
            select: {
              id: true,
              displayName: true,
              email: true,
              department: true
            }
          },
          assignee: {
            select: {
              id: true,
              displayName: true,
              email: true,
              department: true
            }
          },
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          attachments: true
        }
      });

      if (!ticket) {
        throw new Error('Тикет није пронађен');
      }

      // Parse tags from JSON string
      if (ticket.tags) {
        try {
          ticket.tags = JSON.parse(ticket.tags);
        } catch {
          ticket.tags = [];
        }
      }

      return ticket;
    } catch (error) {
      logger.error('Грешка при учитавању тикета:', error);
      throw error;
    }
  }

  // Get all tickets with filtering and pagination
  async getTickets(filters: TicketFilters = {}, page: number = 1, limit: number = 20): Promise<any> {
    try {
      const where: any = {};

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.priority) {
        where.priority = filters.priority;
      }

      if (filters.categoryId) {
        where.categoryId = filters.categoryId;
      }

      if (filters.assignedTo) {
        where.assignedTo = filters.assignedTo;
      }

      if (filters.requesterId) {
        where.requesterId = filters.requesterId;
      }

      if (filters.search) {
        where.OR = [
          {
            title: {
              contains: filters.search
            }
          },
          {
            description: {
              contains: filters.search
            }
          },
          {
            ticketNumber: {
              contains: filters.search
            }
          }
        ];
      }

      const skip = (page - 1) * limit;

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          include: {
            category: true,
            requester: {
              select: {
                id: true,
                displayName: true,
                email: true,
                department: true
              }
            },
            assignee: {
              select: {
                id: true,
                displayName: true,
                email: true,
                department: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        prisma.ticket.count({ where })
      ]);

      // Parse tags for each ticket
      const ticketsWithTags = tickets.map(ticket => ({
        ...ticket,
        tags: ticket.tags ? (
          (() => {
            try {
              return JSON.parse(ticket.tags);
            } catch {
              return [];
            }
          })()
        ) : []
      }));

      return {
        tickets: ticketsWithTags,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Грешка при учитавању тикета:', error);
      throw new Error('Грешка при учитавању тикета');
    }
  }

  // Update ticket
  async updateTicket(id: string, data: UpdateTicketRequest, userId: string): Promise<any> {
    try {
      const existingTicket = await prisma.ticket.findUnique({
        where: { id }
      });

      if (!existingTicket) {
        throw new Error('Тикет није пронађен');
      }

      const updateData: any = {};
      let shouldRecalculateSla = false;

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.categoryId !== undefined) {
        updateData.categoryId = data.categoryId;
        shouldRecalculateSla = true; // Category change affects SLA
      }
      if (data.priority !== undefined) {
        updateData.priority = data.priority;
        shouldRecalculateSla = true; // Priority change affects SLA
      }
      
      // Validate status transition if status is being changed
      if (data.status !== undefined && data.status !== existingTicket.status) {
        const validation = TicketWorkflow.validateStatusTransition(
          existingTicket.status as TicketStatus, 
          data.status
        );
        
        if (!validation.valid) {
          throw new Error(validation.error || 'Неважећа промена статуса');
        }
        
        updateData.status = data.status;
        
        // Set resolved/closed timestamps
        if (data.status === 'resolved' && existingTicket.status !== 'resolved') {
          updateData.resolvedAt = new Date();
          updateData.resolvedBy = userId;
          updateData.firstResponseAt = updateData.firstResponseAt || new Date();
        }
        if (data.status === 'closed' && existingTicket.status !== 'closed') {
          updateData.closedAt = new Date();
        }
        if (data.status === 'in_progress' && existingTicket.firstResponseAt === null) {
          updateData.firstResponseAt = new Date();
        }
      }
      
      if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
      if (data.resolutionNotes !== undefined) updateData.resolutionNotes = data.resolutionNotes;
      if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);

      const ticket = await prisma.ticket.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          requester: {
            select: {
              id: true,
              displayName: true,
              email: true,
              department: true
            }
          },
          assignee: {
            select: {
              id: true,
              displayName: true,
              email: true,
              department: true
            }
          },
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          attachments: true
        }
      });

      // Recalculate SLA if needed (category or priority changed)
      if (shouldRecalculateSla && ticket.status !== 'closed' && ticket.status !== 'resolved') {
        try {
          await SlaService.updateTicketSlaMetrics(ticket.id);
          logger.info(`🔄 SLA метрике пересчитане за тикет: ${ticket.ticketNumber}`);
        } catch (slaError) {
          logger.warn(`SLA пресчитавање неуспешно за тикет ${ticket.ticketNumber}:`, slaError);
        }
      }

      logger.info(`🔄 Тикет ажуриран: ${ticket.ticketNumber} - ${ticket.title}`);
      
      // Пошаљи email нотификације на основу типа ажурирања
      if (data.status !== undefined && data.status !== existingTicket.status) {
        // Статус је промењен
        if (data.status === 'resolved') {
          this.sendTicketUpdateEmailNotification(ticket, 'resolution', data.resolutionNotes);
        } else {
          this.sendTicketUpdateEmailNotification(ticket, 'status');
        }
      } else if (data.assignedTo !== undefined && data.assignedTo !== existingTicket.assignedTo) {
        // Додељен је нови агент
        this.sendTicketUpdateEmailNotification(ticket, 'assignment');
      }
      
      return ticket;
    } catch (error) {
      logger.error('Грешка при ажурирању тикета:', error);
      throw error;
    }
  }

  // Assign ticket to user
  async assignTicket(ticketId: string, assigneeId: string, assignedBy: string): Promise<any> {
    try {
      const ticket = await this.updateTicket(ticketId, {
        assignedTo: assigneeId,
        status: 'assigned'
      }, assignedBy);

      logger.info(`👤 Тикет ${ticket.ticketNumber} додељен кориснику ${assigneeId}`);
      return ticket;
    } catch (error) {
      logger.error('Грешка при додели тикета:', error);
      throw error;
    }
  }

  // Delete ticket (soft delete by setting status to cancelled)
  async deleteTicket(id: string, userId: string): Promise<void> {
    try {
      await this.updateTicket(id, { status: 'cancelled' }, userId);
      logger.info(`🗑️ Тикет обрисан: ${id}`);
    } catch (error) {
      logger.error('Грешка при брисању тикета:', error);
      throw error;
    }
  }

  // Get categories for dropdown
  async getCategories(): Promise<any[]> {
    try {
      return await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' }
      });
    } catch (error) {
      logger.error('Грешка при учитавању категорија:', error);
      throw new Error('Грешка при учитавању категорија');
    }
  }

  // Send email notification for new ticket
  private async sendNewTicketEmailNotification(ticket: any): Promise<void> {
    try {
      if (!EmailService.isAvailable()) {
        logger.warn('Email сервис није доступан - нотификација неће бити послата');
        return;
      }

      const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}`;

      const emailData = {
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        category: ticket.category?.name,
        requesterName: ticket.requester?.displayName || 'Непознат корисник',
        requesterEmail: ticket.requester?.email,
        assigneeName: ticket.assignee?.displayName,
        assigneeEmail: ticket.assignee?.email,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        ticketUrl
      };

      await EmailService.sendNewTicketNotification(emailData);
      logger.info(`📧 Email нотификација послата за нови тикет: ${ticket.ticketNumber}`);
    } catch (error) {
      logger.error(`❌ Грешка при слању email нотификације за тикет ${ticket.ticketNumber}:`, error);
    }
  }

  // Send email notification for ticket updates
  private async sendTicketUpdateEmailNotification(
    ticket: any, 
    updateType: 'status' | 'assignment' | 'comment' | 'resolution',
    resolutionNotes?: string
  ): Promise<void> {
    try {
      if (!EmailService.isAvailable()) {
        logger.warn('Email сервис није доступан - нотификација неће бити послата');
        return;
      }

      const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}`;

      const emailData = {
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        category: ticket.category?.name,
        requesterName: ticket.requester?.displayName || 'Непознат корисник',
        requesterEmail: ticket.requester?.email,
        assigneeName: ticket.assignee?.displayName,
        assigneeEmail: ticket.assignee?.email,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolutionNotes: resolutionNotes || ticket.resolutionNotes,
        ticketUrl
      };

      await EmailService.sendTicketUpdateNotification(emailData, updateType);
      logger.info(`📧 Email нотификација послата за ажурирање тикета: ${ticket.ticketNumber} (${updateType})`);
    } catch (error) {
      logger.error(`❌ Грешка при слању email нотификације за ажурирање тикета ${ticket.ticketNumber}:`, error);
    }
  }
} 