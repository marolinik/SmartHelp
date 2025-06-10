import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

const prisma = new PrismaClient();

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface TicketEmailData {
  ticketNumber: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category?: string;
  requesterName: string;
  requesterEmail: string;
  assigneeName?: string;
  assigneeEmail?: string;
  createdAt: Date;
  updatedAt: Date;
  resolutionNotes?: string;
  ticketUrl: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Иницијализује email transporter на основу конфигурације
   */
  private async initializeTransporter() {
    try {
      // Учитај email конфигурацију из environment или базе
      this.config = {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER || '',
          pass: process.env.EMAIL_PASS || ''
        },
        from: process.env.EMAIL_FROM || 'noreply@pio.gov.rs'
      };

      if (!this.config.auth.user || !this.config.auth.pass) {
        logger.warn('Email конфигурација није комплетна - email функционалност неће радити');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        tls: {
          rejectUnauthorized: false
        }
      });

      // Тестирај конекцију
      if (this.transporter) {
        await this.transporter.verify();
        logger.info('✅ Email сервис успешно иницијализован');
      }
    } catch (error) {
      logger.error('❌ Грешка при иницијализацији email сервиса:', error);
      this.transporter = null;
    }
  }

  /**
   * Проверава да ли је email сервис доступан
   */
  isAvailable(): boolean {
    return this.transporter !== null && this.config !== null;
  }

  /**
   * Шаље email са српским карактерима
   */
  async sendEmail(
    to: string | string[],
    subject: string,
    html: string,
    text?: string,
    attachments?: any[]
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      logger.warn('Email сервис није доступан');
      return false;
    }

    try {
      const mailOptions = {
        from: this.config!.from,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: text || this.stripHtml(html),
        attachments: attachments || [],
        encoding: 'utf8'
      };

      const result = await this.transporter!.sendMail(mailOptions);
      logger.info(`📧 Email послат: ${subject} -> ${mailOptions.to}`);
      return true;
    } catch (error) {
      logger.error('❌ Грешка при слању email-а:', error);
      return false;
    }
  }

  /**
   * Генерише template за нови тикет
   */
  generateNewTicketTemplate(data: TicketEmailData): EmailTemplate {
    const priorityLabels = {
      low: 'Низак',
      medium: 'Средњи', 
      high: 'Висок',
      critical: 'Критичан'
    };

    const statusLabels = {
      new: 'Нов',
      assigned: 'Додељен',
      in_progress: 'У раду',
      pending_user: 'Чека корисника',
      pending_vendor: 'Чека добављача',
      resolved: 'Решен',
      closed: 'Затворен',
      on_hold: 'На чекању',
      cancelled: 'Отказан'
    };

    const subject = `[PIO Help Desk] Нови тикет #${data.ticketNumber} - ${data.title}`;
    
    const html = `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Нови тикет - ${data.ticketNumber}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .ticket-info { background: #f8f9fa; border-left: 4px solid #1976d2; padding: 15px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
        .info-label { font-weight: bold; color: #555; }
        .info-value { color: #333; }
        .priority-high { color: #d32f2f; font-weight: bold; }
        .priority-critical { color: #b71c1c; font-weight: bold; }
        .priority-medium { color: #f57c00; font-weight: bold; }
        .priority-low { color: #388e3c; font-weight: bold; }
        .description { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .button { display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 15px 0; }
        .button:hover { background: #1565c0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 Нови тикет креиран</h1>
            <p>PIO Help Desk систем</p>
        </div>
        
        <div class="content">
            <h2>Здраво ${data.requesterName},</h2>
            <p>Ваш тикет је успешно креиран у PIO Help Desk систему. Ево детаља:</p>
            
            <div class="ticket-info">
                <div class="info-row">
                    <span class="info-label">Број тикета:</span>
                    <span class="info-value"><strong>#${data.ticketNumber}</strong></span>
                </div>
                <div class="info-row">
                    <span class="info-label">Наслов:</span>
                    <span class="info-value">${data.title}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Приоритет:</span>
                    <span class="info-value priority-${data.priority}">${priorityLabels[data.priority as keyof typeof priorityLabels] || data.priority}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Статус:</span>
                    <span class="info-value">${statusLabels[data.status as keyof typeof statusLabels] || data.status}</span>
                </div>
                ${data.category ? `
                <div class="info-row">
                    <span class="info-label">Категорија:</span>
                    <span class="info-value">${data.category}</span>
                </div>
                ` : ''}
                <div class="info-row">
                    <span class="info-label">Креирано:</span>
                    <span class="info-value">${format(data.createdAt, 'dd.MM.yyyy у HH:mm', { locale: sr })}</span>
                </div>
            </div>
            
            <h3>Опис проблема:</h3>
            <div class="description">
                ${data.description.replace(/\n/g, '<br>')}
            </div>
            
            <p>Можете пратити статус вашег тикета кликом на дугме испод:</p>
            <a href="${data.ticketUrl}" class="button">📋 Погледај тикет</a>
            
            <p><strong>Напомена:</strong> Молимо вас да сачувате број тикета <strong>#${data.ticketNumber}</strong> за будућу комуникацију.</p>
        </div>
        
        <div class="footer">
            <p>Ово је аутоматска порука из PIO Help Desk система.</p>
            <p>Републички фонд за пензијско и инвалидско осигурање</p>
            <p>📧 За питања контактирајте: helpdesk@pio.gov.rs</p>
        </div>
    </div>
</body>
</html>`;

    const text = `
PIO Help Desk - Нови тикет #${data.ticketNumber}

Здраво ${data.requesterName},

Ваш тикет је успешно креиран у PIO Help Desk систему.

Детаљи тикета:
- Број тикета: #${data.ticketNumber}
- Наслов: ${data.title}
- Приоритет: ${priorityLabels[data.priority as keyof typeof priorityLabels] || data.priority}
- Статус: ${statusLabels[data.status as keyof typeof statusLabels] || data.status}
${data.category ? `- Категорија: ${data.category}` : ''}
- Креирано: ${format(data.createdAt, 'dd.MM.yyyy у HH:mm', { locale: sr })}

Опис проблема:
${data.description}

Можете пратити статус тикета на: ${data.ticketUrl}

Молимо вас да сачувате број тикета #${data.ticketNumber} за будућу комуникацију.

--
PIO Help Desk систем
Републички фонд за пензијско и инвалидско осигурање
helpdesk@pio.gov.rs
`;

    return { subject, html, text };
  }

  /**
   * Генерише template за ажурирање тикета
   */
  generateTicketUpdateTemplate(data: TicketEmailData, updateType: 'status' | 'assignment' | 'comment' | 'resolution'): EmailTemplate {
    const statusLabels = {
      new: 'Нов',
      assigned: 'Додељен',
      in_progress: 'У раду',
      pending_user: 'Чека корисника',
      pending_vendor: 'Чека добављача',
      resolved: 'Решен',
      closed: 'Затворен',
      on_hold: 'На чекању',
      cancelled: 'Отказан'
    };

    let subjectPrefix = '';
    let updateMessage = '';

    switch (updateType) {
      case 'status':
        subjectPrefix = 'Промена статуса';
        updateMessage = `Статус вашег тикета је промењен на: <strong>${statusLabels[data.status as keyof typeof statusLabels] || data.status}</strong>`;
        break;
      case 'assignment':
        subjectPrefix = 'Додељен агент';
        updateMessage = `Ваш тикет је додељен агенту: <strong>${data.assigneeName}</strong>`;
        break;
      case 'comment':
        subjectPrefix = 'Нови коментар';
        updateMessage = 'Додат је нови коментар на ваш тикет.';
        break;
      case 'resolution':
        subjectPrefix = 'Тикет решен';
        updateMessage = 'Ваш тикет је решен. Молимо вас да прегледате решење и потврдите да ли је проблем отклоњен.';
        break;
    }

    const subject = `[PIO Help Desk] ${subjectPrefix} - Тикет #${data.ticketNumber}`;
    
    const html = `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subjectPrefix} - ${data.ticketNumber}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .update-info { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .ticket-summary { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .button { display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 15px 0; }
        .resolution { background: #e8f5e8; border: 1px solid #4caf50; padding: 15px; border-radius: 4px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔄 ${subjectPrefix}</h1>
            <p>PIO Help Desk систем</p>
        </div>
        
        <div class="content">
            <h2>Здраво ${data.requesterName},</h2>
            
            <div class="update-info">
                <h3>📢 Ажурирање тикета #${data.ticketNumber}</h3>
                <p>${updateMessage}</p>
                <p><small>Ажурирано: ${format(data.updatedAt, 'dd.MM.yyyy у HH:mm', { locale: sr })}</small></p>
            </div>
            
            <div class="ticket-summary">
                <h4>Сажетак тикета:</h4>
                <p><strong>Наслов:</strong> ${data.title}</p>
                <p><strong>Тренутни статус:</strong> ${statusLabels[data.status as keyof typeof statusLabels] || data.status}</p>
                ${data.assigneeName ? `<p><strong>Додељен агент:</strong> ${data.assigneeName}</p>` : ''}
            </div>
            
            ${updateType === 'resolution' && data.resolutionNotes ? `
            <div class="resolution">
                <h4>✅ Решење:</h4>
                <p>${data.resolutionNotes.replace(/\n/g, '<br>')}</p>
            </div>
            ` : ''}
            
            <a href="${data.ticketUrl}" class="button">📋 Погледај тикет</a>
            
            <p><strong>Напомена:</strong> Ако имате додатna питања, одговорите на овај email или контактирајте наш тим.</p>
        </div>
        
        <div class="footer">
            <p>Ово је аутоматска порука из PIO Help Desk система.</p>
            <p>Републички фонд за пензијско и инвалидско осигурање</p>
            <p>📧 За питања контактирајте: helpdesk@pio.gov.rs</p>
        </div>
    </div>
</body>
</html>`;

    const text = `
PIO Help Desk - ${subjectPrefix} - Тикет #${data.ticketNumber}

Здраво ${data.requesterName},

${updateMessage}

Сажетак тикета:
- Наслов: ${data.title}
- Тренутни статус: ${statusLabels[data.status as keyof typeof statusLabels] || data.status}
${data.assigneeName ? `- Додељен агент: ${data.assigneeName}` : ''}
- Ажурирано: ${format(data.updatedAt, 'dd.MM.yyyy у HH:mm', { locale: sr })}

${updateType === 'resolution' && data.resolutionNotes ? `
Решење:
${data.resolutionNotes}
` : ''}

Можете пратити тикет на: ${data.ticketUrl}

--
PIO Help Desk систем
Републички фонд за пензијско и инвалидско осигурање
helpdesk@pio.gov.rs
`;

    return { subject, html, text };
  }

  /**
   * Шаље нотификацију о новом тикету
   */
  async sendNewTicketNotification(ticketData: TicketEmailData): Promise<boolean> {
    const template = this.generateNewTicketTemplate(ticketData);
    return await this.sendEmail(
      ticketData.requesterEmail,
      template.subject,
      template.html,
      template.text
    );
  }

  /**
   * Шаље нотификацију о ажурирању тикета
   */
  async sendTicketUpdateNotification(
    ticketData: TicketEmailData, 
    updateType: 'status' | 'assignment' | 'comment' | 'resolution'
  ): Promise<boolean> {
    const template = this.generateTicketUpdateTemplate(ticketData, updateType);
    const recipients = [ticketData.requesterEmail];
    
    // Додај агента у CC ако постоји
    if (ticketData.assigneeEmail && ticketData.assigneeEmail !== ticketData.requesterEmail) {
      recipients.push(ticketData.assigneeEmail);
    }

    return await this.sendEmail(
      recipients,
      template.subject,
      template.html,
      template.text
    );
  }

  /**
   * Уклања HTML тагове из текста
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Тестира email конфигурацију
   */
  async testEmailConfiguration(): Promise<{ success: boolean; message: string }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        message: 'Email сервис није конфигурисан или није доступан'
      };
    }

    try {
      await this.transporter!.verify();
      return {
        success: true,
        message: 'Email конфигурација је исправна'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Грешка у email конфигурацији: ${error.message}`
      };
    }
  }
}

export default new EmailService(); 