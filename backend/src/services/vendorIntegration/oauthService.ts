import axios, { AxiosError } from 'axios';
import { encryptionService } from '../encryptionService';
import prisma from '../../config/database';
import logger from '../../utils/logger';

// OAuth грешке са српским порукама
export enum OAuthErrorType {
  INVALID_GRANT = 'Неважећа дозвола за приступ',
  INVALID_CLIENT = 'Неважећи клијент',
  INVALID_REQUEST = 'Неважећи захтев',
  UNAUTHORIZED_CLIENT = 'Неовлашћени клијент',
  ACCESS_DENIED = 'Приступ одбијен',
  UNSUPPORTED_RESPONSE_TYPE = 'Неподржан тип одговора',
  INVALID_SCOPE = 'Неважећи опсег дозвола',
  SERVER_ERROR = 'Грешка сервера',
  TEMPORARILY_UNAVAILABLE = 'Привремено недоступно',
  NETWORK_ERROR = 'Мрежна грешка',
  TOKEN_EXPIRED = 'Токен је истекао',
  REFRESH_FAILED = 'Освежавање токена није успело'
}

// OAuth конфигурација за различите vendor системе
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope: string[];
  vendorType: string;
  additionalParams?: Record<string, string>;
}

// OAuth токен подаци
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType: string;
  scope?: string;
  issuedAt: Date;
  expiresAt?: Date;
}

// Српске поруке за различите OAuth грешке
const serbianErrorMessages: Record<string, string> = {
  invalid_grant: 'Неважећа дозвола за приступ. Проверите корисничке податке.',
  invalid_client: 'Неважећи клијент. Проверите клијентски ID и тајни кључ.',
  invalid_request: 'Неважећи захтев. Недостају обавезни параметри.',
  unauthorized_client: 'Клијент није овлашћен за овај тип захтева.',
  access_denied: 'Корисник је одбио приступ апликацији.',
  unsupported_response_type: 'Неподржан тип одговора.',
  invalid_scope: 'Захтевани опсег дозвола није важећи.',
  server_error: 'Vendor сервер је пријавио грешку.',
  temporarily_unavailable: 'Vendor сервис је привремено недоступан.',
  network_error: 'Грешка у мрежној комуникацији са vendor системом.',
  token_expired: 'Токен за приступ је истекао.',
  refresh_failed: 'Није могуће освежити токен за приступ.'
};

/**
 * Сервис за OAuth 2.0 аутентификацију са vendor системима
 */
export class OAuthService {
  private readonly CONNECTION_TEST_TIMEOUT = 10000; // 10 секунди

  /**
   * Генерише URL за OAuth авторизацију
   */
  generateAuthorizationUrl(config: OAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scope.join(' '),
      state: state,
      ...config.additionalParams
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Размењује авторизациони код за токен
   */
  async exchangeCodeForToken(
    code: string,
    config: OAuthConfig,
    connectionId: string
  ): Promise<OAuthTokens> {
    try {
      const response = await axios.post(
        config.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokens = this.extractTokensFromResponse(response.data);
      
      // Сачувај токене у базу (енкриптовано)
      await this.saveTokens(connectionId, tokens);
      
      // Ажурирај статус конекције
      await prisma.vendorConnection.update({
        where: { id: connectionId },
        data: {
          connectionStatus: 'active',
          lastConnectedAt: new Date(),
          errorMessage: null
        }
      });

      logger.info(`OAuth токени успешно добијени за конекцију ${connectionId}`);
      return tokens;
    } catch (error) {
      const errorMessage = this.handleOAuthError(error);
      
      // Ажурирај статус конекције са грешком
      await prisma.vendorConnection.update({
        where: { id: connectionId },
        data: {
          connectionStatus: 'failed',
          errorMessage: errorMessage
        }
      });

      logger.error(`OAuth размена кода није успела за конекцију ${connectionId}: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Освежава токен користећи refresh токен
   */
  async refreshAccessToken(
    connectionId: string,
    config: OAuthConfig
  ): Promise<OAuthTokens> {
    try {
      // Преузми постојећи refresh токен
      const connection = await prisma.vendorConnection.findUnique({
        where: { id: connectionId }
      });

      if (!connection) {
        throw new Error('Конекција није пронађена');
      }

      const authData = encryptionService.decryptObject<any>(connection.authConfig);
      
      if (!authData.refreshToken) {
        throw new Error('Refresh токен није доступан');
      }

      const response = await axios.post(
        config.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: authData.refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokens = this.extractTokensFromResponse(response.data);
      
      // Ажурирај токене у бази
      await this.saveTokens(connectionId, tokens);
      
      logger.info(`OAuth токен успешно освежен за конекцију ${connectionId}`);
      return tokens;
    } catch (error) {
      const errorMessage = this.handleOAuthError(error, OAuthErrorType.REFRESH_FAILED);
      
      // Ажурирај статус конекције
      await prisma.vendorConnection.update({
        where: { id: connectionId },
        data: {
          connectionStatus: 'failed',
          errorMessage: errorMessage
        }
      });

      logger.error(`Освежавање OAuth токена није успело за конекцију ${connectionId}: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Проверава валидност токена
   */
  async validateToken(connectionId: string): Promise<boolean> {
    try {
      const connection = await prisma.vendorConnection.findUnique({
        where: { id: connectionId }
      });

      if (!connection) {
        return false;
      }

      const authData = encryptionService.decryptObject<any>(connection.authConfig);
      
      if (!authData.accessToken) {
        return false;
      }

      // Провери да ли је токен истекао
      if (authData.expiresAt && new Date(authData.expiresAt) < new Date()) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Валидација токена није успела за конекцију ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Добија активни access токен (освежава ако је потребно)
   */
  async getAccessToken(connectionId: string, config: OAuthConfig): Promise<string> {
    try {
      const connection = await prisma.vendorConnection.findUnique({
        where: { id: connectionId }
      });

      if (!connection) {
        throw new Error('Конекција није пронађена');
      }

      const authData = encryptionService.decryptObject<any>(connection.authConfig);
      
      if (!authData.accessToken) {
        throw new Error('Access токен није доступан');
      }

      // Провери да ли је токен истекао или ће ускоро истећи (5 минута)
      const expiresAt = authData.expiresAt ? new Date(authData.expiresAt) : null;
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (expiresAt && expiresAt < fiveMinutesFromNow) {
        // Токен је истекао или ће ускоро истећи, освежи га
        if (authData.refreshToken) {
          logger.info(`Токен ће ускоро истећи за конекцију ${connectionId}, освежавам...`);
          const newTokens = await this.refreshAccessToken(connectionId, config);
          return newTokens.accessToken;
        } else {
          throw new Error('Токен је истекао и refresh токен није доступан');
        }
      }

      return authData.accessToken;
    } catch (error) {
      logger.error(`Добијање access токена није успело за конекцију ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Тестира OAuth конекцију
   */
  async testConnection(
    connectionId: string,
    testEndpoint: string,
    config: OAuthConfig
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken(connectionId, config);
      
      const response = await axios.get(testEndpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: this.CONNECTION_TEST_TIMEOUT
      });

      // Ажурирај статус конекције
      await prisma.vendorConnection.update({
        where: { id: connectionId },
        data: {
          connectionStatus: 'active',
          lastConnectedAt: new Date(),
          errorMessage: null
        }
      });

      logger.info(`OAuth конекција успешно тестирана за конекцију ${connectionId}`);
      return response.status === 200;
    } catch (error) {
      const errorMessage = this.handleOAuthError(error);
      
      // Ажурирај статус конекције
      await prisma.vendorConnection.update({
        where: { id: connectionId },
        data: {
          connectionStatus: 'failed',
          errorMessage: errorMessage
        }
      });

      logger.error(`Тест OAuth конекције није успео за конекцију ${connectionId}: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Извлачи токене из OAuth одговора
   */
  private extractTokensFromResponse(data: any): OAuthTokens {
    const issuedAt = new Date();
    const expiresIn = data.expires_in || 3600; // Default 1 сат
    const expiresAt = new Date(issuedAt.getTime() + expiresIn * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: expiresIn,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
      issuedAt: issuedAt,
      expiresAt: expiresAt
    };
  }

  /**
   * Чува токене у базу (енкриптовано)
   */
  private async saveTokens(connectionId: string, tokens: OAuthTokens): Promise<void> {
    const authData = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      issuedAt: tokens.issuedAt,
      expiresAt: tokens.expiresAt
    };

    const encryptedAuthConfig = encryptionService.encryptObject(authData);

    await prisma.vendorConnection.update({
      where: { id: connectionId },
      data: {
        authConfig: encryptedAuthConfig,
        lastConnectedAt: new Date()
      }
    });
  }

  /**
   * Обрађује OAuth грешке и враћа српску поруку
   */
  private handleOAuthError(error: any, defaultType?: OAuthErrorType): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      // Провери OAuth грешке у одговору
      if (axiosError.response?.data) {
        const errorData: any = axiosError.response.data;
        const errorCode = errorData.error || errorData.error_description;
        
        if (errorCode && serbianErrorMessages[errorCode]) {
          return serbianErrorMessages[errorCode];
        }
      }

      // Мрежне грешке
      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
        return OAuthErrorType.NETWORK_ERROR;
      }

      // HTTP статус грешке
      switch (axiosError.response?.status) {
        case 401:
          return OAuthErrorType.INVALID_CLIENT;
        case 403:
          return OAuthErrorType.ACCESS_DENIED;
        case 500:
        case 502:
        case 503:
          return OAuthErrorType.SERVER_ERROR;
        case 504:
          return OAuthErrorType.TEMPORARILY_UNAVAILABLE;
      }
    }

    // Враћај default поруку ако је дата
    if (defaultType) {
      return defaultType;
    }

    // Генеричка грешка
    return error.message || 'Непозната OAuth грешка';
  }

  /**
   * Добија конфигурацију за специфичан vendor тип
   */
  static getVendorOAuthConfig(vendorType: string, baseConfig: any): Partial<OAuthConfig> {
    switch (vendorType.toLowerCase()) {
      case 'jira':
        return {
          authorizationUrl: 'https://auth.atlassian.com/authorize',
          tokenUrl: 'https://auth.atlassian.com/oauth/token',
          scope: ['read:jira-work', 'write:jira-work', 'read:jira-user'],
          additionalParams: {
            audience: 'api.atlassian.com',
            prompt: 'consent'
          }
        };
      
      case 'servicenow':
        return {
          authorizationUrl: `${baseConfig.instanceUrl}/oauth_auth.do`,
          tokenUrl: `${baseConfig.instanceUrl}/oauth_token.do`,
          scope: ['useraccount']
        };
      
      case 'zendesk':
        return {
          authorizationUrl: `${baseConfig.subdomain}.zendesk.com/oauth/authorizations/new`,
          tokenUrl: `${baseConfig.subdomain}.zendesk.com/oauth/tokens`,
          scope: ['read', 'write']
        };
      
      case 'freshdesk':
        return {
          authorizationUrl: `${baseConfig.domain}/oauth/authorize`,
          tokenUrl: `${baseConfig.domain}/oauth/token`,
          scope: ['read', 'write']
        };
      
      default:
        return {};
    }
  }
}

// Експортуј singleton инстанцу
export const oauthService = new OAuthService();
export default oauthService; 