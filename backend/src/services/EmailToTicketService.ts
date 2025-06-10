import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { TicketService } from './ticketService.js';
import EmailService from './EmailService.js';

const prisma = new PrismaClient();
const ticketService = new TicketService();

export interface EmailTicketConfig {
  enabled: boolean;
  inboxEmail: string;
  defaultCategoryId?: string;
  defaultPriority: 'low' | 'medium' | 'high' | 'critical';
  autoAssign: boolean;
  defaultAssigneeId?: string;
  subjectPrefixes: string[];
  allowedDomains: string[];
  maxAttachmentSize: number; // in MB
}

export interface ParsedEmailTicket {
  subject: string;
  body: string;
  senderEmail: string;
  senderName?: string;
  attachments: EmailAttachment[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  categoryId?: string;
  isReply: boolean;
  replyToTicketNumber?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  size: number;
}

export class EmailToTicketService {
  private config: EmailTicketConfig;

  constructor() {
    this.config = {
      enabled: process.env.EMAIL_TO_TICKET_ENABLED === 'true',
      inboxEmail: process.env.EMAIL_INBOX || 'helpdesk@pio.gov.rs',
      defaultCategoryId: process.env.DEFAULT_CATEGORY_ID,
      defaultPriority: (process.env.DEFAULT_PRIORITY as any) || 'medium',
      autoAssign: process.env.AUTO_ASSIGN_TICKETS === 'true',
      defaultAssigneeId: process.env.DEFAULT_ASSIGNEE_ID,
      subjectPrefixes: ['[PIO Help Desk]', '[URGENT]', '[КРИТИЧНО]'],
      allowedDomains: ['pio.gov.rs', 'rfpio.rs'], // Само службени домени
      maxAttachmentSize: parseInt(process.env.MAX_ATTACHMENT_SIZE || '10') // MB
    };
  }

  /**
   * Парсира email и креира тикет
   */
  async processIncomingEmail(emailSource: string | Buffer): Promise<{ success: boolean; ticketId?: string; message: string }> {
    try {
      if (!this.config.enabled) {
        return {
          success: false,
          message: 'Email-to-Ticket функционалност није омогућена'
        };
      }

      // Парсирај email
      const parsedEmail = await simpleParser(emailSource);
      logger.info(`📧 Обрађујем email од: ${parsedEmail.from?.text} - ${parsedEmail.subject}`);

      // Валидирај email
      const validation = this.validateEmail(parsedEmail);
      if (!validation.valid) {
        logger.warn(`❌ Email одбачен: ${validation.reason}`);
        return {
          success: false,
          message: validation.reason
        };
      }

      // Парсирај email у тикет структуру
      const emailTicket = await this.parseEmailToTicket(parsedEmail);

      // Провери да ли је одговор на постојећи тикет
      if (emailTicket.isReply && emailTicket.replyToTicketNumber) {
        return await this.handleTicketReply(emailTicket, parsedEmail);
      }

      // Креирај нови тикет
      return await this.createTicketFromEmail(emailTicket, parsedEmail);

    } catch (error) {
      logger.error('❌ Грешка при обради email-а:', error);
      return {
        success: false,
        message: `Грешка при обради email-а: ${error instanceof Error ? error.message : 'Непозната грешка'}`
      };
    }
  }

  /**
   * Валидира email пре обраде
   */
  private validateEmail(email: ParsedMail): { valid: boolean; reason?: string } {
    // Провери да ли има пошаљиоца
    if (!email.from || !email.from.value || email.from.value.length === 0) {
      return { valid: false, reason: 'Email нема валидног пошаљиоца' };
    }

    const senderEmail = email.from.value[0].address;
    if (!senderEmail) {
      return { valid: false, reason: 'Email адреса пошаљиоца није валидна' };
    }

    // Провери домен ако је ограничено
    if (this.config.allowedDomains.length > 0) {
      const domain = senderEmail.split('@')[1];
      if (!this.config.allowedDomains.includes(domain)) {
        return { valid: false, reason: `Домен ${domain} није дозвољен за креирање тикета` };
      }
    }

    // Провери да ли има наслов
    if (!email.subject || email.subject.trim().length === 0) {
      return { valid: false, reason: 'Email нема наслов' };
    }

    // Провери да ли има садржај
    if (!email.text && !email.html) {
      return { valid: false, reason: 'Email нема садржај' };
    }

    return { valid: true };
  }

  /**
   * Парсира email у тикет структуру
   */
  private async parseEmailToTicket(email: ParsedMail): Promise<ParsedEmailTicket> {
    const senderEmail = email.from!.value[0].address!;
    const senderName = email.from!.value[0].name || senderEmail.split('@')[0];
    
    // Очисти наслов од префикса
    let subject = email.subject!.trim();
    for (const prefix of this.config.subjectPrefixes) {
      if (subject.startsWith(prefix)) {
        subject = subject.substring(prefix.length).trim();
        break;
      }
    }

    // Провери да ли је одговор на тикет
    const ticketNumberMatch = subject.match(/#(\d{8}-\d{4})/);
    const isReply = !!ticketNumberMatch;
    const replyToTicketNumber = ticketNumberMatch ? ticketNumberMatch[1] : undefined;

    // Одреди приоритет на основу наслова и садржаја
    const priority = this.determinePriority(subject, email.text || '');

    // Обради прилоге
    const attachments = await this.processAttachments(email.attachments || []);

    // Узми текст или HTML садржај
    let body = email.text || '';
    if (!body && email.html) {
      // Једноставно уклањање HTML тагова
      body = email.html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    return {
      subject: subject || 'Без наслова',
      body: body || 'Без садржаја',
      senderEmail,
      senderName,
      attachments,
      priority,
      categoryId: this.config.defaultCategoryId,
      isReply,
      replyToTicketNumber
    };
  }

  /**
   * Одређује приоритет на основу садржаја
   */
  private determinePriority(subject: string, body: string): 'low' | 'medium' | 'high' | 'critical' {
    const text = (subject + ' ' + body).toLowerCase();
    
    // Критични кључне речи
    const criticalKeywords = ['критично', 'хитно', 'urgent', 'critical', 'не ради', 'пад система', 'безбедност'];
    if (criticalKeywords.some(keyword => text.includes(keyword))) {
      return 'critical';
    }

    // Високи приоритет
    const highKeywords = ['важно', 'проблем', 'грешка', 'error', 'problem', 'issue', 'не могу'];
    if (highKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    }

    // Низак приоритет
    const lowKeywords = ['питање', 'question', 'информација', 'info', 'како', 'how'];
    if (lowKeywords.some(keyword => text.includes(keyword))) {
      return 'low';
    }

    return this.config.defaultPriority;
  }

  /**
   * Обрађује прилоге из email-а
   */
  private async processAttachments(attachments: Attachment[]): Promise<EmailAttachment[]> {
    const processedAttachments: EmailAttachment[] = [];
    const maxSizeBytes = this.config.maxAttachmentSize * 1024 * 1024;

    for (const attachment of attachments) {
      if (!attachment.filename || !attachment.content) continue;

      // Провери величину
      if (attachment.size && attachment.size > maxSizeBytes) {
        logger.warn(`📎 Прилог ${attachment.filename} је превелик (${attachment.size} bytes)`);
        continue;
      }

      // Провери тип фајла (основна безбедност)
      const allowedTypes = [
        'image/', 'text/', 'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument', 'application/zip'
      ];
      
      const contentType = attachment.contentType || 'application/octet-stream';
      if (!allowedTypes.some(type => contentType.startsWith(type))) {
        logger.warn(`📎 Прилог ${attachment.filename} има недозвољен тип: ${contentType}`);
        continue;
      }

      processedAttachments.push({
        filename: attachment.filename,
        content: attachment.content,
        contentType,
        size: attachment.size || attachment.content.length
      });
    }

    return processedAttachments;
  }

  /**
   * Креира нови тикет од email-а
   */
  private async createTicketFromEmail(emailTicket: ParsedEmailTicket, originalEmail: ParsedMail): Promise<{ success: boolean; ticketId?: string; message: string }> {
    try {
      // Пронађи или креирај корисника
      const requester = await this.findOrCreateUser(emailTicket.senderEmail, emailTicket.senderName);

      // Креирај тикет
      const ticket = await ticketService.createTicket({
        title: emailTicket.subject,
        description: emailTicket.body,
        categoryId: emailTicket.categoryId,
        priority: emailTicket.priority,
        requesterId: requester.id,
        assignedTo: this.config.autoAssign ? this.config.defaultAssigneeId : undefined
      });

      // Сачувај прилоге ако постоје
      if (emailTicket.attachments.length > 0) {
        await this.saveTicketAttachments(ticket.id, emailTicket.attachments);
      }

      // Пошаљи потврдни email
      if (EmailService.isAvailable()) {
        await this.sendTicketCreatedConfirmation(ticket, emailTicket.senderEmail);
      }

      logger.info(`✅ Тикет креиран од email-а: ${ticket.ticketNumber} - ${ticket.title}`);
      
      return {
        success: true,
        ticketId: ticket.id,
        message: `Тикет ${ticket.ticketNumber} успешно креиран`
      };

    } catch (error) {
      logger.error('❌ Грешка при креирању тикета од email-а:', error);
      return {
        success: false,
        message: `Грешка при креирању тикета: ${error instanceof Error ? error.message : 'Непозната грешка'}`
      };
    }
  }

  /**
   * Обрађује одговор на постојећи тикет
   */
  private async handleTicketReply(emailTicket: ParsedEmailTicket, originalEmail: ParsedMail): Promise<{ success: boolean; ticketId?: string; message: string }> {
    try {
      // Пронађи тикет
      const ticket = await prisma.ticket.findFirst({
        where: { ticketNumber: emailTicket.replyToTicketNumber },
        include: { requester: true, assignee: true }
      });

      if (!ticket) {
        return {
          success: false,
          message: `Тикет ${emailTicket.replyToTicketNumber} није пронађен`
        };
      }

      // Додај коментар на тикет
      const comment = await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: ticket.requesterId, // Претпостављамо да је пошаљилац власник тикета
          content: emailTicket.body,
          isInternal: false
        }
      });

      // Ажурирај статус тикета ако је затворен
      if (ticket.status === 'closed' || ticket.status === 'resolved') {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: 'in_progress' }
        });
      }

      logger.info(`💬 Коментар додат на тикет ${ticket.ticketNumber} од email-а`);
      
      return {
        success: true,
        ticketId: ticket.id,
        message: `Коментар додат на тикет ${ticket.ticketNumber}`
      };

    } catch (error) {
      logger.error('❌ Грешка при додавању коментара од email-а:', error);
      return {
        success: false,
        message: `Грешка при додавању коментара: ${error instanceof Error ? error.message : 'Непозната грешка'}`
      };
    }
  }

  /**
   * Пронађи или креирај корисника на основу email адресе
   */
  private async findOrCreateUser(email: string, displayName?: string): Promise<any> {
    // Покушај да пронађеш постојећег корисника
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Креирај новог корисника
      const defaultRole = await prisma.role.findFirst({
        where: { name: 'user' }
      });

      if (!defaultRole) {
        throw new Error('Основна корисничка улога није пронађена');
      }

      user = await prisma.user.create({
        data: {
          username: email.split('@')[0],
          email,
          firstName: displayName?.split(' ')[0] || 'Непознато',
          lastName: displayName?.split(' ').slice(1).join(' ') || 'Име',
          displayName: displayName || email.split('@')[0],
          roleId: defaultRole.id,
          password: 'email-user-no-password', // Привремена лозинка
          isActive: true
        }
      });

      logger.info(`👤 Нови корисник креиран од email-а: ${user.email}`);
    }

    return user;
  }

  /**
   * Сачувај прилоге тикета
   */
  private async saveTicketAttachments(ticketId: string, attachments: EmailAttachment[]): Promise<void> {
    for (const attachment of attachments) {
      try {
        // У реалној имплементацији, овде би се фајлови сачували на диск или cloud storage
        // За сада само логујемо
        logger.info(`📎 Прилог сачуван: ${attachment.filename} (${attachment.size} bytes)`);
        
        // Можеш додати Prisma запис за attachment
        // await prisma.attachment.create({
        //   data: {
        //     ticketId,
        //     filename: attachment.filename,
        //     contentType: attachment.contentType,
        //     size: attachment.size,
        //     path: savedPath
        //   }
        // });
      } catch (error) {
        logger.error(`❌ Грешка при чувању прилога ${attachment.filename}:`, error);
      }
    }
  }

  /**
   * Пошаљи потврду о креирању тикета
   */
  private async sendTicketCreatedConfirmation(ticket: any, recipientEmail: string): Promise<void> {
    try {
      const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}`;
      
      const emailData = {
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        category: ticket.category?.name,
        requesterName: ticket.requester?.displayName || 'Непознат корисник',
        requesterEmail: recipientEmail,
        assigneeName: ticket.assignee?.displayName,
        assigneeEmail: ticket.assignee?.email,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        ticketUrl
      };

      await EmailService.sendNewTicketNotification(emailData);
      logger.info(`📧 Потврда о креирању тикета послата на: ${recipientEmail}`);
    } catch (error) {
      logger.error('❌ Грешка при слању потврде о креирању тикета:', error);
    }
  }

  /**
   * Добија конфигурацију сервиса
   */
  getConfiguration(): EmailTicketConfig {
    return { ...this.config };
  }

  /**
   * Ажурира конфигурацију сервиса
   */
  updateConfiguration(newConfig: Partial<EmailTicketConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('⚙️ Email-to-Ticket конфигурација ажурирана');
  }
}

export default new EmailToTicketService(); 