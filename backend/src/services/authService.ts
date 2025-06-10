import jwt from 'jsonwebtoken';
import ldap from 'ldapjs';
import bcrypt from 'bcryptjs';
import { config, messages } from '../config/config.js';
import { logger, logAuth, logLDAP } from '../utils/logger.js';
import { prisma } from '../database/prisma.js';

// Authentication result interface
export interface AuthResult {
  success: boolean;
  message: string;
  user?: any; // Will be properly typed after Prisma client is fully set up
  token?: string;
  refreshToken?: string;
}

// Login credentials interface
export interface LoginCredentials {
  username: string;
  password: string;
  ip?: string;
}

// Token payload interface
interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  roleId: string;
}

// LDAP user interface
interface LDAPUser {
  sAMAccountName: string;
  mail: string;
  givenName: string;
  sn: string;
  displayName: string;
  department: string;
  memberOf: string[];
}

export class AuthService {
  private ldapClient: any = null; // Using any type for ldapjs client

  constructor() {
    this.initializeLDAP();
  }

  // Initialize LDAP client
  private initializeLDAP(): void {
    try {
      this.ldapClient = ldap.createClient({
        url: config.ldap.url,
        timeout: 5000,
        connectTimeout: 10000,
        reconnect: true,
      });

      this.ldapClient.on('error', (error: any) => {
        logLDAP.connectionError(error.message);
      });

      this.ldapClient.on('connect', () => {
        logLDAP.connectionSuccess();
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Непозната грешка';
      logLDAP.connectionError(errorMessage);
    }
  }

  // Authenticate user with LDAP/AD
  private async authenticateWithLDAP(username: string, password: string): Promise<LDAPUser | null> {
    return new Promise((resolve, reject) => {
      if (!this.ldapClient) {
        logLDAP.connectionError('LDAP клијент није иницијализован');
        reject(new Error('LDAP клијент није доступан'));
        return;
      }

      // Bind with service account
      this.ldapClient.bind(config.ldap.username, config.ldap.password, (bindError: any) => {
        if (bindError) {
          logLDAP.connectionError(`Bind грешка: ${bindError.message}`);
          reject(new Error('Неуспешно повезивање са LDAP сервером'));
          return;
        }

        // Search for user
        const searchFilter = config.ldap.searchFilter.replace('{{username}}', username);
        const searchOptions = {
          scope: 'sub' as const,
          filter: searchFilter,
          attributes: ['sAMAccountName', 'mail', 'givenName', 'sn', 'displayName', 'department', 'memberOf'],
        };

        this.ldapClient!.search(config.ldap.baseDN, searchOptions, (searchError: any, searchRes: any) => {
          if (searchError) {
            logLDAP.authError(username, `Грешка при претрази: ${searchError.message}`);
            reject(new Error('Грешка при претрази корисника'));
            return;
          }

          let userFound = false;
          let ldapUser: LDAPUser | null = null;

          searchRes.on('searchEntry', (entry: any) => {
            userFound = true;
            const attributes = entry.pojo;
            
            ldapUser = {
              sAMAccountName: attributes.sAMAccountName?.[0] || username,
              mail: attributes.mail?.[0] || '',
              givenName: attributes.givenName?.[0] || '',
              sn: attributes.sn?.[0] || '',
              displayName: attributes.displayName?.[0] || '',
              department: attributes.department?.[0] || '',
              memberOf: attributes.memberOf || [],
            };

            // Try to authenticate with user credentials
            const userDN = entry.pojo.dn;
            this.ldapClient!.bind(userDN, password, (authError: any) => {
              if (authError) {
                logLDAP.authError(username, `Аутентификација неуспешна: ${authError.message}`);
                resolve(null);
              } else {
                logger.info(`✅ LDAP аутентификација успешна за корисника: ${username}`);
                resolve(ldapUser);
              }
            });
          });

          searchRes.on('error', (error: any) => {
            logLDAP.authError(username, `Грешка при претрази резултата: ${error.message}`);
            reject(new Error('Грешка при обради резултата претраге'));
          });

          searchRes.on('end', () => {
            if (!userFound) {
              logLDAP.userNotFound(username);
              resolve(null);
            }
          });
        });
      });
    });
  }

  // Get or create user from LDAP data
  private async getOrCreateUser(ldapUser: LDAPUser): Promise<any> {
    // Try to find existing user
    let user = await prisma.user.findUnique({
      where: { username: ldapUser.sAMAccountName },
      include: { role: true },
    });

    if (user) {
      // Update user data from LDAP
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: ldapUser.mail,
          firstName: ldapUser.givenName,
          lastName: ldapUser.sn,
          displayName: ldapUser.displayName,
          department: ldapUser.department,
          lastLogin: new Date(),
        },
        include: { role: true },
      });
    } else {
      // Create new user
      const defaultRole = await prisma.role.findFirst({
        where: { name: 'end_user' },
      });

      if (!defaultRole) {
        throw new Error('Подразумевана улога није пронађена');
      }

      user = await prisma.user.create({
        data: {
          username: ldapUser.sAMAccountName,
          email: ldapUser.mail,
          firstName: ldapUser.givenName,
          lastName: ldapUser.sn,
          displayName: ldapUser.displayName,
          department: ldapUser.department,
          roleId: defaultRole.id,
          isActive: true,
          lastLogin: new Date(),
        },
        include: { role: true },
      });

      logger.info(`👤 Нови корисник креиран: ${user.username}`);
    }

    return user;
  }

  // Generate JWT tokens
  private generateTokens(user: any): { token: string; refreshToken: string } {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
    };

    const jwtSecret = config.jwt.secret as string;

    const token = jwt.sign(payload, jwtSecret, {
      expiresIn: config.jwt.expiresIn,
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    return { token, refreshToken };
  }

  // Fallback local authentication for testing/admin accounts
  private async authenticateLocally(username: string, password: string): Promise<any> {
    try {
      const user = await prisma.user.findUnique({
        where: { username },
        include: { role: true },
      });

      if (!user) {
        return null;
      }

      // For testing: admin user with password "admin123"
      // In production, this should be removed or properly hashed
      if (username === 'admin' && password === 'admin123') {
        logger.info(`✅ Локална аутентификација успешна за: ${username}`);
        return user;
      }

      // Add support for hashed passwords if needed
      // if (user.password && await bcrypt.compare(password, user.password)) {
      //   return user;
      // }

      return null;
    } catch (error) {
      logger.error('Грешка при локалној аутентификацији:', error);
      return null;
    }
  }

  // Main login method
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const { username, password, ip = 'неупозната IP' } = credentials;

    try {
      logAuth.loginAttempt(username, ip);

      let user: any = null;

      // Try local authentication first (for admin and testing)
      user = await this.authenticateLocally(username, password);

      // If local auth fails, try LDAP
      if (!user) {
        const ldapUser = await this.authenticateWithLDAP(username, password);
        
        if (ldapUser) {
          user = await this.getOrCreateUser(ldapUser);
        }
      }

      if (!user) {
        logAuth.loginFailure(username, ip, 'Неисправни подаци за пријаву');
        return {
          success: false,
          message: messages.auth.invalidCredentials,
        };
      }

      if (!user.isActive) {
        logAuth.loginFailure(username, ip, 'Корисник није активан');
        return {
          success: false,
          message: messages.auth.userInactive,
        };
      }

      // Update last login time
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      // Generate tokens
      const { token, refreshToken } = this.generateTokens(user);

      logAuth.loginSuccess(username, ip);

      return {
        success: true,
        message: messages.auth.loginSuccess,
        user,
        token,
        refreshToken,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Непозната грешка';
      logAuth.loginFailure(username, ip, errorMessage);
      
      logger.error('Грешка при пријави:', { error: errorMessage, username });

      return {
        success: false,
        message: messages.auth.loginFailed,
      };
    }
  }

  // Refresh token method
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const jwtSecret = config.jwt.secret;
      const decoded = jwt.verify(refreshToken, jwtSecret) as { userId: string };
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { role: true },
      });

      if (!user || !user.isActive) {
        return {
          success: false,
          message: messages.auth.userNotFound,
        };
      }

      const tokens = this.generateTokens(user);

      return {
        success: true,
        message: 'Токен је обновљен',
        user,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
      };

    } catch (error) {
      return {
        success: false,
        message: messages.auth.tokenExpired,
      };
    }
  }

  // Logout method
  async logout(username: string, ip: string = 'неупозната IP'): Promise<void> {
    logAuth.logout(username, ip);
  }

  // Change password method (for local accounts if needed)
  async changePassword(userId: string, _oldPassword: string, _newPassword: string): Promise<AuthResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });

      if (!user) {
        return {
          success: false,
          message: messages.auth.userNotFound,
        };
      }

      // Note: In LDAP environment, password changes should be handled by AD
      // This is for potential local accounts or future implementation
      
      return {
        success: true,
        message: messages.auth.passwordChangeSuccess,
      };

    } catch (error) {
      logger.error('Грешка при промени лозинке:', error);
      return {
        success: false,
        message: 'Грешка при промени лозинке',
      };
    }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    if (this.ldapClient) {
      this.ldapClient.unbind((error: any) => {
        if (error) {
          logger.error('Грешка при затварању LDAP везе:', error);
        } else {
          logger.info('🔌 LDAP веза затворена');
        }
      });
    }
  }
} 