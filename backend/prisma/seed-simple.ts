import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seedovanje jednostavne baze podataka za PIO Help Desk...');

  // Create admin role
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      displayName: 'Администратор',
      description: 'Системски администратор са свим дозволама',
      permissions: ['*'] // All permissions
    },
  });

  console.log(`✅ Администраторска улога креирана: ${adminRole.displayName}`);

  // Create default admin user (for testing without LDAP)
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@pio.gov.rs',
      firstName: 'Систем',
      lastName: 'Администратор',
      displayName: 'Систем Администратор',
      department: 'ИТ Одсек',
      roleId: adminRole.id,
      isActive: true,
    },
  });

  console.log(`✅ Администратор креиран: ${adminUser.displayName} (${adminUser.username})`);
  console.log('\n🎉 База података је успешно иницијализована!');
  console.log('\nПодразумевани admin налог:');
  console.log('   Корисничко име: admin');
  console.log('   Лозинка: admin123');
  console.log('   Email: admin@pio.gov.rs');
  console.log('   Роля: Администратор');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Грешка при seedовању базе:', e);
    await prisma.$disconnect();
    process.exit(1);
  }); 