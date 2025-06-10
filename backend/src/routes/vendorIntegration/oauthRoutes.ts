import { Router, Request, Response } from 'express';
import { oauthService, OAuthConfig } from '../../services/vendorIntegration/oauthService';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorization';
import { validateRequest } from '../../middleware/validation';
import { body, param, query } from 'express-validator';
import { encryptionService } from '../../services/encryptionService';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import crypto from 'crypto';

const router = Router();

// OAuth state чување (у production-у користити Redis или базу)
const oauthStateStore = new Map<string, { connectionId: string; userId: string; timestamp: number }>();

// Чишћење старих state вредности (старији од 30 минута)
setInterval(() => {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  for (const [state, data] of oauthStateStore.entries()) {
    if (data.timestamp < thirtyMinutesAgo) {
      oauthStateStore.delete(state);
    }
  }
}, 5 * 60 * 1000); // Чисти сваких 5 минута

/**
 * Иницира OAuth flow за vendor конекцију
 * POST /api/vendor-integration/oauth/authorize/:connectionId
 */
router.post('/authorize/:connectionId',
  authenticate,
  authorize(['admin', 'manager']),
  validateRequest([
    param('connectionId').notEmpty().withMessage('ID конекције је обавезан')
  ]),
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;

      // Преузми конекцију и vendor систем
      const connection = await prisma.vendorConnection.findUnique({
        where: { id: connectionId },
        include: { vendorSystem: true }
      });

      if (!connection) {
        return res.status(404).json({
          success: false,
          message: 'Конекција није пронађена'
        });
      }

      // Провери да ли је конекција већ активна
      if (connection.connectionStatus === 'active') {
        return res.status(400).json({
          success: false,
          message: 'Конекција је већ активна'
        });
      }

      // Генериши state за CSRF заштиту
      const state = crypto.randomBytes(32).toString('hex');
      oauthStateStore.set(state, {
        connectionId,
        userId: req.user!.id,
        timestamp: Date.now()
      });

      // Конфигуриши OAuth параметре
      const baseConfig = connection.authConfig ? 
        encryptionService.decryptObject<any>(connection.authConfig) : {};
      
      const vendorConfig = oauthService.getVendorOAuthConfig(
        connection.vendorSystem.vendorType,
        baseConfig
      );

      const oauthConfig: OAuthConfig = {
        clientId: baseConfig.clientId || process.env[`${connection.vendorSystem.vendorType.toUpperCase()}_CLIENT_ID`] || '',
        clientSecret: baseConfig.clientSecret || process.env[`${connection.vendorSystem.vendorType.toUpperCase()}_CLIENT_SECRET`] || '',
        redirectUri: `${process.env.API_BASE_URL}/api/vendor-integration/oauth/callback`,
        authorizationUrl: vendorConfig.authorizationUrl || connection.vendorSystem.baseUrl + '/oauth/authorize',
        tokenUrl: vendorConfig.tokenUrl || connection.vendorSystem.baseUrl + '/oauth/token',
        scope: vendorConfig.scope || ['read', 'write'],
        vendorType: connection.vendorSystem.vendorType,
        additionalParams: vendorConfig.additionalParams
      };

      // Генериши URL за авторизацију
      const authUrl = oauthService.generateAuthorizationUrl(oauthConfig, state);

      logger.info(`OAuth flow иницијован за конекцију ${connectionId}`);

      res.json({
        success: true,
        authUrl,
        message: 'Пратите URL за авторизацију'
      });

    } catch (error) {
      logger.error('Грешка при иницирању OAuth flow:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при иницирању OAuth авторизације'
      });
    }
  }
);

/**
 * OAuth callback за примање авторизационог кода
 * GET /api/vendor-integration/oauth/callback
 */
router.get('/callback',
  validateRequest([
    query('code').optional().isString(),
    query('state').notEmpty().withMessage('State параметар је обавезан'),
    query('error').optional().isString(),
    query('error_description').optional().isString()
  ]),
  async (req: Request, res: Response) => {
    try {
      const { code, state, error, error_description } = req.query as any;

      // Провери state за CSRF заштиту
      const stateData = oauthStateStore.get(state);
      if (!stateData) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #d32f2f;">Грешка авторизације</h2>
              <p>Неважећи или истекао state параметар.</p>
              <button onclick="window.close()">Затвори прозор</button>
            </body>
          </html>
        `);
      }

      // Уклони state из чувања
      oauthStateStore.delete(state);

      // Провери грешке
      if (error) {
        await prisma.vendorConnection.update({
          where: { id: stateData.connectionId },
          data: {
            connectionStatus: 'failed',
            errorMessage: `OAuth грешка: ${error} - ${error_description || 'Нема описа'}`
          }
        });

        return res.send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #d32f2f;">Авторизација одбијена</h2>
              <p>${error_description || error}</p>
              <button onclick="window.close()">Затвори прозор</button>
            </body>
          </html>
        `);
      }

      // Провери да ли имамо код
      if (!code) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #d32f2f;">Грешка авторизације</h2>
              <p>Авторизациони код није примљен.</p>
              <button onclick="window.close()">Затвори прозор</button>
            </body>
          </html>
        `);
      }

      // Преузми конекцију и конфигурацију
      const connection = await prisma.vendorConnection.findUnique({
        where: { id: stateData.connectionId },
        include: { vendorSystem: true }
      });

      if (!connection) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #d32f2f;">Грешка</h2>
              <p>Конекција није пронађена.</p>
              <button onclick="window.close()">Затвори прозор</button>
            </body>
          </html>
        `);
      }

      // Конфигуриши OAuth параметре
      const baseConfig = connection.authConfig ? 
        encryptionService.decryptObject<any>(connection.authConfig) : {};
      
      const vendorConfig = oauthService.getVendorOAuthConfig(
        connection.vendorSystem.vendorType,
        baseConfig
      );

      const oauthConfig: OAuthConfig = {
        clientId: baseConfig.clientId || process.env[`${connection.vendorSystem.vendorType.toUpperCase()}_CLIENT_ID`] || '',
        clientSecret: baseConfig.clientSecret || process.env[`${connection.vendorSystem.vendorType.toUpperCase()}_CLIENT_SECRET`] || '',
        redirectUri: `${process.env.API_BASE_URL}/api/vendor-integration/oauth/callback`,
        authorizationUrl: vendorConfig.authorizationUrl || connection.vendorSystem.baseUrl + '/oauth/authorize',
        tokenUrl: vendorConfig.tokenUrl || connection.vendorSystem.baseUrl + '/oauth/token',
        scope: vendorConfig.scope || ['read', 'write'],
        vendorType: connection.vendorSystem.vendorType,
        additionalParams: vendorConfig.additionalParams
      };

      // Размени код за токен
      await oauthService.exchangeCodeForToken(code, oauthConfig, stateData.connectionId);

      logger.info(`OAuth авторизација успешна за конекцију ${stateData.connectionId}`);

      // Врати успешну HTML страницу
      res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #4caf50;">Авторизација успешна!</h2>
            <p>Vendor конекција је успешно успостављена.</p>
            <p>Можете затворити овај прозор.</p>
            <button onclick="window.close()">Затвори прозор</button>
            <script>
              // Покушај да обавести parent прозор
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'oauth-success', 
                  connectionId: '${stateData.connectionId}' 
                }, '*');
              }
              // Аутоматски затвори после 3 секунде
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);

    } catch (error) {
      logger.error('Грешка у OAuth callback:', error);
      res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #d32f2f;">Грешка</h2>
            <p>Дошло је до грешке при обради авторизације.</p>
            <button onclick="window.close()">Затвори прозор</button>
          </body>
        </html>
      `);
    }
  }
);

/**
 * Освежава OAuth токен за конекцију
 * POST /api/vendor-integration/oauth/refresh/:connectionId
 */
router.post('/refresh/:connectionId',
  authenticate,
  authorize(['admin', 'manager']),
  validateRequest([
    param('connectionId').notEmpty().withMessage('ID конекције је обавезан')
  ]),
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;

      // Преузми конекцију и vendor систем
      const connection = await prisma.vendorConnection.findUnique({
        where: { id: connectionId },
        include: { vendorSystem: true }
      });

      if (!connection) {
        return res.status(404).json({
          success: false,
          message: 'Конекција није пронађена'
        });
      }

      // Конфигуриши OAuth параметре
      const baseConfig = connection.authConfig ? 
        encryptionService.decryptObject<any>(connection.authConfig) : {};
      
      const vendorConfig = oauthService.getVendorOAuthConfig(
        connection.vendorSystem.vendorType,
        baseConfig
      );

      const oauthConfig: OAuthConfig = {
        clientId: baseConfig.clientId || process.env[`${connection.vendorSystem.vendorType.toUpperCase()}_CLIENT_ID`] || '',
        clientSecret: baseConfig.clientSecret || process.env[`${connection.vendorSystem.vendorType.toUpperCase()}_CLIENT_SECRET`] || '',
        redirectUri: `${process.env.API_BASE_URL}/api/vendor-integration/oauth/callback`,
        authorizationUrl: vendorConfig.authorizationUrl || '',
        tokenUrl: vendorConfig.tokenUrl || connection.vendorSystem.baseUrl + '/oauth/token',
        scope: vendorConfig.scope || ['read', 'write'],
        vendorType: connection.vendorSystem.vendorType
      };

      // Освежи токен
      const newTokens = await oauthService.refreshAccessToken(connectionId, oauthConfig);

      res.json({
        success: true,
        message: 'Токен успешно освежен',
        expiresAt: newTokens.expiresAt
      });

    } catch (error) {
      logger.error('Грешка при освежавању токена:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при освежавању токена'
      });
    }
  }
);

/**
 * Тестира OAuth конекцију
 * GET /api/vendor-integration/oauth/test/:connectionId
 */
router.get('/test/:connectionId',
  authenticate,
  authorize(['admin', 'manager']),
  validateRequest([
    param('connectionId').notEmpty().withMessage('ID конекције је обавезан')
  ]),
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;

      // Преузми конекцију и vendor систем
      const connection = await prisma.vendorConnection.findUnique({
        where: { id: connectionId },
        include: { vendorSystem: true }
      });

      if (!connection) {
        return res.status(404).json({
          success: false,
          message: 'Конекција није пронађена'
        });
      }

      // Дефиниши test endpoint за различите vendor типове
      let testEndpoint = '';
      switch (connection.vendorSystem.vendorType.toLowerCase()) {
        case 'jira':
          testEndpoint = 'https://api.atlassian.com/me';
          break;
        case 'servicenow':
          testEndpoint = `${connection.vendorSystem.baseUrl}/api/now/table/sys_user/current`;
          break;
        case 'zendesk':
          testEndpoint = `${connection.vendorSystem.baseUrl}/api/v2/users/me.json`;
          break;
        case 'freshdesk':
          testEndpoint = `${connection.vendorSystem.baseUrl}/api/v2/agents/me`;
          break;
        default:
          testEndpoint = connection.endpointUrl || `${connection.vendorSystem.baseUrl}/api/user`;
      }

      // Конфигуриши OAuth параметре
      const baseConfig = connection.authConfig ? 
        encryptionService.decryptObject<any>(connection.authConfig) : {};
      
      const vendorConfig = oauthService.getVendorOAuthConfig(
        connection.vendorSystem.vendorType,
        baseConfig
      );

      const oauthConfig: OAuthConfig = {
        clientId: baseConfig.clientId || process.env[`${connection.vendorSystem.vendorType.toUpperCase()}_CLIENT_ID`] || '',
        clientSecret: baseConfig.clientSecret || process.env[`${connection.vendorSystem.vendorType.toUpperCase()}_CLIENT_SECRET`] || '',
        redirectUri: `${process.env.API_BASE_URL}/api/vendor-integration/oauth/callback`,
        authorizationUrl: vendorConfig.authorizationUrl || '',
        tokenUrl: vendorConfig.tokenUrl || connection.vendorSystem.baseUrl + '/oauth/token',
        scope: vendorConfig.scope || ['read', 'write'],
        vendorType: connection.vendorSystem.vendorType
      };

      // Тестирај конекцију
      const isValid = await oauthService.testConnection(connectionId, testEndpoint, oauthConfig);

      res.json({
        success: isValid,
        message: isValid ? 'Конекција је активна' : 'Конекција није успешна',
        connectionStatus: connection.connectionStatus,
        lastConnectedAt: connection.lastConnectedAt
      });

    } catch (error) {
      logger.error('Грешка при тестирању конекције:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при тестирању конекције'
      });
    }
  }
);

/**
 * Поништава OAuth конекцију
 * DELETE /api/vendor-integration/oauth/revoke/:connectionId
 */
router.delete('/revoke/:connectionId',
  authenticate,
  authorize(['admin']),
  validateRequest([
    param('connectionId').notEmpty().withMessage('ID конекције је обавезан')
  ]),
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;

      // Ажурирај конекцију - уклони токене и промени статус
      await prisma.vendorConnection.update({
        where: { id: connectionId },
        data: {
          authConfig: encryptionService.encryptObject({}),
          connectionStatus: 'pending',
          lastConnectedAt: null,
          errorMessage: null
        }
      });

      logger.info(`OAuth конекција поништена за конекцију ${connectionId}`);

      res.json({
        success: true,
        message: 'OAuth конекција успешно поништена'
      });

    } catch (error) {
      logger.error('Грешка при поништавању конекције:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при поништавању конекције'
      });
    }
  }
);

export default router; 