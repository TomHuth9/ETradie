// Simple seed script to create a few demo users and jobs.
// This makes it easier to test the app without manually registering accounts.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SEED_PASSWORD = 'Password123!';

async function main() {
  await prisma.jobResponse.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // These coordinates are hard-coded so the script does not depend on the
  // OpenCage API. They roughly correspond to central locations in the UK.

  // Homeowner in Glasgow.
  const homeowner = await prisma.user.create({
    data: {
      name: 'Grace Homeowner',
      email: 'homeowner@example.com',
      passwordHash,
      role: 'HOMEOWNER',
      address: '1 George Square, Glasgow, G2 1AL',
      lat: 55.860916,
      lng: -4.251433,
    },
  });

  // Tradesperson in Glasgow (close enough to receive jobs).
  const tradesperson = await prisma.user.create({
    data: {
      name: 'Tom Tradesperson',
      email: 'tradesperson@example.com',
      passwordHash,
      role: 'TRADESPERSON',
      townOrCity: 'Glasgow',
      lat: 55.8642,
      lng: -4.2518,
    },
  });

  // Pending job near both users.
  const job = await prisma.job.create({
    data: {
      title: 'Fix leaking radiator',
      description:
        'Radiator in the living room is leaking slightly from the valve. Needs inspection and repair.',
      category: 'PLUMBING',
      status: 'PENDING',
      locationText: homeowner.address,
      lat: homeowner.lat,
      lng: homeowner.lng,
      homeowner: {
        connect: { id: homeowner.id },
      },
    },
  });

  console.log('Seed complete.');
  console.log(`Homeowner login: homeowner@example.com / ${SEED_PASSWORD}`);
  console.log(`Tradesperson login: tradesperson@example.com / ${SEED_PASSWORD}`);
  console.log('Seeded job id:', job.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

