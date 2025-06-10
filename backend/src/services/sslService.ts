import fs from 'fs';
import path from 'path';
import https from 'https';
import forge from 'node-forge';

/**
 * Сервис за управљање SSL/TLS сертификатима и конфигурацијом
 * Генерише self-signed сертификате за development и управља SSL подешавањима
 */
class SSLService {
  private readonly certPath: string;
  private readonly keyPath: string;
  private readonly sslDir: string;

  constructor() {
    this.sslDir = path.join(process.cwd(), 'ssl');
    this.certPath = path.join(this.sslDir, 'server.crt');
    this.keyPath = path.join(this.sslDir, 'server.key');
    
    // Креирај SSL директоријум ако не постоји
    this.ensureSSLDirectory();
  }

  /**
   * Осигурава да SSL директоријум постоји
   */
  private ensureSSLDirectory(): void {
    if (!fs.existsSync(this.sslDir)) {
      fs.mkdirSync(this.sslDir, { recursive: true });
      console.log('📁 Креиран SSL директоријум:', this.sslDir);
    }
  }

  /**
   * Проверава да ли SSL сертификати постоје
   */
  certificatesExist(): boolean {
    return fs.existsSync(this.certPath) && fs.existsSync(this.keyPath);
  }

  /**
   * Генерише self-signed SSL сертификате за development
   */
  generateSelfSignedCertificates(): void {
    try {
      console.log('🔐 Генерисање self-signed SSL сертификата...');

      // Креирај RSA кључ пар
      const keys = forge.pki.rsa.generateKeyPair(2048);
      
      // Креирај сертификат
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

      // Подеси subject и issuer
      const attrs = [
        { name: 'countryName', value: 'RS' },
        { name: 'stateOrProvinceName', value: 'Београд' },
        { name: 'localityName', value: 'Београд' },
        { name: 'organizationName', value: 'Smart Help Desk PIO' },
        { name: 'organizationalUnitName', value: 'IT Подршка' },
        { name: 'commonName', value: 'localhost' }
      ];
      
      cert.setSubject(attrs);
      cert.setIssuer(attrs);

      // Додај SAN (Subject Alternative Names) за различите начине приступа
      cert.setExtensions([
        {
          name: 'basicConstraints',
          cA: true
        },
        {
          name: 'keyUsage',
          keyCertSign: true,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true
        },
        {
          name: 'extKeyUsage',
          serverAuth: true,
          clientAuth: true,
          codeSigning: true,
          emailProtection: true,
          timeStamping: true
        },
        {
          name: 'nsCertType',
          client: true,
          server: true,
          email: true,
          objsign: true,
          sslCA: true,
          emailCA: true,
          objCA: true
        },
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },
            { type: 2, value: '127.0.0.1' },
            { type: 2, value: '::1' },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: '::1' }
          ]
        }
      ]);

      // Потпиши сертификат
      cert.sign(keys.privateKey);

      // Конвертуј у PEM формат
      const certPem = forge.pki.certificateToPem(cert);
      const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

      // Сачувај сертификате
      fs.writeFileSync(this.certPath, certPem);
      fs.writeFileSync(this.keyPath, keyPem);

      // Подеси дозволе (само на Unix системима)
      if (process.platform !== 'win32') {
        fs.chmodSync(this.keyPath, 0o600);
        fs.chmodSync(this.certPath, 0o644);
      }

      console.log('✅ SSL сертификати су успешно генерисани:');
      console.log(`   📜 Сертификат: ${this.certPath}`);
      console.log(`   🔑 Приватни кључ: ${this.keyPath}`);
      console.log('⚠️  НАПОМЕНА: Ово су self-signed сертификати за development. Не користите у production!');

    } catch (error) {
      console.error('❌ Грешка при генерисању SSL сертификата:', error);
      throw new Error('Неуспешно генерисање SSL сертификата');
    }
  }

  /**
   * Учитава SSL опције за HTTPS сервер
   */
  getSSLOptions(): https.ServerOptions {
    try {
      if (!this.certificatesExist()) {
        console.log('🔐 SSL сертификати не постоје, генерисање нових...');
        this.generateSelfSignedCertificates();
      }

      const key = fs.readFileSync(this.keyPath, 'utf8');
      const cert = fs.readFileSync(this.certPath, 'utf8');

      return {
        key: key,
        cert: cert,
        // Додатне SSL/TLS безбедносне опције
        honorCipherOrder: true,
        secureProtocol: 'TLSv1_2_method',
        ciphers: [
          'ECDHE-RSA-AES128-GCM-SHA256',
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES128-SHA256',
          'ECDHE-RSA-AES256-SHA384'
        ].join(':'),
        ecdhCurve: 'secp384r1'
      };

    } catch (error) {
      console.error('❌ Грешка при учитавању SSL опција:', error);
      throw new Error('Неуспешно учитавање SSL конфигурације');
    }
  }

  /**
   * Валидира SSL сертификат
   */
  validateCertificate(): { valid: boolean; details: any } {
    try {
      if (!this.certificatesExist()) {
        return { valid: false, details: 'Сертификати не постоје' };
      }

      const certPem = fs.readFileSync(this.certPath, 'utf8');
      const cert = forge.pki.certificateFromPem(certPem);

      const now = new Date();
      const notBefore = cert.validity.notBefore;
      const notAfter = cert.validity.notAfter;

      const details = {
        subject: cert.subject.attributes.reduce((acc: any, attr: any) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {}),
        issuer: cert.issuer.attributes.reduce((acc: any, attr: any) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {}),
        serialNumber: cert.serialNumber,
        notBefore: notBefore,
        notAfter: notAfter,
        isValid: now >= notBefore && now <= notAfter,
        daysUntilExpiry: Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      };

      return { valid: details.isValid, details };

    } catch (error) {
      console.error('❌ Грешка при валидацији сертификата:', error);
      return { valid: false, details: `Грешка: ${error}` };
    }
  }

  /**
   * Добија информације о SSL сертификату
   */
  getCertificateInfo(): any {
    const validation = this.validateCertificate();
    return {
      exists: this.certificatesExist(),
      paths: {
        certificate: this.certPath,
        privateKey: this.keyPath
      },
      validation: validation
    };
  }

  /**
   * Обнавља SSL сертификате (генерише нове)
   */
  renewCertificates(): void {
    try {
      console.log('🔄 Обнављање SSL сертификата...');
      
      // Обриши стаaре сертификате ако постоје
      if (fs.existsSync(this.certPath)) {
        fs.unlinkSync(this.certPath);
      }
      if (fs.existsSync(this.keyPath)) {
        fs.unlinkSync(this.keyPath);
      }

      // Генериши нове
      this.generateSelfSignedCertificates();
      
      console.log('✅ SSL сертификати су успешно обновљени');
      
    } catch (error) {
      console.error('❌ Грешка при обнављању сертификата:', error);
      throw new Error('Неуспешно обнављање SSL сертификата');
    }
  }

  /**
   * Креирај HTTPS сервер са SSL опцијама
   */
  createHTTPSServer(app: any): https.Server {
    try {
      const sslOptions = this.getSSLOptions();
      const httpsServer = https.createServer(sslOptions, app);
      
      console.log('🔒 HTTPS сервер је конфигурисан са SSL сертификатима');
      return httpsServer;
      
    } catch (error) {
      console.error('❌ Грешка при креирању HTTPS сервера:', error);
      throw new Error('Неуспешно креирање HTTPS сервера');
    }
  }

  /**
   * Добија препоручена SSL заглавља за безбедност
   */
  getSecurityHeaders(): Record<string, string> {
    return {
      // HSTS - принуђава HTTPS на future requests
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      
      // Спречава MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      
      // XSS заштита
      'X-XSS-Protection': '1; mode=block',
      
      // Clickjacking заштита
      'X-Frame-Options': 'DENY',
      
      // Referrer policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // Content Security Policy основна
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss: https:",
      
      // Permissions Policy
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    };
  }
}

// Експортуј singleton инстанцу
export const sslService = new SSLService();
export default sslService; 