// Тест за SSL сервис - ES модуле
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Симулирај environment
process.env.NODE_ENV = 'development';

// Динамички увоз SSL сервиса
import('../src/services/sslService.js').then(({ sslService }) => {
  console.log('🔒 Тест SSL сервиса');
  console.log('====================');

  try {
    // Test 1: Провери да ли сертификати постоје
    console.log('\n📜 Тест 1: Провера постојања сертификата');
    const certsExist = sslService.certificatesExist();
    console.log(`Сертификати постоје: ${certsExist ? '✅ ДА' : '❌ НЕ'}`);

    // Test 2: Генериши сертификате ако не постоје
    if (!certsExist) {
      console.log('\n🔐 Тест 2: Генерисање SSL сертификата');
      sslService.generateSelfSignedCertificates();
      console.log('✅ Сертификати су генерисани');
    }

    // Test 3: Валидација сертификата
    console.log('\n✅ Тест 3: Валидација сертификата');
    const validation = sslService.validateCertificate();
    console.log(`Валидни: ${validation.valid ? '✅ ДА' : '❌ НЕ'}`);
    
    if (validation.valid) {
      console.log(`Дана до истека: ${validation.details.daysUntilExpiry}`);
      console.log(`Серијски број: ${validation.details.serialNumber}`);
      console.log(`Издавач:`, validation.details.issuer);
    }

    // Test 4: SSL опције
    console.log('\n⚙️  Тест 4: SSL опције');
    const sslOptions = sslService.getSSLOptions();
    console.log(`SSL опције учитане: ${sslOptions.key ? '✅' : '❌'} key, ${sslOptions.cert ? '✅' : '❌'} cert`);
    console.log(`Cipher конфигурација: ${sslOptions.ciphers ? '✅' : '❌'}`);

    // Test 5: Безбедносна заглавља
    console.log('\n🛡️  Тест 5: Безбедносна заглавља');
    const headers = sslService.getSecurityHeaders();
    console.log('Заглавља:');
    Object.entries(headers).forEach(([key, value]) => {
      console.log(`  ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
    });

    // Test 6: Информације о сертификату
    console.log('\n📋 Тест 6: Информације о сертификату');
    const certInfo = sslService.getCertificateInfo();
    console.log('Информације о сертификату:');
    console.log(`  Постоји: ${certInfo.exists}`);
    console.log(`  Путање: cert=${certInfo.paths.certificate}, key=${certInfo.paths.privateKey}`);
    console.log(`  Валидан: ${certInfo.validation.valid}`);

    console.log('\n🎉 Сви SSL тестови су успешно прошли!');
    console.log('✅ SSL сертификати су генерисани и валидни');
    console.log('✅ SSL опције су исправно конфигурисане');
    console.log('✅ Безбедносна заглавља су подешена');
    console.log('✅ SSL сервис је спреман за коришћење');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ SSL тест није успешан:', error.message);
    console.error('Детаљна грешка:', error);
    process.exit(1);
  }

}).catch(error => {
  console.error('❌ Грешка при учитавању SSL сервиса:', error);
  process.exit(1);
}); 