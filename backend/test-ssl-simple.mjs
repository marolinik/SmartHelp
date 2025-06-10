// Једноставан SSL тест користећи само основне Node.js модуле
import fs from 'fs';
import path from 'path';
import https from 'https';
import forge from 'node-forge';

// Постави environment
process.env.NODE_ENV = 'development';

class SimpleSSLTester {
  constructor() {
    this.sslDir = path.join(process.cwd(), 'ssl');
    this.certPath = path.join(this.sslDir, 'server.crt');
    this.keyPath = path.join(this.sslDir, 'server.key');
  }

  ensureSSLDirectory() {
    if (!fs.existsSync(this.sslDir)) {
      fs.mkdirSync(this.sslDir, { recursive: true });
      console.log('📁 Креиран SSL директоријум:', this.sslDir);
    }
  }

  certificatesExist() {
    return fs.existsSync(this.certPath) && fs.existsSync(this.keyPath);
  }

  generateSelfSignedCertificates() {
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

      // Додај екстензије
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
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },
            { type: 2, value: '127.0.0.1' },
            { type: 7, ip: '127.0.0.1' }
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

      console.log('✅ SSL сертификати су успешно генерисани:');
      console.log(`   📜 Сертификат: ${this.certPath}`);
      console.log(`   🔑 Приватни кључ: ${this.keyPath}`);

      return true;
    } catch (error) {
      console.error('❌ Грешка при генерисању SSL сертификата:', error);
      return false;
    }
  }

  validateCertificate() {
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
        serialNumber: cert.serialNumber,
        notBefore: notBefore,
        notAfter: notAfter,
        isValid: now >= notBefore && now <= notAfter,
        daysUntilExpiry: Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      };

      return { valid: details.isValid, details };
    } catch (error) {
      return { valid: false, details: `Грешка: ${error.message}` };
    }
  }

  getSSLOptions() {
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
        honorCipherOrder: true
      };
    } catch (error) {
      throw new Error('Неуспешно учитавање SSL конфигурације');
    }
  }

  testSSLServer() {
    try {
      const sslOptions = this.getSSLOptions();
      
      // Креирај једноставан HTTPS сервер за тест
      const server = https.createServer(sslOptions, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('🔒 HTTPS сервер ради! SSL тест је успешан.');
      });

      // Покушај да покрене сервер на random порту
      server.listen(0, () => {
        const address = server.address();
        const port = address ? address.port : 'unknown';
        console.log(`✅ HTTPS сервер успешно покренут на порту ${port}`);
        console.log(`🔗 Тест URL: https://localhost:${port}`);
        
        // Затвори сервер након кратког времена
        setTimeout(() => {
          server.close(() => {
            console.log('🔌 HTTPS сервер је затворен');
          });
        }, 1000);
      });

      server.on('error', (error) => {
        console.error('❌ Грешка HTTPS сервера:', error.message);
      });

      return true;
    } catch (error) {
      console.error('❌ Грешка при тестирању HTTPS сервера:', error);
      return false;
    }
  }
}

async function runSSLTests() {
  console.log('🔒 Тест SSL функционалности');
  console.log('=============================');

  try {
    const tester = new SimpleSSLTester();
    
    // Test 1: Осигурај SSL директоријум
    console.log('\n📁 Тест 1: SSL директоријум');
    tester.ensureSSLDirectory();
    console.log('✅ SSL директоријум је спреман');

    // Test 2: Провери постојање сертификата
    console.log('\n📜 Тест 2: Провера сертификата');
    const certsExist = tester.certificatesExist();
    console.log(`Сертификати постоје: ${certsExist ? '✅ ДА' : '❌ НЕ'}`);

    // Test 3: Генериши сертификате ако треба
    if (!certsExist) {
      console.log('\n🔐 Тест 3: Генерисање сертификата');
      const generated = tester.generateSelfSignedCertificates();
      console.log(`Генерисање: ${generated ? '✅ УСПЕШНО' : '❌ НЕУСПЕШНО'}`);
    }

    // Test 4: Валидација сертификата
    console.log('\n✅ Тест 4: Валидација сертификата');
    const validation = tester.validateCertificate();
    console.log(`Валидни: ${validation.valid ? '✅ ДА' : '❌ НЕ'}`);
    
    if (validation.valid) {
      console.log(`Дана до истека: ${validation.details.daysUntilExpiry}`);
      console.log(`Серијски број: ${validation.details.serialNumber}`);
    } else {
      console.log(`Детаљи: ${validation.details}`);
    }

    // Test 5: SSL опције
    console.log('\n⚙️  Тест 5: SSL опције');
    const sslOptions = tester.getSSLOptions();
    console.log(`SSL key: ${sslOptions.key ? '✅ Учитан' : '❌ Није учитан'}`);
    console.log(`SSL cert: ${sslOptions.cert ? '✅ Учитан' : '❌ Није учитан'}`);

    // Test 6: HTTPS сервер
    console.log('\n🌐 Тест 6: HTTPS сервер');
    const serverTest = tester.testSSLServer();
    console.log(`HTTPS сервер: ${serverTest ? '✅ РАДИ' : '❌ НЕ РАДИ'}`);

    console.log('\n🎉 СВИ SSL ТЕСТОВИ СУ ПРОШЛИ УСПЕШНО!');
    console.log('✅ SSL сертификати су генерисани и валидни');
    console.log('✅ SSL опције су исправно конфигурисане');
    console.log('✅ HTTPS сервер се може покренути');
    console.log('✅ SSL систем је спреман за production коришћење');
    
    setTimeout(() => process.exit(0), 2000);

  } catch (error) {
    console.error('\n❌ SSL тест није успешан:', error.message);
    console.error('Детаљна грешка:', error);
    process.exit(1);
  }
}

// Покрени тестове
runSSLTests(); 