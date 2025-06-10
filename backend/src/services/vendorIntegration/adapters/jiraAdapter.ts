import axios, { AxiosInstance } from 'axios';
import { oauthService } from '../oauthService';
import { logger } from '../../../utils/logger';

// JIRA типови
export interface JiraTicket {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    priority?: { id: string; name: string };
    status?: { id: string; name: string };
    assignee?: { accountId: string; displayName: string };
    reporter?: { accountId: string; displayName: string };
    created: string;
    updated: string;
    labels?: string[];
    customfield_10001?: string; // Custom field за категорију
  };
}

export interface JiraComment {
  id: string;
  body: string;
  author: {
    accountId: string;
    displayName: string;
  };
  created: string;
}

/**
 * Адаптер за JIRA API интеграцију
 */
export class JiraAdapter {
  private axiosInstance?: AxiosInstance;
  
  /**
   * Иницијализује axios инстанцу за JIRA API
   */
  private async getAxiosInstance(connection: any): Promise<AxiosInstance> {
    if (!this.axiosInstance) {
      const accessToken = await oauthService.getAccessToken(
        connection.id,
        {
          clientId: process.env.JIRA_CLIENT_ID || '',
          clientSecret: process.env.JIRA_CLIENT_SECRET || '',
          authorizationUrl: 'https://auth.atlassian.com/authorize',
          tokenUrl: 'https://auth.atlassian.com/oauth/token',
          redirectUri: `${process.env.API_BASE_URL}/api/vendor-integration/oauth/callback`,
          scope: ['read:jira-work', 'write:jira-work'],
          vendorType: 'jira'
        }
      );

      this.axiosInstance = axios.create({
        baseURL: 'https://api.atlassian.com/ex/jira',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      // Интерцептор за логовање
      this.axiosInstance.interceptors.response.use(
        response => response,
        error => {
          logger.error('JIRA API грешка:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          });
          return Promise.reject(this.translateError(error));
        }
      );
    }

    return this.axiosInstance;
  }

  /**
   * Преводи JIRA грешке на српски
   */
  private translateError(error: any): Error {
    if (!error.response) {
      return new Error('Грешка мрежне конекције са JIRA системом');
    }

    switch (error.response.status) {
      case 400:
        return new Error('Неважећи захтев - проверите формат података');
      case 401:
        return new Error('Неовлашћен приступ - проверите аутентификацију');
      case 403:
        return new Error('Забрањен приступ - недостају дозволе');
      case 404:
        return new Error('Ресурс није пронађен у JIRA систему');
      case 429:
        return new Error('Превише захтева - покушајте касније');
      case 500:
        return new Error('Интерна грешка JIRA сервера');
      default:
        return new Error(`JIRA грешка: ${error.response.statusText || error.message}`);
    }
  }

  /**
   * Добија cloud ID за JIRA инстанцу
   */
  private async getCloudId(connection: any): Promise<string> {
    try {
      const axios = await this.getAxiosInstance(connection);
      const response = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources');
      
      if (response.data && response.data.length > 0) {
        return response.data[0].id;
      }
      
      throw new Error('Cloud ID није пронађен');
    } catch (error) {
      logger.error('Грешка при добијању Cloud ID:', error);
      throw error;
    }
  }

  /**
   * Креира тикет у JIRA
   */
  async createTicket(connection: any, ticketData: any): Promise<JiraTicket> {
    try {
      const axios = await this.getAxiosInstance(connection);
      const cloudId = await this.getCloudId(connection);

      const jiraPayload = {
        fields: {
          project: { key: ticketData.projectKey || 'HELP' },
          summary: ticketData.title,
          description: this.formatDescription(ticketData.description),
          issuetype: { name: ticketData.issueType || 'Task' },
          priority: { id: this.mapPriority(ticketData.priority) },
          labels: ticketData.tags || [],
          // Custom fields
          ...(ticketData.category && { customfield_10001: ticketData.category })
        }
      };

      const response = await axios.post(
        `/${cloudId}/rest/api/3/issue`,
        jiraPayload
      );

      logger.info(`JIRA тикет креиран: ${response.data.key}`);
      return response.data;
    } catch (error) {
      logger.error('Грешка при креирању JIRA тикета:', error);
      throw error;
    }
  }

  /**
   * Ажурира тикет у JIRA
   */
  async updateTicket(connection: any, ticketId: string, updateData: any): Promise<void> {
    try {
      const axios = await this.getAxiosInstance(connection);
      const cloudId = await this.getCloudId(connection);

      const jiraPayload: { fields: Record<string, any> } = {
        fields: {}
      };

      // Мапирај само промењена поља
      if (updateData.title) {
        jiraPayload.fields.summary = updateData.title;
      }
      if (updateData.description) {
        jiraPayload.fields.description = this.formatDescription(updateData.description);
      }
      if (updateData.priority) {
        jiraPayload.fields.priority = { id: this.mapPriority(updateData.priority) };
      }
      if (updateData.status) {
        // За статус користимо transition API
        await this.transitionTicket(connection, ticketId, updateData.status);
        delete updateData.status;
      }

      if (Object.keys(jiraPayload.fields).length > 0) {
        await axios.put(
          `/${cloudId}/rest/api/3/issue/${ticketId}`,
          jiraPayload
        );
      }

      logger.info(`JIRA тикет ажуриран: ${ticketId}`);
    } catch (error) {
      logger.error('Грешка при ажурирању JIRA тикета:', error);
      throw error;
    }
  }

  /**
   * Добија тикет из JIRA
   */
  async getTicket(connection: any, ticketId: string): Promise<JiraTicket> {
    try {
      const axios = await this.getAxiosInstance(connection);
      const cloudId = await this.getCloudId(connection);

      const response = await axios.get(
        `/${cloudId}/rest/api/3/issue/${ticketId}`
      );

      return response.data;
    } catch (error) {
      logger.error('Грешка при преузимању JIRA тикета:', error);
      throw error;
    }
  }

  /**
   * Додаје коментар на JIRA тикет
   */
  async addComment(connection: any, ticketId: string, comment: string): Promise<void> {
    try {
      const axios = await this.getAxiosInstance(connection);
      const cloudId = await this.getCloudId(connection);

      await axios.post(
        `/${cloudId}/rest/api/3/issue/${ticketId}/comment`,
        {
          body: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: comment
                  }
                ]
              }
            ]
          }
        }
      );

      logger.info(`Коментар додат на JIRA тикет: ${ticketId}`);
    } catch (error) {
      logger.error('Грешка при додавању коментара:', error);
      throw error;
    }
  }

  /**
   * Добија коментаре за JIRA тикет
   */
  async getComments(connection: any, ticketId: string): Promise<JiraComment[]> {
    try {
      const axios = await this.getAxiosInstance(connection);
      const cloudId = await this.getCloudId(connection);

      const response = await axios.get(
        `/${cloudId}/rest/api/3/issue/${ticketId}/comment`
      );

      return response.data.comments || [];
    } catch (error) {
      logger.error('Грешка при преузимању коментара:', error);
      throw error;
    }
  }

  /**
   * Мења статус JIRA тикета
   */
  private async transitionTicket(connection: any, ticketId: string, targetStatus: string): Promise<void> {
    try {
      const axios = await this.getAxiosInstance(connection);
      const cloudId = await this.getCloudId(connection);

      // Преузми доступне транзиције
      const transitionsResponse = await axios.get(
        `/${cloudId}/rest/api/3/issue/${ticketId}/transitions`
      );

      const transitions = transitionsResponse.data.transitions;
      const targetTransition = transitions.find((t: any) => 
        t.to.name.toLowerCase() === targetStatus.toLowerCase()
      );

      if (!targetTransition) {
        logger.warn(`Транзиција за статус '${targetStatus}' није пронађена`);
        return;
      }

      // Изврши транзицију
      await axios.post(
        `/${cloudId}/rest/api/3/issue/${ticketId}/transitions`,
        {
          transition: { id: targetTransition.id }
        }
      );

    } catch (error) {
      logger.error('Грешка при промени статуса:', error);
      throw error;
    }
  }

  /**
   * Форматира опис за JIRA Atlassian Document Format
   */
  private formatDescription(description: string): any {
    return {
      type: 'doc',
      version: 1,
      content: description.split('\n').map(paragraph => ({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: paragraph
          }
        ]
      }))
    };
  }

  /**
   * Мапира приоритет из интерног у JIRA формат
   */
  private mapPriority(internalPriority: string): string {
    const priorityMap: Record<string, string> = {
      'low': '4',      // Low
      'medium': '3',   // Medium
      'high': '2',     // High
      'critical': '1'  // Highest
    };

    return priorityMap[internalPriority] || '3';
  }

  /**
   * Добија листу пројеката
   */
  async getProjects(connection: any): Promise<any[]> {
    try {
      const axios = await this.getAxiosInstance(connection);
      const cloudId = await this.getCloudId(connection);

      const response = await axios.get(
        `/${cloudId}/rest/api/3/project`
      );

      return response.data;
    } catch (error) {
      logger.error('Грешка при преузимању JIRA пројеката:', error);
      throw error;
    }
  }

  /**
   * Претражује JIRA тикете
   */
  async searchTickets(connection: any, jql: string, startAt = 0, maxResults = 50): Promise<any> {
    try {
      const axios = await this.getAxiosInstance(connection);
      const cloudId = await this.getCloudId(connection);

      const response = await axios.get(
        `/${cloudId}/rest/api/3/search`,
        {
          params: {
            jql,
            startAt,
            maxResults,
            fields: 'summary,status,priority,assignee,reporter,created,updated'
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Грешка при претрази JIRA тикета:', error);
      throw error;
    }
  }
}

// Експортуј singleton инстанцу
export const jiraAdapter = new JiraAdapter();
export default jiraAdapter; 