// Test script за encryption сервис
const crypto = require('crypto');

// Set up environment
process.env.ENCRYPTION_KEY = 'b0688e9a217101eb6a6a10698cdcb7d761cbbbf68720787edf0211643d69bcea';
process.env.NODE_ENV = 'development';

async function testEncryption() {
  try {
    // Динамички import TypeScript модула
    const { encryptionService } = await import('./src/services/encryptionService.js');
    
    const testText = 'Тест српски текст за енкрипцију - email@example.com';
    console.log('🔒 Testing AES-256 Encryption Service');
    console.log('================================');
    console.log('Original text:', testText);
    
    // Test basic encryption/decryption
    const encrypted = encryptionService.encrypt(testText);
    console.log('Encrypted:', encrypted);
    
    const decrypted = encryptionService.decrypt(encrypted);
    console.log('Decrypted:', decrypted);
    
    const isMatch = testText === decrypted;
    console.log('Match:', isMatch ? '✅ YES' : '❌ NO');
    
    // Test object encryption
    const testObject = {
      name: 'Петар Петровић',
      email: 'petar@example.com', 
      sensitive: 'поверљиви подаци'
    };
    
    console.log('\n📦 Testing Object Encryption');
    console.log('Original object:', testObject);
    
    const encryptedObject = encryptionService.encryptObject(testObject);
    console.log('Encrypted object:', encryptedObject);
    
    const decryptedObject = encryptionService.decryptObject(encryptedObject);
    console.log('Decrypted object:', decryptedObject);
    
    // Test password hashing
    console.log('\n🔐 Testing Password Hashing');
    const password = 'мојаЛозинка123';
    const hashedPassword = await encryptionService.hashPassword(password);
    console.log('Password:', password);
    console.log('Hashed:', hashedPassword);
    
    const isPasswordValid = await encryptionService.verifyPassword(password, hashedPassword);
    console.log('Password validation:', isPasswordValid ? '✅ VALID' : '❌ INVALID');
    
    console.log('\n🎉 All encryption tests PASSED!');
    
  } catch (error) {
    console.error('❌ Encryption test FAILED:', error.message);
    console.error('Full error:', error);
  }
}

testEncryption(); 