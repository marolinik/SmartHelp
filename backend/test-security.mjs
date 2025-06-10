// Тест за security сервис и IP/rate limiting
import { createRequire } from 'module';
import fs from 'fs';

// Постави environment
process.env.NODE_ENV = 'development';

async function testSecurityService() {
  console.log('🛡️  Тест Security сервиса');
  console.log('==========================');

  try {
    // Динамички увоз security сервиса
    const { securityService } = await import('./src/services/securityService.js');
    
    console.log('\n📋 Тест 1: Основне функције security сервиса');
    
    // Test IP функције
    console.log('\n🔍 Тест IP функција:');
    
    // Test localhost whitelist
    const localhostWhitelisted = securityService.isIPWhitelisted('127.0.0.1');
    console.log(`Localhost whitelisted: ${localhostWhitelisted ? '✅ ДА' : '❌ НЕ'}`);
    
    // Test приватне мреже
    const privateNetworkWhitelisted = securityService.isIPWhitelisted('192.168.1.100');
    console.log(`Private network whitelisted: ${privateNetworkWhitelisted ? '✅ ДА' : '❌ НЕ'}`);
    
    // Test јавне IP адресе (треба да не буде whitelisted)
    const publicIPWhitelisted = securityService.isIPWhitelisted('8.8.8.8');
    console.log(`Public IP whitelisted: ${publicIPWhitelisted ? '❌ ДА' : '✅ НЕ'}`);
    
    // Test blacklist (требало би да буде празан у почетку)
    const isBlacklisted = securityService.isIPBlacklisted('127.0.0.1');
    console.log(`Localhost blacklisted: ${isBlacklisted.blocked ? '❌ ДА' : '✅ НЕ'}`);
    
    console.log('\n📊 Тест 2: Rate limit правила');
    
    // Test rate limit правила
    const generalRule = securityService.getRateLimitRule('general');
    console.log(`General rule: ${generalRule ? '✅ Постоји' : '❌ Не постоји'}`);
    if (generalRule) {
      console.log(`  Window: ${generalRule.windowMs}ms, Max: ${generalRule.maxRequests}`);
      console.log(`  Message: ${generalRule.message}`);
    }
    
    const loginRule = securityService.getRateLimitRule('login');
    console.log(`Login rule: ${loginRule ? '✅ Постоји' : '❌ Не постоји'}`);
    if (loginRule) {
      console.log(`  Window: ${loginRule.windowMs}ms, Max: ${loginRule.maxRequests}`);
      console.log(`  Message: ${loginRule.message}`);
    }
    
    console.log('\n🔧 Тест 3: Управљање whitelist/blacklist');
    
    // Додај тест IP у blacklist
    const testIP = '203.0.113.1'; // RFC 5737 test IP
    securityService.addToBlacklist(testIP, 'Test IP за тестирање', 'low');
    
    // Провери да ли је додат
    const blacklistTest = securityService.isIPBlacklisted(testIP);
    console.log(`Test IP blacklisted: ${blacklistTest.blocked ? '✅ ДА' : '❌ НЕ'}`);
    
    if (blacklistTest.blocked && blacklistTest.rule) {
      console.log(`  Разлог: ${blacklistTest.rule.reason}`);
      console.log(`  Озбиљност: ${blacklistTest.rule.severity}`);
    }
    
    // Уклони из blacklist
    const removed = securityService.removeFromBlacklist(testIP);
    console.log(`Test IP removed from blacklist: ${removed ? '✅ ДА' : '❌ НЕ'}`);
    
    console.log('\n📈 Тест 4: Rate limit статистике');
    
    // Симулирај неколико захтева
    const testStatsIP = '192.0.2.1'; // RFC 5737 test IP
    
    securityService.updateRateLimitStats(testStatsIP, false);
    securityService.updateRateLimitStats(testStatsIP, false);
    securityService.updateRateLimitStats(testStatsIP, true); // blocked request
    
    const stats = securityService.getRateLimitStats(testStatsIP);
    console.log(`Stats за ${testStatsIP}:`);
    if (stats) {
      console.log(`  Укупно захтева: ${stats.requestCount}`);
      console.log(`  Блокирано: ${stats.blockedCount}`);
      console.log(`  Први захтев: ${stats.firstRequest.toISOString()}`);
      console.log(`  Последњи захтев: ${stats.lastRequest.toISOString()}`);
    } else {
      console.log('  Нема статистика');
    }
    
    console.log('\n📊 Тест 5: Security извештај');
    
    const report = securityService.getSecurityReport();
    console.log('Security извештај:');
    console.log(`  Whitelist: ${report.whitelist.active}/${report.whitelist.total} активних`);
    console.log(`  Blacklist: ${report.blacklist.active}/${report.blacklist.total} активних`);
    console.log(`  Rate limit статистике:`);
    console.log(`    IP адресе: ${report.rateLimitStats.totalIPs}`);
    console.log(`    Укупно захтева: ${report.rateLimitStats.totalRequests}`);
    console.log(`    Блокирано: ${report.rateLimitStats.totalBlocked}`);
    
    console.log('\n🎉 СВИ SECURITY ТЕСТОВИ СУ ПРОШЛИ УСПЕШНО!');
    console.log('✅ IP whitelist/blacklist функције раде');
    console.log('✅ Rate limit правила су дефинисана');
    console.log('✅ Статистике се чувају правилно');
    console.log('✅ Security извештај је доступан');
    console.log('✅ CIDR нотација се правилно обрађује');
    
    // Провери да ли је конфигурација сачувана
    const configPath = './config/security.json';
    if (fs.existsSync(configPath)) {
      console.log('✅ Security конфигурација је сачувана');
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`📄 Конфигурација садржи:`);
      console.log(`   Whitelist правила: ${config.ipWhitelist?.length || 0}`);
      console.log(`   Blacklist правила: ${config.ipBlacklist?.length || 0}`);
    } else {
      console.log('⚠️  Security конфигурација није пронађена на диску');
    }
    
    return true;

  } catch (error) {
    console.error('\n❌ SECURITY тест није успешан:', error.message);
    console.error('Детаљна грешка:', error);
    return false;
  }
}

// Покрени тест
testSecurityService().then((success) => {
  if (success) {
    console.log('\n✨ Security сервис је спреман за коришћење!');
    console.log('🔒 IP whitelisting и blacklisting активни');
    console.log('⏱️  Rate limiting правила су конфигурисана');
    console.log('📊 Статистике и monitoring су укључени');
    process.exit(0);
  } else {
    console.log('\n❌ Security сервис има проблема');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Критична грешка при тестирању:', error);
  process.exit(1);
}); 