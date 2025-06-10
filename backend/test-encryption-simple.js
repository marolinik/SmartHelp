// Простији тест за encryption сервис користећи само JavaScript
const CryptoJS = require('crypto-js');
const bcrypt = require('bcryptjs');

// Постави environment
process.env.ENCRYPTION_KEY = 'b0688e9a217101eb6a6a10698cdcb7d761cbbbf68720787edf0211643d69bcea';
process.env.NODE_ENV = 'development';

// Основна encryption логика (коприрано из TypeScript-а)
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
    
    for (const text of testTexts) {
      console.log(`Original: "${text}"`);
      
      const encrypted = encryptionService.encrypt(text);
      console.log(`Encrypted: ${encrypted.substring(0, 50)}...`);
      
      const decrypted = encryptionService.decrypt(encrypted);
      console.log(`Decrypted: "${decrypted}"`);
      
      const isMatch = text === decrypted;
      console.log(`Match: ${isMatch ? '✅ YES' : '❌ NO'}`);
      console.log('---');
      
      if (!isMatch) {
        throw new Error(`Mismatch for text: ${text}`);
      }
    }
    
    // Test лозинки
    console.log('\n🔐 Тест хеширања лозинки:');
    const passwords = ['мојаЛозинка123', 'Test123!', 'ћирилицаPass456'];
    
    for (const password of passwords) {
      console.log(`Password: "${password}"`);
      
      const hashedPassword = await encryptionService.hashPassword(password);
      console.log(`Hashed: ${hashedPassword.substring(0, 30)}...`);
      
      const isValid = await encryptionService.verifyPassword(password, hashedPassword);
      console.log(`Validation: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      // Test са погрешном лозинком
      const invalidCheck = await encryptionService.verifyPassword('wrongpassword', hashedPassword);
      console.log(`Wrong password check: ${invalidCheck ? '❌ FALSE POSITIVE' : '✅ CORRECTLY REJECTED'}`);
      console.log('---');
      
      if (!isValid || invalidCheck) {
        throw new Error(`Password test failed for: ${password}`);
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
    
    console.log('Original object:', JSON.stringify(testObject, null, 2));
    
    const encryptedObject = encryptionService.encrypt(JSON.stringify(testObject));
    console.log(`Encrypted object: ${encryptedObject.substring(0, 100)}...`);
    
    const decryptedObjectJson = encryptionService.decrypt(encryptedObject);
    const decryptedObject = JSON.parse(decryptedObjectJson);
    console.log('Decrypted object:', JSON.stringify(decryptedObject, null, 2));
    
    const objectsMatch = JSON.stringify(testObject) === JSON.stringify(decryptedObject);
    console.log(`Objects match: ${objectsMatch ? '✅ YES' : '❌ NO'}`);
    
    if (!objectsMatch) {
      throw new Error('Object encryption/decryption failed');
    }
    
    console.log('\n🎉 СВИ ТЕСТОВИ СУ ПРОШЛИ УСПЕШНО!');
    console.log('✅ AES-256 енкрипција ради исправно');
    console.log('✅ bcrypt хеширање лозинки ради исправно');
    console.log('✅ Српски карактери се правилно обрађују');
    console.log('✅ Објекти се правилно енкриптују и декриптују');
    
  } catch (error) {
    console.error('\n❌ ТЕСТ НИЈЕ ПРОШАО:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Покрени тест
testEncryption().then(() => {
  console.log('\n✨ Encryption сервис је спреман за коришћење!');
  process.exit(0);
}); 