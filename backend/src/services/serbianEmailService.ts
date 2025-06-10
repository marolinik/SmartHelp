import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { EmailService } from './EmailService';

export interface SerbianEmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[]; // List of variables that can be replaced
  category: 'report' | 'notification' | 'reminder' | 'alert';
  description?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  encoding?: string;
}

export interface ScheduledReportEmailData {
  to: string;
  reportName: string;
  templateName: string;
  generatedAt: Date;
  attachmentUrl?: string;
  attachmentName?: string;
  reportPeriod?: { startDate: Date; endDate: Date };
  recipientName?: string;
  additionalNotes?: string;
}

export interface NotificationEmailData {
  to: string | string[];
  type: 'sla_breach' | 'escalation' | 'system_alert' | 'maintenance' | 'custom';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
  actionText?: string;
  additionalData?: Record<string, any>;
}

class SerbianEmailService {
  private emailService: EmailService;
  private templates: Map<string, SerbianEmailTemplate> = new Map();

  constructor() {
    this.emailService = new EmailService();
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default Serbian email templates
   */
  private initializeDefaultTemplates() {
    // Scheduled Report Template
    this.templates.set('scheduled-report', {
      id: 'scheduled-report',
      name: 'Заказани Извештај',
      subject: 'PIO Help Desk - {{reportName}} за {{period}}',
      htmlContent: this.getScheduledReportHtmlTemplate(),
      textContent: this.getScheduledReportTextTemplate(),
      variables: ['reportName', 'templateName', 'period', 'generatedAt', 'recipientName', 'additionalNotes'],
      category: 'report',
      description: 'Template за аутоматско слање заказаних извештаја'
    });

    // SLA Breach Notification
    this.templates.set('sla-breach', {
      id: 'sla-breach',
      name: 'SLA Прекршај',
      subject: 'УПОЗОРЕЊЕ: SLA прекршај - Тикет #{{ticketNumber}}',
      htmlContent: this.getSlaBreachHtmlTemplate(),
      textContent: this.getSlaBreachTextTemplate(),
      variables: ['ticketNumber', 'ticketTitle', 'category', 'priority', 'assignee', 'dueDate', 'breachTime'],
      category: 'alert',
      description: 'Обавештење о прекршају SLA договора'
    });

    // System Maintenance Notification
    this.templates.set('maintenance', {
      id: 'maintenance',
      name: 'Обавештење о Одржавању',
      subject: 'PIO Help Desk - Планирано одржавање система',
      htmlContent: this.getMaintenanceHtmlTemplate(),
      textContent: this.getMaintenanceTextTemplate(),
      variables: ['maintenanceDate', 'startTime', 'endTime', 'affectedServices', 'contactInfo'],
      category: 'notification',
      description: 'Обавештење корисника о планираном одржавању'
    });

    // Report Generation Error
    this.templates.set('report-error', {
      id: 'report-error',
      name: 'Грешка при Генерисању Извештаја',
      subject: 'PIO Help Desk - Грешка при генерисању извештаја "{{reportName}}"',
      htmlContent: this.getReportErrorHtmlTemplate(),
      textContent: this.getReportErrorTextTemplate(),
      variables: ['reportName', 'errorMessage', 'errorTime', 'contactSupport'],
      category: 'alert',
      description: 'Обавештење о грешци при генерисању извештаја'
    });

    console.log(`Иницијализовано ${this.templates.size} српских email template-ова`);
  }

  /**
   * Send scheduled report email
   */
  async sendScheduledReport(data: ScheduledReportEmailData): Promise<void> {
    try {
      const template = this.templates.get('scheduled-report');
      if (!template) {
        throw new Error('Template за заказани извештај није пронађен');
      }

      // Prepare template variables
      const variables = {
        reportName: data.reportName,
        templateName: data.templateName,
        period: this.formatReportPeriod(data.reportPeriod),
        generatedAt: format(data.generatedAt, 'dd.MM.yyyy у HH:mm', { locale: sr }),
        recipientName: data.recipientName || 'Поштовани корисниче',
        additionalNotes: data.additionalNotes || ''
      };

      // Render email content
      const subject = this.replaceVariables(template.subject, variables);
      const htmlContent = this.replaceVariables(template.htmlContent, variables);
      const textContent = this.replaceVariables(template.textContent, variables);

      // Prepare attachments if provided
      const attachments: EmailAttachment[] = [];
      if (data.attachmentUrl && data.attachmentName) {
        // In a real implementation, this would fetch the file from URL
        attachments.push({
          filename: data.attachmentName,
          content: `Mock report content for ${data.reportName}`,
          contentType: 'application/pdf',
          encoding: 'utf8'
        });
      }

      // Send email
      await this.sendEmail({
        to: data.to,
        subject,
        htmlContent,
        textContent,
        attachments
      });

      console.log(`Послат заказани извештај "${data.reportName}" на адресу: ${data.to}`);
    } catch (error) {
      console.error('Грешка при слању заказаног извештаја:', error);
      throw error;
    }
  }

  /**
   * Send notification email
   */
  async sendNotification(data: NotificationEmailData): Promise<void> {
    try {
      let templateId = '';
      
      switch (data.type) {
        case 'sla_breach':
          templateId = 'sla-breach';
          break;
        case 'system_alert':
        case 'maintenance':
          templateId = 'maintenance';
          break;
        default:
          templateId = 'maintenance'; // Fallback template
      }

      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template "${templateId}" није пронађен`);
      }

      // Prepare template variables
      const variables = {
        title: data.title,
        message: data.message,
        priority: this.translatePriority(data.priority),
        timestamp: format(new Date(), 'dd.MM.yyyy у HH:mm', { locale: sr }),
        actionUrl: data.actionUrl || '',
        actionText: data.actionText || 'Прикажи детаље',
        ...data.additionalData
      };

      // Render email content
      const subject = this.replaceVariables(template.subject, variables);
      const htmlContent = this.replaceVariables(template.htmlContent, variables);
      const textContent = this.replaceVariables(template.textContent, variables);

      // Send to multiple recipients if array
      const recipients = Array.isArray(data.to) ? data.to : [data.to];
      
      for (const recipient of recipients) {
        await this.sendEmail({
          to: recipient,
          subject,
          htmlContent,
          textContent,
          priority: data.priority
        });
      }

      console.log(`Послато обавештење "${data.title}" на ${recipients.length} адреса(е)`);
    } catch (error) {
      console.error('Грешка при слању обавештења:', error);
      throw error;
    }
  }

  /**
   * Send custom email using template
   */
  async sendCustomEmail(
    templateId: string, 
    to: string | string[], 
    variables: Record<string, any>
  ): Promise<void> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template "${templateId}" није пронађен`);
      }

      // Add common variables
      const allVariables = {
        timestamp: format(new Date(), 'dd.MM.yyyy у HH:mm', { locale: sr }),
        systemName: 'PIO Help Desk',
        supportEmail: 'podrska@pio.rs',
        ...variables
      };

      // Render content
      const subject = this.replaceVariables(template.subject, allVariables);
      const htmlContent = this.replaceVariables(template.htmlContent, allVariables);
      const textContent = this.replaceVariables(template.textContent, allVariables);

      // Send to recipients
      const recipients = Array.isArray(to) ? to : [to];
      
      for (const recipient of recipients) {
        await this.sendEmail({
          to: recipient,
          subject,
          htmlContent,
          textContent
        });
      }

      console.log(`Послат custom email користећи template "${templateId}" на ${recipients.length} адреса(е)`);
    } catch (error) {
      console.error('Грешка при слању custom email-а:', error);
      throw error;
    }
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): SerbianEmailTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): SerbianEmailTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Add or update custom template
   */
  setTemplate(template: SerbianEmailTemplate): void {
    this.templates.set(template.id, template);
    console.log(`Ажуриран template: ${template.name} (${template.id})`);
  }

  /**
   * Internal email sending method
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    htmlContent: string;
    textContent: string;
    attachments?: EmailAttachment[];
    priority?: string;
  }): Promise<void> {
    try {
             // Use existing EmailService to send the email
       await this.emailService.sendEmail(
         options.to,
         options.subject,
         options.htmlContent,
         options.textContent
       );
    } catch (error) {
      console.error('Грешка при слању email-а:', error);
      throw error;
    }
  }

  /**
   * Replace variables in template content
   */
  private replaceVariables(content: string, variables: Record<string, any>): string {
    let result = content;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value || ''));
    }
    
    return result;
  }

  /**
   * Format report period in Serbian
   */
  private formatReportPeriod(period?: { startDate: Date; endDate: Date }): string {
    if (!period) {
      return format(new Date(), 'MMMM yyyy', { locale: sr });
    }

    const start = format(period.startDate, 'dd.MM.yyyy', { locale: sr });
    const end = format(period.endDate, 'dd.MM.yyyy', { locale: sr });
    
    return `${start} - ${end}`;
  }

  /**
   * Translate priority to Serbian
   */
  private translatePriority(priority: string): string {
    const translations: Record<string, string> = {
      'low': 'низак',
      'medium': 'средњи', 
      'high': 'висок',
      'critical': 'критичан'
    };
    
    return translations[priority] || priority;
  }

  // Email Template Content Methods

  private getScheduledReportHtmlTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{reportName}}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1976d2, #1565c0); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .report-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1976d2; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .button { display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .attachment-info { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 PIO Help Desk Извештај</h1>
            <p>Аутоматски генерисани извештај</p>
        </div>
        
        <div class="content">
            <h2>Здраво {{recipientName}},</h2>
            
            <p>У прилогу се налази заказани извештај <strong>"{{reportName}}"</strong> који је генерисан {{generatedAt}}.</p>
            
            <div class="report-info">
                <h3>📋 Детаљи извештаја:</h3>
                <ul>
                    <li><strong>Назив:</strong> {{reportName}}</li>
                    <li><strong>Template:</strong> {{templateName}}</li>
                    <li><strong>Период:</strong> {{period}}</li>
                    <li><strong>Генерисан:</strong> {{generatedAt}}</li>
                </ul>
            </div>
            
            {{#if additionalNotes}}
            <div class="attachment-info">
                <h4>📝 Додатне напомене:</h4>
                <p>{{additionalNotes}}</p>
            </div>
            {{/if}}
            
            <p>За питања или додатне информације, обратите се нашем тиму за подршку.</p>
            
            <p>С поштовањем,<br>
            <strong>PIO Help Desk тим</strong></p>
        </div>
        
        <div class="footer">
            <p>Овај email је аутоматски генерисан од стране PIO Help Desk система.<br>
            За техничку подршку: podrska@pio.rs</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private getScheduledReportTextTemplate(): string {
    return `
PIO Help Desk - Заказани Извештај

Здраво {{recipientName}},

У прилогу се налази заказани извештај "{{reportName}}" који је генерисан {{generatedAt}}.

Детаљи извештаја:
- Назив: {{reportName}}
- Template: {{templateName}}
- Период: {{period}}
- Генерисан: {{generatedAt}}

{{#if additionalNotes}}
Додатне напомене:
{{additionalNotes}}
{{/if}}

За питања или додатне информације, обратите се нашем тиму за подршку.

С поштовањем,
PIO Help Desk тим

---
Овај email је аутоматски генерисан од стране PIO Help Desk система.
За техничку подршку: podrska@pio.rs
    `;
  }

  private getSlaBreachHtmlTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SLA Прекршај</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f44336, #d32f2f); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #fff3e0; padding: 30px; border-radius: 0 0 8px 8px; border: 2px solid #ff9800; }
        .alert-box { background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336; }
        .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ SLA ПРЕКРШАЈ</h1>
            <p>Упозорење о прекршају SLA договора</p>
        </div>
        
        <div class="content">
            <div class="alert-box">
                <h2>🚨 Хитно упозорење!</h2>
                <p>Тикет <strong>#{{ticketNumber}}</strong> је прекршио SLA договор за <strong>{{breachTime}}</strong>.</p>
            </div>
            
            <div class="ticket-info">
                <h3>📋 Детаљи тикета:</h3>
                <ul>
                    <li><strong>Број тикета:</strong> #{{ticketNumber}}</li>
                    <li><strong>Наслов:</strong> {{ticketTitle}}</li>
                    <li><strong>Категорија:</strong> {{category}}</li>
                    <li><strong>Приоритет:</strong> {{priority}}</li>
                    <li><strong>Додељено:</strong> {{assignee}}</li>
                    <li><strong>Крајњи рок:</strong> {{dueDate}}</li>
                </ul>
            </div>
            
            <p><strong>Потребна је хитна акција за решавање овог тикета!</strong></p>
            
            <a href="#" class="button">Прикажи тикет</a>
        </div>
        
        <div class="footer">
            <p>Овај email је аутоматски генерисан од стране PIO Help Desk система.<br>
            За техничку подршку: podrska@pio.rs</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private getSlaBreachTextTemplate(): string {
    return `
PIO Help Desk - SLA ПРЕКРШАЈ

⚠️ ХИТНО УПОЗОРЕЊЕ!

Тикет #{{ticketNumber}} је прекршио SLA договор за {{breachTime}}.

Детаљи тикета:
- Број тикета: #{{ticketNumber}}
- Наслов: {{ticketTitle}}
- Категорија: {{category}}
- Приоритет: {{priority}}
- Додељено: {{assignee}}
- Крајњи рок: {{dueDate}}

Потребна је хитна акција за решавање овог тикета!

---
Овај email је аутоматски генерисан од стране PIO Help Desk система.
За техничку подршку: podrska@pio.rs
    `;
  }

  private getMaintenanceHtmlTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Обавештење о одржавању</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff9800, #f57c00); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .maintenance-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 Обавештење о одржавању</h1>
            <p>PIO Help Desk систем</p>
        </div>
        
        <div class="content">
            <h2>Поштовани корисници,</h2>
            
            <p>Обавештавамо вас о планираном одржавању система које ће се одвијати:</p>
            
            <div class="maintenance-info">
                <h3>📅 Детаљи одржавања:</h3>
                <ul>
                    <li><strong>Датум:</strong> {{maintenanceDate}}</li>
                    <li><strong>Време почетка:</strong> {{startTime}}</li>
                    <li><strong>Време завршетка:</strong> {{endTime}}</li>
                    <li><strong>Погођени сервиси:</strong> {{affectedServices}}</li>
                </ul>
            </div>
            
            <p>Током овог периода, систем неће бити доступан. Молимо вас да планирате своје активности у складу са тим.</p>
            
            <p>За хитне случајеве током одржавања, обратите се на: {{contactInfo}}</p>
            
            <p>Извињавамо се због евентуалних неприлика.</p>
            
            <p>С поштовањем,<br>
            <strong>PIO Help Desk тим</strong></p>
        </div>
        
        <div class="footer">
            <p>За техничку подршку: podrska@pio.rs</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private getMaintenanceTextTemplate(): string {
    return `
PIO Help Desk - Обавештење о одржавању

Поштовани корисници,

Обавештавамо вас о планираном одржавању система које ће се одвијати:

Детаљи одржавања:
- Датум: {{maintenanceDate}}
- Време почетка: {{startTime}}
- Време завршетка: {{endTime}}
- Погођени сервиси: {{affectedServices}}

Током овог периода, систем неће бити доступан. Молимо вас да планирате своје активности у складу са тим.

За хитне случајеве током одржавања, обратите се на: {{contactInfo}}

Извињавамо се због евентуалних неприлика.

С поштовањем,
PIO Help Desk тим

---
За техничку подршку: podrska@pio.rs
    `;
  }

  private getReportErrorHtmlTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="sr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Грешка при генерисању извештаја</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f44336, #d32f2f); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #fff3e0; padding: 30px; border-radius: 0 0 8px 8px; }
        .error-info { background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .button { display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>❌ Грешка при генерисању извештаја</h1>
            <p>PIO Help Desk систем</p>
        </div>
        
        <div class="content">
            <h2>Дошло је до грешке</h2>
            
            <p>Нажалост, дошло је до грешке при генерисању извештаја <strong>"{{reportName}}"</strong>.</p>
            
            <div class="error-info">
                <h3>🔍 Детаљи грешке:</h3>
                <ul>
                    <li><strong>Извештај:</strong> {{reportName}}</li>
                    <li><strong>Време грешке:</strong> {{errorTime}}</li>
                    <li><strong>Порука грешке:</strong> {{errorMessage}}</li>
                </ul>
            </div>
            
            <p>Наш тим је аутоматски обавештен о овој грешци и радиће на њеном решавању.</p>
            
            <p>Ако је извештај хитан, молимо вас да се обратите нашој подршци:</p>
            
            <a href="mailto:{{contactSupport}}" class="button">Контактирај подршку</a>
            
            <p>С поштовањем,<br>
            <strong>PIO Help Desk тим</strong></p>
        </div>
        
        <div class="footer">
            <p>За техничку подршку: podrska@pio.rs</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private getReportErrorTextTemplate(): string {
    return `
PIO Help Desk - Грешка при генерисању извештаја

Дошло је до грешке при генерисању извештаја "{{reportName}}".

Детаљи грешке:
- Извештај: {{reportName}}
- Време грешке: {{errorTime}}
- Порука грешке: {{errorMessage}}

Наш тим је аутоматски обавештен о овој грешци и радиће на њеном решавању.

Ако је извештај хитан, молимо вас да се обратите нашој подршци: {{contactSupport}}

С поштовањем,
PIO Help Desk тим

---
За техничку подршку: podrska@pio.rs
    `;
  }
}

export const serbianEmailService = new SerbianEmailService(); 