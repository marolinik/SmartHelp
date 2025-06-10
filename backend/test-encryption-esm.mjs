// Тест за encryption сервис користећи ES модуле
import CryptoJS from 'crypto-js';
import bcrypt from 'bcryptjs';

// Постави environment
process.env.ENCRYPTION_KEY = 'b0688e9a217101eb6a6a10698cdcb7d761cbbbf68720787edf0211643d69bcea';
process.env.NODE_ENV = 'development';

// Основна encryption логика
class SimpleEncryptionService {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY;
  }

  encrypt(plainText) {
    try {
      const encrypted = CryptoJS.AES.encrypt(plainText, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      throw new Error('Неуспешна енкрипција података');
    }
  }

  decrypt(encryptedText) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
      const plainText = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!plainText) {
        throw new Error('Декрипција није успешна');
      }
      return plainText;
    } catch (error) {
      throw new Error('Неуспешна декрипција података');
    }
  }

  async hashPassword(password, saltRounds = 12) {
    try {
      const hash = await bcrypt.hash(password, saltRounds);
      return hash;
    } catch (error) {
      throw new Error('Неуспешно хешовање лозинке');
    }
  }

  async verifyPassword(password, hash) {
    try {
      const isValid = await bcrypt.compare(password, hash);
      return isValid;
    } catch (error) {
      return false;
    }
  }
}

async function testEncryption() {
  console.log('🔒 Тест AES-256 Encryption сервиса');
  console.log('======================================');
  
  try {
    const encryptionService = new SimpleEncryptionService();
    
    // Test основне енкрипције
    console.log('\n📝 Тест основне енкрипције:');
    const testTexts = [
      'Тест српски текст',
      'email@example.com',
      'Поверљиви подаци 123',
      'Марковић, Петар - лични број: 1234567890123'
    ];
    
    let allPassed = true;
    
    for (const text of testTexts) {
      console.log(`Оригинал: "${text}"`);
      
      const encrypted = encryptionService.encrypt(text);
      console.log(`Енкриптовано: ${encrypted.substring(0, 50)}...`);
      
      const decrypted = encryptionService.decrypt(encrypted);
      console.log(`Декриптовано: "${decrypted}"`);
      
      const isMatch = text === decrypted;
      console.log(`Поклапање: ${isMatch ? '✅ ДА' : '❌ НЕ'}`);
      console.log('---');
      
      if (!isMatch) {
        allPassed = false;
        console.error(`❌ Неподударање за текст: ${text}`);
      }
    }
    
    // Test лозинки
    console.log('\n🔐 Тест хеширања лозинки:');
    const passwords = ['мојаЛозинка123', 'Test123!', 'ћирилицаPass456'];
    
    for (const password of passwords) {
      console.log(`Лозинка: "${password}"`);
      
      const hashedPassword = await encryptionService.hashPassword(password);
      console.log(`Хеш: ${hashedPassword.substring(0, 30)}...`);
      
      const isValid = await encryptionService.verifyPassword(password, hashedPassword);
      console.log(`Валидација: ${isValid ? '✅ ВАЛИДНА' : '❌ НИЈЕ ВАЛИДНА'}`);
      
      // Test са погрешном лозинком
      const invalidCheck = await encryptionService.verifyPassword('wrongpassword', hashedPassword);
      console.log(`Провера погрешне лозинке: ${invalidCheck ? '❌ ЛАЖНО ПОЗИТИВНА' : '✅ ПРАВИЛНО ОДБАЧЕНА'}`);
      console.log('---');
      
      if (!isValid || invalidCheck) {
        allPassed = false;
        console.error(`❌ Тест лозинке није прошао за: ${password}`);
      }
    }
    
    // Test објеката
    console.log('\n📦 Тест енкрипције објеката:');
    const testObject = {
      firstName: 'Петар',
      lastName: 'Петровић', 
      email: 'petar@example.com',
      phoneNumber: '+381641234567',
      address: 'Светосавска 10, Београд'
    };
    
    console.log('Оригинални објекат:', JSON.stringify(testObject, null, 2));
    
    const encryptedObject = encryptionService.encrypt(JSON.stringify(testObject));
    console.log(`Енкриптовани објекат: ${encryptedObject.substring(0, 100)}...`);
    
    const decryptedObjectJson = encryptionService.decrypt(encryptedObject);
    const decryptedObject = JSON.parse(decryptedObjectJson);
    console.log('Декриптовани објекат:', JSON.stringify(decryptedObject, null, 2));
    
    const objectsMatch = JSON.stringify(testObject) === JSON.stringify(decryptedObject);
    console.log(`Објекти се поклапају: ${objectsMatch ? '✅ ДА' : '❌ НЕ'}`);
    
    if (!objectsMatch) {
      allPassed = false;
      console.error('❌ Енкрипција/декрипција објеката није успешна');
    }
    
    if (allPassed) {
      console.log('\n🎉 СВИ ТЕСТОВИ СУ ПРОШЛИ УСПЕШНО!');
      console.log('✅ AES-256 енкрипција ради исправно');
      console.log('✅ bcrypt хеширање лозинки ради исправно');
      console.log('✅ Српски карактери се правилно обрађују');
      console.log('✅ Објекти се правилно енкриптују и декриптују');
      return true;
    } else {
      throw new Error('Неки тестови нису прошли');
    }
    
  } catch (error) {
    console.error('\n❌ ТЕСТ НИЈЕ ПРОШАО:', error.message);
    throw error;
  }
}

// Покрени тест
testEncryption().then(() => {
  console.log('\n✨ Encryption сервис је спреман за коришћење!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Критична грешка:', error);
  process.exit(1);
}); 