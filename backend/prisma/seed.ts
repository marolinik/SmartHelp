import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seedovanje базе података за PIO Help Desk...');

  // Create admin role
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      displayName: 'Администратор',
      description: 'Системски администратор са свим дозволама',
      permissions: '["*"]' // All permissions as JSON string
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

  // Create default categories
  const hardwareCategory = await prisma.category.upsert({
    where: { id: 'cat-hardware' },
    update: {},
    create: {
      id: 'cat-hardware',
      name: 'Хардвер',
      description: 'Проблеми са хардвером - рачунари, штампачи, периферије',
      slaResponseHours: 4,
      slaResolutionHours: 24,
      displayOrder: 1,
    },
  });

  const softwareCategory = await prisma.category.upsert({
    where: { id: 'cat-software' },
    update: {},
    create: {
      id: 'cat-software',
      name: 'Софтвер',
      description: 'Проблеми са софтвером - апликације, оперативни систем',
      slaResponseHours: 8,
      slaResolutionHours: 48,
      displayOrder: 2,
    },
  });

  const networkCategory = await prisma.category.upsert({
    where: { id: 'cat-network' },
    update: {},
    create: {
      id: 'cat-network',
      name: 'Мрежа',
      description: 'Мрежни проблеми - интернет, email, VPN',
      slaResponseHours: 2,
      slaResolutionHours: 8,
      displayOrder: 3,
    },
  });

  const accountCategory = await prisma.category.upsert({
    where: { id: 'cat-accounts' },
    update: {},
    create: {
      id: 'cat-accounts',
      name: 'Кориснички налози',
      description: 'Проблеми са корисничким налозима и приступом',
      slaResponseHours: 4,
      slaResolutionHours: 16,
      displayOrder: 4,
    },
  });

  console.log('✅ Категорије креиране:');
  console.log(`   - ${hardwareCategory.name}`);
  console.log(`   - ${softwareCategory.name}`);
  console.log(`   - ${networkCategory.name}`);
  console.log(`   - ${accountCategory.name}`);

  // Create business hours (Serbian work schedule)
  const businessHours = [
    { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', isWorkingDay: true },  // Понедељак
    { dayOfWeek: 2, startTime: '08:00', endTime: '16:00', isWorkingDay: true },  // Уторак
    { dayOfWeek: 3, startTime: '08:00', endTime: '16:00', isWorkingDay: true },  // Среда
    { dayOfWeek: 4, startTime: '08:00', endTime: '16:00', isWorkingDay: true },  // Четвртак
    { dayOfWeek: 5, startTime: '08:00', endTime: '16:00', isWorkingDay: true },  // Петак
    { dayOfWeek: 6, startTime: '00:00', endTime: '00:00', isWorkingDay: false }, // Субота
    { dayOfWeek: 0, startTime: '00:00', endTime: '00:00', isWorkingDay: false }, // Недеља
  ];

  // Clear existing business hours and recreate
  await prisma.businessHours.deleteMany({});
  
  for (const hours of businessHours) {
    await prisma.businessHours.create({
      data: hours,
    });
  }

  console.log('✅ Радно време подешено (понедељак-петак 08:00-16:00)');

  // Create Serbian holidays for 2025
  const holidays2025 = [
    { name: 'Нова година', date: new Date('2025-01-01'), isRecurring: true, description: 'Први дан нове године' },
    { name: 'Нова година', date: new Date('2025-01-02'), isRecurring: true, description: 'Други дан нове године' },
    { name: 'Божић', date: new Date('2025-01-07'), isRecurring: true, description: 'Православни Божић' },
    { name: 'Дан државности', date: new Date('2025-02-15'), isRecurring: true, description: 'Дан државности Србије' },
    { name: 'Дан државности', date: new Date('2025-02-16'), isRecurring: true, description: 'Дан државности Србије' },
    { name: 'Велики петак', date: new Date('2025-04-18'), isRecurring: false, description: 'Православни Велики петак' },
    { name: 'Велика субота', date: new Date('2025-04-19'), isRecurring: false, description: 'Православна Велика субота' },
    { name: 'Васкрс', date: new Date('2025-04-20'), isRecurring: false, description: 'Православни Васкрс' },
    { name: 'Васкршњи понедељак', date: new Date('2025-04-21'), isRecurring: false, description: 'Православни Васкршњи понедељак' },
    { name: 'Празник рада', date: new Date('2025-05-01'), isRecurring: true, description: 'Међународни празник рада' },
    { name: 'Празник рада', date: new Date('2025-05-02'), isRecurring: true, description: 'Међународни празник рада' },
    { name: 'Дан победе', date: new Date('2025-05-09'), isRecurring: true, description: 'Дан победе над фашизмом' },
    { name: 'Видовдан', date: new Date('2025-06-28'), isRecurring: true, description: 'Видовдан - Дан српског јединства' },
  ];

  for (const holiday of holidays2025) {
    await prisma.holiday.create({
      data: holiday,
    });
  }

  console.log('✅ Српски празници за 2025. годину унесени');

  // Create default SLA policies
  const defaultSlaPolicy = await prisma.slaPolicy.upsert({
    where: { id: 'sla-default' },
    update: {},
    create: {
      id: 'sla-default',
      name: 'Подразумевана SLA политика',
      description: 'Основна SLA политика за све категорије тикета',
      responseTimeHours: 8,
      resolutionTimeHours: 48,
      escalationLevels: JSON.stringify([
        { level: 1, hoursAfterDue: 2, escalateTo: 'l2_specialist' },
        { level: 2, hoursAfterDue: 8, escalateTo: 'l3_expert' },
        { level: 3, hoursAfterDue: 24, escalateTo: 'admin' }
      ]),
      businessHoursOnly: true,
    },
  });

  const criticalSlaPolicy = await prisma.slaPolicy.upsert({
    where: { id: 'sla-critical' },
    update: {},
    create: {
      id: 'sla-critical',
      name: 'Критична SLA политика',
      description: 'Убрзана SLA политика за критичне инциденте',
      priority: 'critical',
      responseTimeHours: 1,
      resolutionTimeHours: 4,
      escalationLevels: JSON.stringify([
        { level: 1, hoursAfterDue: 0.5, escalateTo: 'l3_expert' },
        { level: 2, hoursAfterDue: 1, escalateTo: 'admin' }
      ]),
      businessHoursOnly: false, // 24/7 за критичне
    },
  });

  const networkSlaPolicy = await prisma.slaPolicy.upsert({
    where: { id: 'sla-network' },
    update: {},
    create: {
      id: 'sla-network',
      name: 'Мрежна SLA политика',
      description: 'Специјализована SLA политика за мрежне проблеме',
      categoryId: networkCategory.id,
      responseTimeHours: 2,
      resolutionTimeHours: 8,
      escalationLevels: JSON.stringify([
        { level: 1, hoursAfterDue: 1, escalateTo: 'l2_specialist' },
        { level: 2, hoursAfterDue: 4, escalateTo: 'l3_expert' }
      ]),
      businessHoursOnly: true,
    },
  });

  console.log('✅ SLA политике креиране:');
  console.log(`   - ${defaultSlaPolicy.name}`);
  console.log(`   - ${criticalSlaPolicy.name}`);
  console.log(`   - ${networkSlaPolicy.name}`);

  console.log('\n🎉 База података је успешно иницијализована!');
  console.log('\nПодразумевани admin налог:');
  console.log('   Корисничко име: admin');
  console.log('   Лозинка: admin123');
  console.log('   Email: admin@pio.gov.rs');
  console.log('   Роља: Администратор');
  console.log('\nSLA подешавања:');
  console.log('   Радно време: Понедељак-Петак 08:00-16:00 (CET)');
  console.log('   Часовна зона: Europe/Belgrade');
  console.log('   Српски празници: 13 званичних празника за 2025.');
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