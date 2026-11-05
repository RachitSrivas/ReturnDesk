const { PrismaClient, ReturnStatus, ReturnReason, ResolutionType } = require('@prisma/client');

const prisma = new PrismaClient();

function generateReference(index) {
  return `RET-${(100000 + index).toString().padStart(6, '0')}`;
}

async function main() {
  const count = await prisma.returnRequest.count();
  if (count > 0) {
    console.log('Seed data already exists, skipping.');
    return;
  }

  const statuses = [
    ReturnStatus.OPEN,
    ReturnStatus.IN_REVIEW,
    ReturnStatus.APPROVED,
    ReturnStatus.REJECTED,
    ReturnStatus.COMPLETED,
  ];
  const reasons = Object.values(ReturnReason);

  const promises = [];
  for (let i = 0; i < 30; i++) {
    const status = statuses[i % statuses.length];
    const reason = reasons[i % reasons.length];
    const reference = generateReference(i);
    const data = {
      reference,
      customerName: `Customer ${i}`,
      customerEmail: `customer${i}@example.com`,
      customerPhone: i % 2 === 0 ? `+1-555-00${i}` : undefined,
      orderNumber: `ORD-${1000 + i}`,
      itemSku: `SKU-${i % 10}`,
      itemName: `Item ${i % 10}`,
      quantity: 1 + (i % 5),
      reason,
      status,
      ...(status === ReturnStatus.APPROVED && {
        resolution: ResolutionType.REFUND,
        refundAmount: 19.99,
      }),
      ...(i % 3 === 0 && {
        notes: {
          create: {
            content: `Initial note for ${reference}`,
            author: 'Seeder',
          },
        },
      }),
    };
    promises.push(prisma.returnRequest.create({ data }));
  }

  const created = await Promise.all(promises);
  console.log(`Seeded ${created.length} return requests.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
