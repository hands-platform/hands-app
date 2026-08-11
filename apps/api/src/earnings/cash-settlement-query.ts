import { BookingStatus, EarningStatus, PaymentMethod, Prisma, ProviderWalletLedgerType } from '@prisma/client';

import { adminBookingProductionDataSql } from '../admin/admin-booking-list-query';

export const CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD = 500_000;
export const CASH_SETTLEMENT_STALE_MS = 24 * 60 * 60 * 1000;

type CashSettlementDateBounds = {
  readonly gt?: Date;
  readonly gte?: Date;
  readonly lt?: Date;
  readonly lte?: Date;
};

export type CashSettlementDebtFilter = {
  readonly age?: CashSettlementDateBounds;
  readonly createdAt?: CashSettlementDateBounds;
  readonly now?: Date;
  readonly period?: string | null;
  readonly q?: string | null;
  readonly queue?: string | null;
  readonly sla?: CashSettlementDateBounds;
};

export function cashSettlementDebtCteSql() {
  return Prisma.sql`
    cash_settlement_allocation_totals AS (
      SELECT
        allocation."providerEarningId",
        COUNT(*)::bigint AS "allocationCount",
        COALESCE(SUM(allocation.amount), 0)::bigint AS "allocatedAmount"
      FROM "PartnerBankDepositCashDebtAllocation" allocation
      GROUP BY allocation."providerEarningId"
    ),
    cash_settlement_debt AS (
      SELECT
        earning.id,
        earning."bookingId",
        earning."providerProfileId",
        earning.currency,
        earning."createdAt",
        settlement."monthlyPeriod",
        earning."platformFee"::bigint AS "platformFee",
        earning."withholdingAmount"::bigint AS "withholdingAmount",
        ABS(earning."netAmount")::bigint AS "originalDebtAmount",
        COALESCE(allocation_totals."allocatedAmount", 0)::bigint AS "allocatedAmount",
        GREATEST(
          0,
          ABS(earning."netAmount")::bigint - COALESCE(allocation_totals."allocatedAmount", 0)::bigint
        )::bigint AS "remainingDebtAmount",
        COALESCE(allocation_totals."allocationCount", 0)::bigint AS "allocationCount",
        payment.method::text AS "paymentMethod",
        provider."displayName" AS "providerDisplayName",
        partner_user."fullName" AS "providerFullName",
        partner_user.phone AS "providerPhone",
        COALESCE(
          (
            SELECT SUM(
              CASE
                WHEN ledger.metadata->>'cashBookingCompanyCouponExpense' ~ '^[0-9]+$'
                  THEN (ledger.metadata->>'cashBookingCompanyCouponExpense')::bigint
                ELSE 0
              END
            )
            FROM "ProviderWalletLedgerEntry" ledger
            WHERE ledger."earningId" = earning.id
              AND ledger.type::text = ${ProviderWalletLedgerType.CASH_BOOKING_PLATFORM_FEE_DEDUCTED}
          ),
          0
        )::bigint AS "companyCouponOffset"
      FROM "ProviderEarning" earning
      INNER JOIN "Booking" booking ON booking.id = earning."bookingId"
      INNER JOIN "ProviderProfile" provider ON provider.id = earning."providerProfileId"
      INNER JOIN "User" partner_user ON partner_user.id = provider."userId"
      LEFT JOIN "Payment" payment ON payment."bookingId" = earning."bookingId"
      LEFT JOIN "BookingSettlementSnapshot" settlement ON settlement."bookingId" = earning."bookingId"
      LEFT JOIN cash_settlement_allocation_totals allocation_totals
        ON allocation_totals."providerEarningId" = earning.id
      WHERE ${adminBookingProductionDataSql(Prisma.sql`booking`)}
        AND earning.status::text IN (${EarningStatus.PENDING}, ${EarningStatus.AVAILABLE})
        AND earning."payoutBatchId" IS NULL
        AND earning."netAmount" < 0
        AND NOT (
          booking.status::text = ${BookingStatus.CANCELLED}
          AND (booking."matchedAt" IS NOT NULL OR booking."selectedProviderId" IS NOT NULL)
        )
    )
  `;
}

export function cashSettlementDebtFilterSql(filter: CashSettlementDebtFilter = {}) {
  const clauses: Prisma.Sql[] = [Prisma.sql`debt."remainingDebtAmount" > 0`];

  appendDateBounds(clauses, Prisma.sql`debt."createdAt"`, filter.createdAt);
  appendDateBounds(clauses, Prisma.sql`debt."createdAt"`, filter.age);
  appendDateBounds(clauses, Prisma.sql`debt."createdAt"`, filter.sla);

  if (filter.period !== undefined && filter.period !== null) {
    const period = normalizeQuery(filter.period);
    clauses.push(
      period && /^\d{4}-(0[1-9]|1[0-2])$/u.test(period)
        ? Prisma.sql`debt."monthlyPeriod" = ${period}`
        : Prisma.sql`FALSE`,
    );
  }

  switch (normalizeQuery(filter.queue)) {
    case 'stale':
      clauses.push(
        Prisma.sql`debt."createdAt" <= ${new Date(
          (filter.now ?? new Date()).getTime() - CASH_SETTLEMENT_STALE_MS,
        )}`,
      );
      break;
    case 'high-debt':
      clauses.push(
        Prisma.sql`debt."remainingDebtAmount" >= ${CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD}`,
      );
      break;
    case 'missing-evidence':
    case 'missing-ref':
      clauses.push(Prisma.sql`debt."allocationCount" = 0`);
      break;
    case 'payment-check':
      clauses.push(
        Prisma.sql`(debt."paymentMethod" IS NULL OR debt."paymentMethod" <> ${PaymentMethod.CASH})`,
      );
      break;
  }

  const search = cleanSearch(filter.q);
  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    clauses.push(Prisma.sql`(
      debt.id ILIKE ${pattern} ESCAPE '\\'
      OR debt."bookingId" ILIKE ${pattern} ESCAPE '\\'
      OR debt."providerProfileId" ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(debt."providerDisplayName", '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(debt."providerFullName", '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(debt."providerPhone", '') ILIKE ${pattern} ESCAPE '\\'
      OR EXISTS (
        SELECT 1
        FROM "ProviderEarning" search_earning
        WHERE search_earning.id = debt.id
          AND (
            COALESCE(search_earning."settlementRef", '') ILIKE ${pattern} ESCAPE '\\'
            OR COALESCE(search_earning."settlementNotes", '') ILIKE ${pattern} ESCAPE '\\'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM "ProviderWalletLedgerEntry" search_ledger
        WHERE search_ledger."earningId" = debt.id
          AND COALESCE(search_ledger.reference, '') ILIKE ${pattern} ESCAPE '\\'
      )
    )`);
  }

  return Prisma.join(clauses, ' AND ');
}

function appendDateBounds(
  clauses: Prisma.Sql[],
  column: Prisma.Sql,
  bounds: CashSettlementDateBounds | undefined,
) {
  if (bounds?.gt) clauses.push(Prisma.sql`${column} > ${bounds.gt}`);
  if (bounds?.gte) clauses.push(Prisma.sql`${column} >= ${bounds.gte}`);
  if (bounds?.lt) clauses.push(Prisma.sql`${column} < ${bounds.lt}`);
  if (bounds?.lte) clauses.push(Prisma.sql`${column} <= ${bounds.lte}`);
}

function cleanSearch(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 200) : null;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/gu, (match) => `\\${match}`);
}

function normalizeQuery(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}
