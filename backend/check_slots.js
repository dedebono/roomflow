const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const rooms = await prisma.room.findMany({
    where: { name: { contains: 'MLB' } },
    include: { rentalSlots: true }
  });
  
  rooms.forEach(r => {
    console.log(`\n${r.name}:`);
    r.rentalSlots.forEach(s => {
      const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      console.log(`  dayOfWeek=${s.dayOfWeek} (${dayNames[s.dayOfWeek]}) ${s.startTime}-${s.endTime}`);
    });
  });
  
  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
