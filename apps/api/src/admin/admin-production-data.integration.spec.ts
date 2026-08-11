import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  adminBookingProductionDataSql,
  adminBookingProductionDataWhere,
} from './admin-booking-list-query';
import {
  adminNotificationProductionDataSql,
  adminNotificationProductionDataWhere,
} from './admin-notification-production-data';
import { ADMIN_REFUND_ACTIVE_STATUSES } from './admin-refund-queue';

const RUN_DB_CHECK = process.env.ADMIN_PRODUCTION_DATA_DB_CHECK === '1';

if (RUN_DB_CHECK && !process.env.DATABASE_URL) {
  const envPath = resolve(process.cwd(), '..', '..', '.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

const describeDb = RUN_DB_CHECK ? describe : describe.skip;

describeDb('admin production data PostgreSQL parity', () => {
  it('keeps null JSON paths and aligns Prisma counts with raw SQL', async () => {
    const queries: string[] = [];
    const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
    prisma.$on('query', ({ query }) => queries.push(query));

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const bookingPrisma = await tx.booking.count({ where: adminBookingProductionDataWhere() });
          const [bookingRaw] = await tx.$queryRaw<Array<{ count: number }>>(Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "Booking" booking
            WHERE ${adminBookingProductionDataSql()}
          `);
          const notificationPrisma = await tx.notification.count({
            where: adminNotificationProductionDataWhere(),
          });
          const [notificationRaw] = await tx.$queryRaw<Array<{ count: number }>>(Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "Notification" notification
            WHERE ${adminNotificationProductionDataSql()}
          `);
          const refundPrisma = await tx.refund.count({
            where: {
              booking: adminBookingProductionDataWhere(),
              status: {
                in: [...ADMIN_REFUND_ACTIVE_STATUSES],
              },
            },
          });
          const [refundRaw] = await tx.$queryRaw<Array<{ count: number }>>(Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "Refund" refund
            INNER JOIN "Booking" booking ON booking.id = refund."bookingId"
            WHERE ${adminBookingProductionDataSql()}
              AND UPPER(refund.status) IN (${Prisma.join(ADMIN_REFUND_ACTIVE_STATUSES)})
          `);
          const refundStatusCases = await tx.$queryRaw<Array<{ active: boolean; status: string }>>(
            Prisma.sql`
              SELECT status, UPPER(status) IN (${Prisma.join(ADMIN_REFUND_ACTIVE_STATUSES)}) AS active
              FROM (
                VALUES
                  ('REQUESTED'),
                  ('GATEWAY_CONFIRMED'),
                  ('COMPLETED'),
                  ('FUTURE_STATUS')
              ) refund_status(status)
              ORDER BY status
            `,
          );
          const unresolvedNotificationPrisma = await tx.notification.count({
            where: {
              AND: [
                adminNotificationProductionDataWhere(),
                { deliveries: { some: { status: 'FAILED' } } },
                {
                  deliveries: {
                    none: { status: { in: ['SENT', 'DELIVERED', 'SUCCESS'] } },
                  },
                },
              ],
            },
          });
          const [unresolvedNotificationRaw] = await tx.$queryRaw<Array<{ count: number }>>(
            Prisma.sql`
              SELECT COUNT(*)::int AS count
              FROM (
                SELECT notification.id
                FROM "Notification" notification
                INNER JOIN "NotificationDelivery" delivery
                  ON delivery."notificationId" = notification.id
                WHERE UPPER(delivery.status) = 'FAILED'
                  AND ${adminNotificationProductionDataSql()}
                  AND NOT EXISTS (
                    SELECT 1
                    FROM "NotificationDelivery" success
                    WHERE success."notificationId" = notification.id
                      AND UPPER(success.status) IN ('SENT', 'DELIVERED', 'SUCCESS')
                  )
                GROUP BY notification.id
              ) unresolved
            `,
          );
          const bookingCases = await tx.$queryRaw<Array<{ label: string; production: boolean }>>(
            Prisma.sql`
              WITH booking(
                label, id, "customerProfileId", "preferredProviderId", "selectedProviderId", metadata
              ) AS (
                VALUES
                  ('fixture-boolean', 'booking-fixture', 'customer-real', NULL, NULL, '{"smokeFixture":true}'::jsonb),
                  ('audit-fixture', 'booking-audit', 'customer-real', NULL, NULL, '{"auditFixture":"booking-list"}'::jsonb),
                  ('legacy-fixture-string', 'booking-legacy-fixture', 'customer-real', NULL, NULL, '{"fixture":"customer-detail-smoke"}'::jsonb),
                  ('legacy-smoke-string', 'booking-legacy-smoke', 'customer-real', NULL, NULL, '{"smoke":"legacy-smoke"}'::jsonb),
                  ('normal-db-null', 'booking-db-null', 'customer-real', NULL, NULL, NULL::jsonb),
                  ('normal-false', 'booking-false', 'customer-real', NULL, NULL, '{"smokeFixture":false,"smoke":false}'::jsonb),
                  ('normal-json-null', 'booking-json-null', 'customer-real', NULL, NULL, '{"smokeFixture":null,"smoke":null}'::jsonb),
                  ('normal-missing', 'booking-missing', 'customer-real', NULL, NULL, '{}'::jsonb),
                  ('seed-id', 'booking-seed-customer', 'seed-customer', NULL, NULL, '{}'::jsonb),
                  ('smoke-id', 'smoke-booking', 'customer-real', NULL, NULL, '{}'::jsonb)
              )
              SELECT label, (${adminBookingProductionDataSql(Prisma.sql`booking`)}) AS production
              FROM booking
              ORDER BY label
            `,
          );

          return {
            bookingCases,
            bookingPrisma,
            bookingRaw: bookingRaw.count,
            notificationPrisma,
            notificationRaw: notificationRaw.count,
            refundPrisma,
            refundRaw: refundRaw.count,
            refundStatusCases,
            unresolvedNotificationPrisma,
            unresolvedNotificationRaw: unresolvedNotificationRaw.count,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );

      expect(result.bookingPrisma).toBe(result.bookingRaw);
      expect(result.notificationPrisma).toBe(result.notificationRaw);
      expect(result.refundPrisma).toBe(result.refundRaw);
      expect(Object.fromEntries(result.refundStatusCases.map((row) => [row.status, row.active]))).toEqual({
        COMPLETED: false,
        FUTURE_STATUS: false,
        GATEWAY_CONFIRMED: true,
        REQUESTED: true,
      });
      expect(result.unresolvedNotificationPrisma).toBe(result.unresolvedNotificationRaw);
      expect(Object.fromEntries(result.bookingCases.map((row) => [row.label, row.production]))).toEqual({
        'audit-fixture': false,
        'fixture-boolean': false,
        'legacy-fixture-string': false,
        'legacy-smoke-string': false,
        'normal-db-null': true,
        'normal-false': true,
        'normal-json-null': true,
        'normal-missing': true,
        'seed-id': false,
        'smoke-id': false,
      });
      expect(queries.some((query) => /"metadata".*IS NULL/is.test(query))).toBe(true);
      expect(queries.some((query) => /"data".*IS NULL/is.test(query))).toBe(true);
    } finally {
      await prisma.$disconnect();
    }
  });
});
