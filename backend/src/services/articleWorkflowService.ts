import { logger } from '../utils/logger.js';

export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived' | 'rejected';

export interface ArticleStatusInfo {
  value: ArticleStatus;
  label: string;
  description: string;
  color: 'default' | 'warning' | 'info' | 'success' | 'error';
  icon: string;
}

export interface StatusTransition {
  from: ArticleStatus;
  to: ArticleStatus;
  requiredPermissions: string[];
  userMessage: string;
  systemMessage: string;
}

export class ArticleWorkflowService {
  /**
   * Статуси чланака са српским лабелима
   */
  private static readonly STATUS_CONFIG: Record<ArticleStatus, ArticleStatusInfo> = {
    draft: {
      value: 'draft',
      label: 'Нацрт',
      description: 'Чланак је у изради и није спреман за преглед',
      color: 'default',
      icon: 'edit'
    },
    review: {
      value: 'review',
      label: 'Преглед',
      description: 'Чланак чека одобрење администратора',
      color: 'warning',
      icon: 'rate_review'
    },
    published: {
      value: 'published',
      label: 'Објављено',
      description: 'Чланак је одобрен и доступан корисницима',
      color: 'success',
      icon: 'publish'
    },
    archived: {
      value: 'archived',
      label: 'Архивирано',
      description: 'Чланак је архивиран и није доступан корисницима',
      color: 'info',
      icon: 'archive'
    },
    rejected: {
      value: 'rejected',
      label: 'Одбачено',
      description: 'Чланак је одбачен и није одобрен за објављивање',
      color: 'error',
      icon: 'cancel'
    }
  };

  /**
   * Дозвољене транзиције статуса
   */
  private static readonly ALLOWED_TRANSITIONS: StatusTransition[] = [
    // Из нацрта у преглед
    {
      from: 'draft',
      to: 'review',
      requiredPermissions: ['kb.articles.submit', 'kb.articles.update', '*'],
      userMessage: 'Чланак је послат на преглед',
      systemMessage: 'Чланак прослеђен администратору на одобрење'
    },
    // Из прегледа у објављено
    {
      from: 'review',
      to: 'published',
      requiredPermissions: ['kb.articles.approve', '*'],
      userMessage: 'Чланак је одобрен и објављен',
      systemMessage: 'Чланак је одобрен администратором и објављен'
    },
    // Из прегледа у одбачено
    {
      from: 'review',
      to: 'rejected',
      requiredPermissions: ['kb.articles.approve', '*'],
      userMessage: 'Чланак је одбачен',
      systemMessage: 'Чланак је одбачен од стране администратора'
    },
    // Из одбаченог назад у нацрт
    {
      from: 'rejected',
      to: 'draft',
      requiredPermissions: ['kb.articles.update', '*'],
      userMessage: 'Чланак је враћен у нацрт за измене',
      systemMessage: 'Чланак враћен у нацрт за дораду'
    },
    // Из објављеног у архивирано
    {
      from: 'published',
      to: 'archived',
      requiredPermissions: ['kb.articles.archive', 'kb.articles.approve', '*'],
      userMessage: 'Чланак је архивиран',
      systemMessage: 'Чланак је архивиран и није више доступан корисницима'
    },
    // Из архивираног назад у објављено
    {
      from: 'archived',
      to: 'published',
      requiredPermissions: ['kb.articles.approve', '*'],
      userMessage: 'Чланак је поново активиран',
      systemMessage: 'Чланак је поново активиран и доступан корисницима'
    },
    // Директно објављивање из нацрта (за администраторе)
    {
      from: 'draft',
      to: 'published',
      requiredPermissions: ['kb.articles.approve', '*'],
      userMessage: 'Чланак је директно објављен',
      systemMessage: 'Чланак је директно објављен без прегледа'
    },
    // Враћање објављеног у нацрт за измене
    {
      from: 'published',
      to: 'draft',
      requiredPermissions: ['kb.articles.approve', '*'],
      userMessage: 'Чланак је враћен у нацрт за измене',
      systemMessage: 'Објављени чланак је враћен у нацрт за дораду'
    }
  ];

  /**
   * Добија информације о статусу
   */
  public static getStatusInfo(status: ArticleStatus): ArticleStatusInfo {
    return this.STATUS_CONFIG[status];
  }

  /**
   * Добија све доступне статусе
   */
  public static getAllStatuses(): ArticleStatusInfo[] {
    return Object.values(this.STATUS_CONFIG);
  }

  /**
   * Добија српски лабел за статус
   */
  public static getStatusLabel(status: ArticleStatus): string {
    return this.STATUS_CONFIG[status]?.label || status;
  }

  /**
   * Добија опис статуса
   */
  public static getStatusDescription(status: ArticleStatus): string {
    return this.STATUS_CONFIG[status]?.description || '';
  }

  /**
   * Добија боју статуса за UI
   */
  public static getStatusColor(status: ArticleStatus): string {
    return this.STATUS_CONFIG[status]?.color || 'default';
  }

  /**
   * Добија икону статуса
   */
  public static getStatusIcon(status: ArticleStatus): string {
    return this.STATUS_CONFIG[status]?.icon || 'article';
  }

  /**
   * Проверава да ли је транзиција дозвољена
   */
  public static isTransitionAllowed(from: ArticleStatus, to: ArticleStatus): boolean {
    return this.ALLOWED_TRANSITIONS.some(t => t.from === from && t.to === to);
  }

  /**
   * Добија дозвољене транзиције за тренутни статус
   */
  public static getAllowedTransitions(currentStatus: ArticleStatus): ArticleStatus[] {
    return this.ALLOWED_TRANSITIONS
      .filter(t => t.from === currentStatus)
      .map(t => t.to);
  }

  /**
   * Добија дозвољене транзиције са детаљима
   */
  public static getAllowedTransitionsWithDetails(currentStatus: ArticleStatus): Array<{
    status: ArticleStatusInfo;
    transition: StatusTransition;
  }> {
    return this.ALLOWED_TRANSITIONS
      .filter(t => t.from === currentStatus)
      .map(t => ({
        status: this.getStatusInfo(t.to),
        transition: t
      }));
  }

  /**
   * Валидира да ли корисник има дозвољења за транзицију
   */
  public static validateTransition(
    from: ArticleStatus,
    to: ArticleStatus,
    userPermissions: string[]
  ): { isValid: boolean; message: string; transition?: StatusTransition } {
    // Проверава да ли је транзиција уопште дозвољена
    const transition = this.ALLOWED_TRANSITIONS.find(t => t.from === from && t.to === to);
    
    if (!transition) {
      return {
        isValid: false,
        message: `Транзиција из статуса "${this.getStatusLabel(from)}" у "${this.getStatusLabel(to)}" није дозвољена`
      };
    }

    // Проверава дозвољења корисника
    const hasPermission = transition.requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return {
        isValid: false,
        message: `Немате дозвољење за промену статуса у "${this.getStatusLabel(to)}"`
      };
    }

    return {
      isValid: true,
      message: transition.userMessage,
      transition
    };
  }

  /**
   * Извршава валидацију и враћа резултат
   */
  public static executeTransition(
    articleId: string,
    from: ArticleStatus,
    to: ArticleStatus,
    userPermissions: string[],
    userId: string
  ): { 
    success: boolean; 
    message: string; 
    systemMessage?: string;
    shouldNotify?: boolean;
    notificationData?: any;
  } {
    const validation = this.validateTransition(from, to, userPermissions);
    
    if (!validation.isValid) {
      logger.warn(`Неуспешна транзиција чланка ${articleId}: ${validation.message}`, {
        articleId,
        from,
        to,
        userId,
        userPermissions
      });
      
      return {
        success: false,
        message: validation.message
      };
    }

    // Логује успешну транзицију
    logger.info(`Транзиција чланка ${articleId}: ${from} -> ${to}`, {
      articleId,
      from: this.getStatusLabel(from),
      to: this.getStatusLabel(to),
      userId,
      transition: validation.transition?.systemMessage
    });

    const result = {
      success: true,
      message: validation.message,
      shouldNotify: this.shouldSendNotification(from, to),
      notificationData: {
        articleId,
        from,
        to,
        fromLabel: this.getStatusLabel(from),
        toLabel: this.getStatusLabel(to),
        userId,
        timestamp: new Date().toISOString()
      }
    };

    // Dodaj systemMessage samo ako postoji
    if (validation.transition?.systemMessage) {
      (result as any).systemMessage = validation.transition.systemMessage;
    }

    return result;
  }

  /**
   * Одређује да ли треба послати нотификацију за транзицију
   */
  private static shouldSendNotification(from: ArticleStatus, to: ArticleStatus): boolean {
    // Шаље нотификацију за важне транзиције
    const notifiableTransitions = [
      { from: 'draft', to: 'review' },      // Послат на преглед
      { from: 'review', to: 'published' },  // Одобрен
      { from: 'review', to: 'rejected' },   // Одбачен
      { from: 'published', to: 'archived' } // Архивиран
    ];

    return notifiableTransitions.some(t => t.from === from && t.to === to);
  }

  /**
   * Помоћна метода за проверу да ли статус постоји
   */
  public static isValidStatus(status: string): status is ArticleStatus {
    return Object.keys(this.STATUS_CONFIG).includes(status);
  }

  /**
   * Добија следећи логични статус за чланак
   */
  public static getNextLogicalStatus(currentStatus: ArticleStatus): ArticleStatus | null {
    const commonFlow: Record<ArticleStatus, ArticleStatus | null> = {
      'draft': 'review',
      'review': 'published',
      'published': null,
      'archived': null,
      'rejected': 'draft'
    };

    return commonFlow[currentStatus] || null;
  }

  /**
   * Добија статистике статуса (за dashboard)
   */
  public static getStatusStatistics(articles: Array<{ status: ArticleStatus }>): Record<string, number> {
    const stats: Record<string, number> = {};
    
    Object.keys(this.STATUS_CONFIG).forEach(status => {
      stats[status] = articles.filter(article => article.status === status).length;
    });

    return stats;
  }

  /**
   * Форматира статус за приказ
   */
  public static formatStatusForDisplay(status: ArticleStatus): {
    label: string;
    description: string;
    color: string;
    icon: string;
  } {
    const info = this.getStatusInfo(status);
    return {
      label: info.label,
      description: info.description,
      color: info.color,
      icon: info.icon
    };
  }
} 