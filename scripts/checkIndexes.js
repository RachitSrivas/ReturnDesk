const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.$queryRaw`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ReturnRequest';`;
  console.log('Indexes:', rows);
  await prisma.$disconnect();
})();
