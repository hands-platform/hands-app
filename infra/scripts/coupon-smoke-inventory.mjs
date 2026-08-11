import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const coupons = await prisma.coupon.findMany({
    where: { code: { startsWith: 'SMOKE' } },
    orderBy: { code: 'asc' },
  });
  const targets = coupons.map((coupon) => `coupon:${coupon.id}`);
  const audits = targets.length
    ? await prisma.adminAuditLog.findMany({
        where: { action: 'coupon.create', target: { in: targets } },
        include: { actor: { select: { email: true, fullName: true, id: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  const auditsByTarget = new Map();
  for (const audit of audits) {
    if (!auditsByTarget.has(audit.target)) auditsByTarget.set(audit.target, audit);
  }

  const rows = await Promise.all(coupons.map(async (coupon) => {
    const audit = auditsByTarget.get(`coupon:${coupon.id}`);
    const usageCount = await prisma.booking.count({
      where: {
        payment: {
          is: {
            OR: [
              { rawMeta: { path: ['couponId'], equals: coupon.id } },
              { rawMeta: { path: ['couponCode'], equals: coupon.code } },
            ],
          },
        },
      },
    });
    return {
      active: coupon.active,
      code: coupon.code,
      createdAt: audit?.createdAt?.toISOString() ?? null,
      createdBy: audit?.actor?.fullName ?? audit?.actor?.email ?? audit?.actor?.id ?? null,
      endsAt: coupon.endsAt?.toISOString() ?? null,
      id: coupon.id,
      startsAt: coupon.startsAt?.toISOString() ?? null,
      usageCount,
    };
  }));
  const now = Date.now();

  process.stdout.write(`${JSON.stringify({
    generatedAt: new Date().toISOString(),
    readOnly: true,
    summary: {
      active: rows.filter((row) => row.active).length,
      activeOpenEnded: rows.filter((row) => row.active && !row.endsAt).length,
      expired: rows.filter((row) => row.endsAt && Date.parse(row.endsAt) < now).length,
      total: rows.length,
      withUsage: rows.filter((row) => row.usageCount > 0).length,
    },
    rows,
  }, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
