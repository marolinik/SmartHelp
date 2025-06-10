import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface DatabaseConfig {
  url: string;
}

interface ServerConfig {
  port: number;
  nodeEnv: string;
}

interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

interface LDAPConfig {
  url: string;
  baseDN: string;
  username: string;
  password: string;
  searchFilter: string;
}

interface CorsConfig {
  origin: string | string[];
}

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  jwt: JWTConfig;
  ldap: LDAPConfig;
  cors: CorsConfig;
  email: EmailConfig;
}

// Configuration object with Serbian language support
export const config: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '5000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://pio_user:pio_password@localhost:5432/pio_helpdesk',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  
  ldap: {
    url: process.env.AD_URL || 'ldap://pio.gov.rs',
    baseDN: process.env.AD_BASE_DN || 'DC=pio,DC=gov,DC=rs',
    username: process.env.AD_USERNAME || 'service_account',
    password: process.env.AD_PASSWORD || 'service_password',
    searchFilter: '(sAMAccountName={{username}})',
  },
  
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://helpdesk.pio.gov.rs']
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  },
  
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true za 465, false za ostale portove
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'helpdesk@pio.gov.rs',
  },
};

// Serbian language messages configuration
export const messages = {
  auth: {
    loginSuccess: 'Успешно сте се пријавили',
    loginFailed: 'Неуспешна пријава. Проверите корисничко име и лозинку.',
    invalidCredentials: 'Неисправни подаци за пријаву',
    userNotFound: 'Корисник није пронађен',
    userInactive: 'Корисник није активан',
    tokenExpired: 'Сесија је истекла. Молимо пријавите се поново.',
    tokenInvalid: 'Неисправан токен за аутентификацију',
    accessDenied: 'Немате дозволу за приступ овом ресурсу',
    logoutSuccess: 'Успешно сте се одјавили',
    passwordChangeSuccess: 'Лозинка је успешно промењена',
    passwordChangeRequired: 'Потребна је промена лозинке',
  },
  
  validation: {
    required: 'Ово поље је обавезно',
    emailInvalid: 'Унесите исправну email адресу',
    passwordMinLength: 'Лозинка мора имати најмање 8 карактера',
    passwordComplexity: 'Лозинка мора садржати велико слово, мало слово и број',
    usernameMinLength: 'Корисничко име мора имати најмање 3 карактера',
    usernameInvalid: 'Корисничко име може садржати само слова, бројеве и доње црте',
  },
  
  errors: {
    serverError: 'Дошло је до грешке на серверу',
    databaseError: 'Грешка у бази података',
    ldapError: 'Грешка при повезивању са Active Directory',
    validationError: 'Грешка у валидацији података',
    notFound: 'Ресурс није пронађен',
    forbidden: 'Забрањен приступ',
    unauthorized: 'Неауторизован приступ',
  },
  
  success: {
    created: 'Успешно креирано',
    updated: 'Успешно ажурирано',
    deleted: 'Успешно обрисано',
  },
};

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Обавезна environment varijabla ${envVar} није подешена`);
    process.exit(1);
  }
}

console.log(`✅ Конфигурација учитана за ${config.server.nodeEnv} окружење`); 