const pkg = require('./node_modules/@prisma/client');
const PrismaClient = pkg.Prisma.PrismaClient;
const p = new PrismaClient();
p.rentalRoom.findFirst({ where: { name: { contains: 'MLB' } } })
  .then(r => {
    if (!r) { console.log('No MLB room found'); p.$disconnect(); return; }
    console.log('Room:', r.name, '| ID:', r.id);
    return p.rentalSlot.findMany({ where: { roomId: r.id } })
      .then(s => {
        const days = s.map(x => x.dayOfWeek);
        const unique = [...new Set(days)].sort((a,b)=>a-b);
        console.log('All slot dayOfWeek values:', days.sort((a,b)=>a-b));
        console.log('Unique:', unique);
        console.log('As day names:', unique.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]));
        p.$disconnect();
      });
  });