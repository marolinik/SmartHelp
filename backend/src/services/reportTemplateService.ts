import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { SerbianFormat } from '../utils/serbianFormatting';

const prisma = new PrismaClient();

export interface ReportColumn {
  key: string;
  title: string;
  type: 'text' | 'number' | 'date' | 'percentage' | 'duration';
  format?: string;
  width?: number;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'column';
  title: string;
  xAxis?: string;
  yAxis?: string;
  legend?: boolean;
  colors?: string[];
  height?: number;
}

export interface ReportLayoutConfig {
  title: string;
  subtitle?: string;
  sections: {
    type: 'table' | 'chart' | 'metric' | 'text';
    title: string;
    columns?: ReportColumn[];
    chart?: ChartConfig;
    content?: string;
  }[];
  footer?: string;
  orientation: 'portrait' | 'landscape';
  pageSize: 'a4' | 'letter';
}

export interface StandardReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'ticket' | 'sla' | 'user' | 'system';
  layoutConfig: ReportLayoutConfig;
  queryDefinition: any;
  chartConfig?: ChartConfig;
}

class ReportTemplateService {
  /**
   * Get all available standard report templates
   */
  getStandardTemplates(): StandardReportTemplate[] {
    return [
      this.getTicketVolumeTemplate(),
      this.getTicketResolutionTemplate(),
      this.getSlaComplianceTemplate(),
      this.getUserPerformanceTemplate(),
      this.getSystemUsageTemplate(),
      this.getCategoryAnalysisTemplate(),
      this.getPriorityAnalysisTemplate(),
      this.getMonthlyTrendsTemplate(),
      this.getDepartmentPerformanceTemplate(),
      this.getKnowledgeBaseUsageTemplate()
    ];
  }

  /**
   * Ticket Volume Report Template
   */
  private getTicketVolumeTemplate(): StandardReportTemplate {
    return {
      id: 'ticket-volume',
      name: 'Извештај о Обиму Тикета',
      description: 'Детаљан преглед броја тикета по различитим критеријумима',
      category: 'ticket',
      queryDefinition: {
        metrics: ['totalTickets', 'resolvedTickets', 'pendingTickets'],
        groupBy: ['date', 'category', 'priority', 'status'],
        dateRange: 'last30days',
        filters: []
      },
      layoutConfig: {
        title: 'Извештај о Обиму Тикета',
        subtitle: 'Период: {dateRange}',
        orientation: 'portrait',
        pageSize: 'a4',
        sections: [
          {
            type: 'metric',
            title: 'Кључне Метрике',
            content: `
              Укупно тикета: {totalTickets}
              Решени тикети: {resolvedTickets}
              Тикети на чекању: {pendingTickets}
              Проценат решености: {resolutionRate}%
            `
          },
          {
            type: 'chart',
            title: 'Тренд Тикета по Данима',
            chart: {
              type: 'line',
              title: 'Дневни тренд тикета',
              xAxis: 'Дан',
              yAxis: 'Број тикета',
              legend: true,
              colors: ['#1976d2', '#4caf50', '#ff9800'],
              height: 300
            }
          },
          {
            type: 'table',
            title: 'Тикети по Категоријама',
            columns: [
              { key: 'category', title: 'Категорија', type: 'text', width: 200 },
              { key: 'total', title: 'Укупно', type: 'number', width: 100 },
              { key: 'resolved', title: 'Решено', type: 'number', width: 100 },
              { key: 'pending', title: 'На чекању', type: 'number', width: 100 },
              { key: 'percentage', title: 'Проценат', type: 'percentage', width: 100 }
            ]
          },
          {
            type: 'chart',
            title: 'Распоред по Приоритету',
            chart: {
              type: 'pie',
              title: 'Тикети по приоритету',
              legend: true,
              colors: ['#f44336', '#ff9800', '#2196f3', '#4caf50'],
              height: 250
            }
          }
        ],
        footer: 'Генерисано: {generatedDate} | PIO Help Desk Систем'
      }
    };
  }

  /**
   * Ticket Resolution Time Report Template
   */
  private getTicketResolutionTemplate(): StandardReportTemplate {
    return {
      id: 'ticket-resolution',
      name: 'Извештај о Времену Решавања',
      description: 'Анализа времена потребног за решавање тикета',
      category: 'ticket',
      queryDefinition: {
        metrics: ['averageResolutionTime', 'averageFirstResponseTime'],
        groupBy: ['category', 'priority', 'assignee'],
        dateRange: 'last30days',
        filters: [{ field: 'status', operator: 'in', value: ['resolved', 'closed'] }]
      },
      layoutConfig: {
        title: 'Извештај о Времену Решавања Тикета',
        subtitle: 'Анализа перформанси решавања за период: {dateRange}',
        orientation: 'landscape',
        pageSize: 'a4',
        sections: [
          {
            type: 'metric',
            title: 'Просечна Времена',
            content: `
              Просечно време решавања: {avgResolutionTime} сати
              Просечно време првог одговора: {avgFirstResponseTime} сати
              Најбржи тикет: {fastestTicket} минута
              Најспорији тикет: {slowestTicket} сати
            `
          },
          {
            type: 'chart',
            title: 'Време Решавања по Категоријама',
            chart: {
              type: 'column',
              title: 'Просечно време решавања (сати)',
              xAxis: 'Категорија',
              yAxis: 'Сати',
              legend: false,
              colors: ['#2196f3'],
              height: 300
            }
          },
          {
            type: 'table',
            title: 'Детаљна Анализа по Категоријама',
            columns: [
              { key: 'category', title: 'Категорија', type: 'text', width: 150 },
              { key: 'ticketCount', title: 'Број тикета', type: 'number', width: 100 },
              { key: 'avgResolution', title: 'Просек решавања', type: 'duration', width: 120 },
              { key: 'avgResponse', title: 'Просек одговора', type: 'duration', width: 120 },
              { key: 'minTime', title: 'Најкраће', type: 'duration', width: 100 },
              { key: 'maxTime', title: 'Најдуже', type: 'duration', width: 100 }
            ]
          }
        ],
        footer: 'Генерисано: {generatedDate} | PIO Help Desk Систем'
      }
    };
  }

  /**
   * SLA Compliance Report Template  
   */
  private getSlaComplianceTemplate(): StandardReportTemplate {
    return {
      id: 'sla-compliance',
      name: 'Извештај о SLA Усаглашености',
      description: 'Праћење испуњавања SLA обавеза и циљева',
      category: 'sla',
      queryDefinition: {
        metrics: ['slaCompliance', 'responseTimeCompliance', 'resolutionTimeCompliance'],
        groupBy: ['category', 'priority', 'slaPolicy'],
        dateRange: 'last30days',
        filters: []
      },
      layoutConfig: {
        title: 'Извештај о SLA Усаглашености',
        subtitle: 'Праћење испуњавања SLA циљева за период: {dateRange}',
        orientation: 'portrait',
        pageSize: 'a4',
        sections: [
          {
            type: 'metric',
            title: 'Укупна SLA Усаглашеност',
            content: `
              Укупна усаглашеност: {overallCompliance}%
              Усаглашеност одговора: {responseCompliance}%
              Усаглашеност решавања: {resolutionCompliance}%
              Прекршени SLA-ови: {breachedSLAs}
            `
          },
          {
            type: 'chart',
            title: 'SLA Усаглашеност по Категоријама',
            chart: {
              type: 'bar',
              title: 'Проценат усаглашености (%)',
              xAxis: 'Проценат',
              yAxis: 'Категорија',
              legend: true,
              colors: ['#4caf50', '#ff9800'],
              height: 300
            }
          },
          {
            type: 'table',
            title: 'Детаљна SLA Анализа',
            columns: [
              { key: 'category', title: 'Категорија', type: 'text', width: 150 },
              { key: 'policy', title: 'SLA Политика', type: 'text', width: 120 },
              { key: 'totalTickets', title: 'Укупно', type: 'number', width: 80 },
              { key: 'compliant', title: 'Усаглашено', type: 'number', width: 80 },
              { key: 'breached', title: 'Прекршено', type: 'number', width: 80 },
              { key: 'compliance', title: 'Усаглашеност', type: 'percentage', width: 100 }
            ]
          },
          {
            type: 'chart',
            title: 'Тренд SLA Усаглашености',
            chart: {
              type: 'line',
              title: 'Недељни тренд усаглашености',
              xAxis: 'Недеља',
              yAxis: 'Проценат (%)',
              legend: true,
              colors: ['#2196f3', '#4caf50'],
              height: 250
            }
          }
        ],
        footer: 'Генерисано: {generatedDate} | PIO Help Desk Систем'
      }
    };
  }

  /**
   * User Performance Report Template
   */
  private getUserPerformanceTemplate(): StandardReportTemplate {
    return {
      id: 'user-performance',
      name: 'Извештај о Перформансама Корисника',
      description: 'Анализа радних перформанси корисника и агената',
      category: 'user',
      queryDefinition: {
        metrics: ['ticketsResolved', 'averageResolutionTime', 'slaCompliance', 'userRating'],
        groupBy: ['user', 'role', 'department'],
        dateRange: 'last30days',
        filters: [{ field: 'role', operator: 'in', value: ['l1_agent', 'l2_specialist', 'l3_expert'] }]
      },
      layoutConfig: {
        title: 'Извештај о Перформансама Корисника',
        subtitle: 'Анализа радних резултата за период: {dateRange}',
        orientation: 'landscape',
        pageSize: 'a4',
        sections: [
          {
            type: 'metric',
            title: 'Укупне Статистике',
            content: `
              Укупно активних агената: {activeAgents}
              Просечно решених тикета по агенту: {avgTicketsPerAgent}
              Просечна SLA усаглашеност: {avgSLACompliance}%
              Најбољи агент: {topAgent}
            `
          },
          {
            type: 'table',
            title: 'Ранг Листа Агената',
            columns: [
              { key: 'rank', title: 'Ранг', type: 'number', width: 50 },
              { key: 'userName', title: 'Име и презиме', type: 'text', width: 150 },
              { key: 'role', title: 'Улога', type: 'text', width: 100 },
              { key: 'department', title: 'Одељење', type: 'text', width: 120 },
              { key: 'ticketsResolved', title: 'Решено', type: 'number', width: 80 },
              { key: 'avgResolutionTime', title: 'Просек времена', type: 'duration', width: 100 },
              { key: 'slaCompliance', title: 'SLA усаглашеност', type: 'percentage', width: 100 },
              { key: 'performanceRating', title: 'Оцена', type: 'number', width: 80 }
            ]
          },
          {
            type: 'chart',
            title: 'Распоред Перформанси по Одељењима',
            chart: {
              type: 'bar',
              title: 'Просечна оцена перформанси',
              xAxis: 'Одељење',
              yAxis: 'Оцена',
              legend: false,
              colors: ['#3f51b5'],
              height: 250
            }
          }
        ],
        footer: 'Генерисано: {generatedDate} | PIO Help Desk Систем'
      }
    };
  }

  /**
   * System Usage Report Template
   */
  private getSystemUsageTemplate(): StandardReportTemplate {
    return {
      id: 'system-usage',
      name: 'Извештај о Коришћењу Система',
      description: 'Анализа коришћења система и корисничке активности',
      category: 'system',
      queryDefinition: {
        metrics: ['totalUsers', 'activeUsers', 'averageSessionTime', 'popularFeatures'],
        groupBy: ['date', 'department', 'feature'],
        dateRange: 'last30days',
        filters: []
      },
      layoutConfig: {
        title: 'Извештај о Коришћењу Система',
        subtitle: 'Анализа корисничке активности за период: {dateRange}',
        orientation: 'portrait',
        pageSize: 'a4',
        sections: [
          {
            type: 'metric',
            title: 'Кључне Метрике Коришћења',
            content: `
              Укупно корисника: {totalUsers}
              Активни корисници: {activeUsers}
              Просечно време сесије: {avgSessionTime} минута
              Најпопуларнија функција: {topFeature}
            `
          },
          {
            type: 'chart',
            title: 'Дневна Активност Корисника',
            chart: {
              type: 'line',
              title: 'Број активних корисника',
              xAxis: 'Дан',
              yAxis: 'Број корисника',
              legend: true,
              colors: ['#2196f3', '#4caf50'],
              height: 300
            }
          },
          {
            type: 'chart',
            title: 'Популарне Функције',
            chart: {
              type: 'doughnut',
              title: 'Коришћење функција система',
              legend: true,
              colors: ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5'],
              height: 250
            }
          },
          {
            type: 'table',
            title: 'Активност по Одељењима',
            columns: [
              { key: 'department', title: 'Одељење', type: 'text', width: 150 },
              { key: 'totalUsers', title: 'Укупно корисника', type: 'number', width: 120 },
              { key: 'activeUsers', title: 'Активни', type: 'number', width: 100 },
              { key: 'avgSessionTime', title: 'Просек сесије', type: 'duration', width: 120 },
              { key: 'activityLevel', title: 'Ниво активности', type: 'percentage', width: 120 }
            ]
          }
        ],
        footer: 'Генерисано: {generatedDate} | PIO Help Desk Систем'
      }
    };
  }

  /**
   * Category Analysis Report Template
   */
  private getCategoryAnalysisTemplate(): StandardReportTemplate {
    return {
      id: 'category-analysis',
      name: 'Анализа по Категоријама',
      description: 'Детаљна анализа тикета по категоријама проблема',
      category: 'ticket',
      queryDefinition: {
        metrics: ['ticketCount', 'resolutionRate', 'averageTime', 'complexity'],
        groupBy: ['category', 'subcategory'],
        dateRange: 'last30days',
        filters: []
      },
      layoutConfig: {
        title: 'Анализа Тикета по Категоријама',
        subtitle: 'Детаљни преглед категорија за период: {dateRange}',
        orientation: 'landscape',
        pageSize: 'a4',
        sections: [
          {
            type: 'chart',
            title: 'Распоред Тикета по Категоријама',
            chart: {
              type: 'pie',
              title: 'Удео категорија у укупном броју тикета',
              legend: true,
              colors: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff'],
              height: 300
            }
          },
          {
            type: 'table',
            title: 'Детаљна Статистика по Категоријама',
            columns: [
              { key: 'category', title: 'Категорија', type: 'text', width: 180 },
              { key: 'ticketCount', title: 'Број тикета', type: 'number', width: 100 },
              { key: 'resolved', title: 'Решено', type: 'number', width: 80 },
              { key: 'resolutionRate', title: 'Проценат решености', type: 'percentage', width: 120 },
              { key: 'avgResolutionTime', title: 'Просек времена', type: 'duration', width: 120 },
              { key: 'complexity', title: 'Сложеност', type: 'text', width: 100 }
            ]
          }
        ],
        footer: 'Генерисано: {generatedDate} | PIO Help Desk Систем'
      }
    };
  }

  /**
   * Priority Analysis Report Template
   */
  private getPriorityAnalysisTemplate(): StandardReportTemplate {
    return {
      id: 'priority-analysis',
      name: 'Анализа по Приоритету',
      description: 'Анализа тикета по нивоима приоритета',
      category: 'ticket',
      queryDefinition: {
        metrics: ['ticketCount', 'avgResolutionTime', 'slaCompliance'],
        groupBy: ['priority'],
        dateRange: 'last30days',
        filters: []
      },
      layoutConfig: {
        title: 'Анализа Тикета по Приоритету',
        subtitle: 'Преглед перформанси по нивоима приоритета за период: {dateRange}',
        orientation: 'portrait',
        pageSize: 'a4',
        sections: [
          {
            type: 'metric',
            title: 'Приоритети - Кључне Цифре',
            content: `
              Критични тикети: {criticalTickets}
              Високи приоритет: {highPriorityTickets}
              Средњи приоритет: {mediumPriorityTickets}
              Низак приоритет: {lowPriorityTickets}
            `
          },
          {
            type: 'chart',
            title: 'Време Решавања по Приоритету',
            chart: {
              type: 'column',
              title: 'Просечно време решавања (сати)',
              xAxis: 'Приоритет',
              yAxis: 'Сати',
              legend: false,
              colors: ['#f44336', '#ff9800', '#2196f3', '#4caf50'],
              height: 250
            }
          },
          {
            type: 'table',
            title: 'Статистика по Приоритетима',
            columns: [
              { key: 'priority', title: 'Приоритет', type: 'text', width: 120 },
              { key: 'count', title: 'Број тикета', type: 'number', width: 100 },
              { key: 'percentage', title: 'Проценат', type: 'percentage', width: 100 },
              { key: 'avgTime', title: 'Просек времена', type: 'duration', width: 120 },
              { key: 'slaCompliance', title: 'SLA усаглашеност', type: 'percentage', width: 120 }
            ]
          }
        ],
        footer: 'Генерисано: {generatedDate} | PIO Help Desk Систем'
      }
    };
  }

  /**
   * Monthly Trends Report Template
   */
  private getMonthlyTrendsTemplate(): StandardReportTemplate {
    return {
      id: 'monthly-trends',
      name: 'Месечни Трендови',
      description: 'Анализа трендова и промена током времена',
      category: 'ticket',
      queryDefinition: {
        metrics: ['ticketCount', 'resolutionRate', 'avgTime', 'slaCompliance'],
        groupBy: ['month'],
        dateRange: 'last12months',
        filters: []
      },
      layoutConfig: {
        title: 'Месечни Трендови - Анализа Година',
        subtitle: 'Преглед трендова за претходних 12 месеци',
        orientation: 'landscape',
        pageSize: 'a4',
        sections: [
          {
            type: 'chart',
            title: 'Тренд Броја Тикета',
            chart: {
              type: 'area',
              title: 'Месечни број тикета',
              xAxis: 'Месец',
              yAxis: 'Број тикета',
              legend: true,
              colors: ['#2196f3', '#4caf50'],
              height: 300
            }
          },
          {
            type: 'chart',
            title: 'Тренд SLA Усаглашености',
            chart: {
              type: 'line',
              title: 'Месечна SLA усаглашеност (%)',
              xAxis: 'Месец',
              yAxis: 'Проценат',
              legend: true,
              colors: ['#ff9800'],
              height: 250
            }
          },
          {
            type: 'table',
            title: 'Месечна Статистика',
            columns: [
              { key: 'month', title: 'Месец', type: 'text', width: 100 },
              { key: 'ticketCount', title: 'Број тикета', type: 'number', width: 100 },
              { key: 'resolved', title: 'Решено', type: 'number', width: 100 },
              { key: 'resolutionRate', title: 'Проценат решености', type: 'percentage', width: 120 },
              { key: 'avgResolutionTime', title: 'Просек времена', type: 'duration', width: 120 },
              { key: 'slaCompliance', title: 'SLA усаглашеност', type: 'percentage', width: 120 }
            ]
          }
        ],
        footer: 'Генерисано: {generatedDate} | PIO Help Desk Систем'
      }
    };
  }

  /**
   * Department Performance Report Template
   */
  private getDepartmentPerformanceTemplate(): StandardReportTemplate {
    return {
      id: 'department-performance',
      name: 'Перформансе по Одељењима',
      description: 'Анализа радних резултата по организационим јединицама',
      category: 'user',
      queryDefinition: {
        metrics: ['ticketCount', 'resolutionRate', 'avgTime', 'userCount'],
        groupBy: ['department'],
        dateRange: 'last30days',
        filters: []
      },
      layoutConfig: {
        title: 'Извештај о Перформансама по Одељењима',
        subtitle: 'Компаративна анализа одељења за период: {dateRange}',
        orientation: 'landscape',
        pageSize: 'a4',
        sections: [
          {
            type: 'chart',
            title: 'Перформансе Одељења - Упоредни Приказ',
            chart: {
              type: 'bar',
              title: 'Проценат решености по одељењима',
              xAxis: 'Проценат',
              yAxis: 'Одељење',
              legend: false,
              colors: ['#3f51b5'],
              height: 300
            }
          },
          {
            type: 'table',
            title: 'Детаљна Статистика по Одељењима',
            columns: [
              { key: 'department', title: 'Одељење', type: 'text', width: 180 },
              { key: 'userCount', title: 'Број корисника', type: 'number', width: 100 },
              { key: 'ticketCount', title: 'Број тикета', type: 'number', width: 100 },
              { key: 'resolved', title: 'Решено', type: 'number', width: 100 },
              { key: 'resolutionRate', title: 'Проценат решености', type: 'percentage', width: 120 },
              { key: 'avgResolutionTime', title: 'Просек времена', type: 'duration', width: 120 }
            ]
          }
        ],
        footer: 'Генерисано: {generatedDate} | PIO Help Desk Систем'
      }
    };
  }

  /**
   * Knowledge Base Usage Report Template
   */
  private getKnowledgeBaseUsageTemplate(): StandardReportTemplate {
    return {
      id: 'kb-usage',
      name: 'Коришћење Базе Знања',
      description: 'Анализа коришћења и ефикасности базе знања',
      category: 'system',
      queryDefinition: {
        metrics: ['articleViews', 'searchQueries', 'helpfulRatings', 'articleCount'],
        groupBy: ['category', 'article'],
        dateRange: 'last30days',
        filters: []
      },
      layoutConfig: {
        title: 'Извештај о Коришћењу Базе Знања',
        subtitle: 'Анализа ефикасности и коришћења за период: {dateRange}',
        orientation: 'portrait',
        pageSize: 'a4',
        sections: [
          {
            type: 'metric',
            title: 'Кључне Метрике Базе Знања',
            content: `
              Укупно чланака: {totalArticles}
              Укупно прегледа: {totalViews}
              Укупно претрага: {totalSearches}
              Просечна корисност: {avgHelpfulness}%
            `
          },
          {
            type: 'table',
            title: 'Најпопуларнији Чланци',
            columns: [
              { key: 'title', title: 'Наслов чланка', type: 'text', width: 250 },
              { key: 'category', title: 'Категорија', type: 'text', width: 120 },
              { key: 'views', title: 'Прегледи', type: 'number', width: 80 },
              { key: 'helpful', title: 'Корисно', type: 'number', width: 80 },
              { key: 'helpfulness', title: 'Проценат корисности', type: 'percentage', width: 120 }
            ]
          },
          {
            type: 'chart',
            title: 'Коришћење по Категоријама',
            chart: {
              type: 'doughnut',
              title: 'Прегледи чланака по категоријама',
              legend: true,
              colors: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0'],
              height: 250
            }
          }
        ],
        footer: 'Генерисано: {generatedDate} | PIO Help Desk Систем'
      }
    };
  }

  /**
   * Create custom report template
   */
  async createCustomTemplate(template: Omit<StandardReportTemplate, 'id'>, createdBy: string): Promise<string> {
    try {
      const reportTemplate = await prisma.reportTemplate.create({
        data: {
          name: template.name,
          description: template.description,
          category: template.category,
          templateType: 'custom',
          queryDefinition: JSON.stringify(template.queryDefinition),
          layoutConfig: JSON.stringify(template.layoutConfig),
          chartConfig: template.chartConfig ? JSON.stringify(template.chartConfig) : null,
          isPublic: false,
          createdBy
        }
      });

      return reportTemplate.id;
    } catch (error) {
      throw new Error(`Greška pri kreiranju custom template-a: ${error}`);
    }
  }

  /**
   * Get all report templates (standard + custom)
   */
  async getAllTemplates(userId?: string): Promise<StandardReportTemplate[]> {
    try {
      const templates = [...this.getStandardTemplates()];

      // Add custom templates from database
      const customTemplates = await prisma.reportTemplate.findMany({
        where: {
          OR: [
            { isPublic: true },
            { createdBy: userId }
          ]
        }
      });

      const convertedTemplates = customTemplates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description || '',
        category: template.category as 'ticket' | 'sla' | 'user' | 'system',
        layoutConfig: JSON.parse(template.layoutConfig),
        queryDefinition: JSON.parse(template.queryDefinition),
        chartConfig: template.chartConfig ? JSON.parse(template.chartConfig) : undefined
      }));

      return [...templates, ...convertedTemplates];
    } catch (error) {
      throw new Error(`Greška pri dobijanju template-ova: ${error}`);
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<StandardReportTemplate | null> {
    try {
      // Check if it's a standard template
      const standardTemplates = this.getStandardTemplates();
      const standardTemplate = standardTemplates.find(t => t.id === templateId);
      
      if (standardTemplate) {
        return standardTemplate;
      }

      // Check custom templates
      const customTemplate = await prisma.reportTemplate.findUnique({
        where: { id: templateId }
      });

      if (!customTemplate) {
        return null;
      }

      return {
        id: customTemplate.id,
        name: customTemplate.name,
        description: customTemplate.description || '',
        category: customTemplate.category as 'ticket' | 'sla' | 'user' | 'system',
        layoutConfig: JSON.parse(customTemplate.layoutConfig),
        queryDefinition: JSON.parse(customTemplate.queryDefinition),
        chartConfig: customTemplate.chartConfig ? JSON.parse(customTemplate.chartConfig) : undefined
      };
    } catch (error) {
      throw new Error(`Greška pri dobijanju template-a: ${error}`);
    }
  }

  /**
   * Delete custom template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<boolean> {
    try {
      const template = await prisma.reportTemplate.findFirst({
        where: {
          id: templateId,
          createdBy: userId,
          templateType: 'custom'
        }
      });

      if (!template) {
        throw new Error('Template ne postoji ili nemate dozvolu za brisanje');
      }

      await prisma.reportTemplate.delete({
        where: { id: templateId }
      });

      return true;
    } catch (error) {
      throw new Error(`Greška pri brisanju template-a: ${error}`);
    }
  }

  /**
   * Format duration for Serbian locale
   */
  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} мин`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}ч ${mins}мин` : `${hours}ч`;
    } else {
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      return hours > 0 ? `${days}д ${hours}ч` : `${days}д`;
    }
  }

  /**
   * Format date for Serbian locale
   */
  formatDate(date: Date): string {
    return SerbianFormat.formatDate(date);
  }

  /**
   * Format percentage for Serbian locale
   */
  formatPercentage(value: number): string {
    return SerbianFormat.formatPercentage(value);
  }
}

export const reportTemplateService = new ReportTemplateService(); 