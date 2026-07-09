const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const room = await prisma.room.findFirst({
    where: { name: { contains: 'MLB' } },
    include: { rentalSlots: true }
  });
  
  if (!room) {
    console.log('MLB Hall not found');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`Found room: ${room.name}`);
  
  if (room.rentalSlots.length === 0) {
    console.log('No slots found, creating Thu-Fri slots...');
    await prisma.rentalSlot.createMany({
      data: [
        { roomId: room.id, dayOfWeek: 4, startTime: '09:00', endTime: '17:00', price: 500000 },
        { roomId: room.id, dayOfWeek: 5, startTime: '09:00', endTime: '17:00', price: 500000 }
      ]
    });
  } else {
    console.log('Current slots:');
    room.rentalSlots.forEach(s => {
      const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      console.log(`  dayOfWeek=${s.dayOfWeek} (${dayNames[s.dayOfWeek]})`);
    });
    
    // Update dayOfWeek to correct values
    await Promise.all(room.rentalSlots.map((s, i) => {
      const newDay = i === 0 ? 4 : 5; // Thu, Fri
      return prisma.rentalSlot.update({
        where: { id: s.id },
        data: { dayOfWeek: newDay }
      });
    }));
  }
  
  const updated = await prisma.room.findFirst({
    where: { name: { contains: 'MLB' } },
    include: { rentalSlots: true }
  });
  
  console.log('\nUpdated slots:');
  updated.rentalSlots.forEach(s => {
    const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    console.log(`  dayOfWeek=${s.dayOfWeek} (${dayNames[s.dayOfWeek]})`);
  });
  
  await prisma.$disconnect();
}

fix().catch(e => { console.error(e); process.exit(1); });
