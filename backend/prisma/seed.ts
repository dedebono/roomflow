import { PrismaClient, Role, RoomStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Users
  const adminIt = await prisma.user.upsert({
    where: { email: 'admin@roomflow.local' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@roomflow.local',
      passwordHash,
      role: Role.ADMIN_IT,
    },
  });

  const roomAdmin = await prisma.user.upsert({
    where: { email: 'manager@roomflow.local' },
    update: {},
    create: {
      name: 'Room Manager',
      email: 'manager@roomflow.local',
      passwordHash,
      role: Role.ROOM_ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@roomflow.local' },
    update: {},
    create: {
      name: 'Regular User',
      email: 'user@roomflow.local',
      passwordHash,
      role: Role.USER,
    },
  });

  const renter = await prisma.user.upsert({
    where: { email: 'jack@mail.com' },
    update: {},
    create: {
      name: 'Jack Renter',
      email: 'jack@mail.com',
      passwordHash,
      role: Role.RENTER,
    },
  });

  console.log('Users created');

  // Buildings
  const b1 = await prisma.building.create({ data: { name: 'Building A' } });
  const b2 = await prisma.building.create({ data: { name: 'Building B' } });

  console.log('Buildings created');

  // Rooms
  const rooms = [
    { buildingId: b1.id, name: 'Conference Room 101', capacity: 10, status: RoomStatus.ACTIVE },
    { buildingId: b1.id, name: 'Meeting Room 102', capacity: 5, status: RoomStatus.ACTIVE },
    { buildingId: b2.id, name: 'Large Hall 201', capacity: 50, status: RoomStatus.ACTIVE },
    { buildingId: b2.id, name: 'Workstation Area', capacity: 20, status: RoomStatus.MAINTENANCE },
  ];

  for (const room of rooms) {
    await prisma.room.create({ data: room });
  }

  console.log('Rooms created');

  // Payment Gateways
  await prisma.paymentGateway.upsert({
    where: { name: 'Pakasir' },
    update: {},
    create: {
      name: 'Pakasir',
      logo: null,
      config: {},
      enabled: false, // Admin must enable after configuring API key
    },
  });

  await prisma.paymentGateway.upsert({
    where: { name: 'Manual Transfer' },
    update: {},
    create: {
      name: 'Manual Transfer',
      logo: null,
      config: {},
      enabled: true, // Always available as fallback
    },
  });

  console.log('Payment gateways created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
