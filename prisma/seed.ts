import { PrismaClient, ReturnStatus, ReturnReason, ResolutionType } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

function generateReference(index: number) {
  // Simple deterministic reference for repeatable seed
  return `RET-${(100000 + index).toString().padStart(6, '0')}`;
}

async function main() {
  // If there are already records, skip seeding to keep idempotent
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

  const records = [];
  for (let i = 0; i < 30; i++) {
    const status = statuses[i % statuses.length];
    const reason = reasons[i % reasons.length] as ReturnReason;
    const reference = generateReference(i);
    const request = await prisma.returnRequest.create({
      data: {
        reference,
        customerName: `Customer ${i}`,
        customerEmail: `customer${i}@example.com`,
        customerPhone: i % 2 === 0 ? `+1-555-000${i}` : undefined,
        orderNumber: `ORD-${1000 + i}`,
        itemSku: `SKU-${i % 10}`,
        itemName: `Item ${i % 10}`,
        quantity: 1 + (i % 5),
        reason,
        status,
        // Provide a resolution only for APPROVED status
        ...(status === ReturnStatus.APPROVED && {
          resolution: ResolutionType.REFUND,
          refundAmount: 19.99,
        }),
        // Add a note for every third record
        ...(i % 3 === 0 && {
          notes: {
            create: {
              content: `Initial note for ${reference}`,
              author: 'Seeder',
            },
          },
        }),
      },
    });
    records.push(request);
  }

  console.log(`Seeded ${records.length} return requests.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
