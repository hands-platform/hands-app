import {
  AccountingJournalBatchStatus,
  AccountingJournalEntrySide,
  AccountingJournalSourceType,
  BankReconciliationStatus,
  CompanyBankTransactionType,
  PayoutBatchStatus,
  Prisma,
} from '@prisma/client';

import { VIETNAM_TIME_ZONE } from '../settlements/settlements.service';

export type AdminPayoutBankOutflowCandidateRow = {
  id: string;
  matchedAmount: bigint | number;
  paidAt: Date | string | null;
  remainingAmount: bigint | number;
  targetAmount: bigint | number;
};

export function adminPayoutBankOutflowReconciliationCteSql(period: string): Prisma.Sql {
  return Prisma.sql`
    "payoutBankOutflowEvidence" AS (
      SELECT
        payout."id",
        payout."paidAt",
        payout."totalNetAmount"::bigint AS "targetAmount",
        COALESCE(
          SUM(
            CASE
              WHEN match."status" IN (
                ${BankReconciliationStatus.MATCHED}::"BankReconciliationStatus",
                ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
              )
                AND bank."status" IN (
                  ${BankReconciliationStatus.MATCHED}::"BankReconciliationStatus",
                  ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
                )
                AND bank."type" = ${CompanyBankTransactionType.OUTFLOW}::"CompanyBankTransactionType"
                AND bank."currency" = payout."currency"
              THEN ABS(match."amount")
              ELSE 0
            END
          ),
          0
        )::bigint AS "matchedAmount"
      FROM "ProviderPayoutBatch" payout
      LEFT JOIN "AccountingJournalBatch" journal
        ON journal."sourceKey" = 'accounting-journal:provider-payout-batch:' || payout."id" || ':paid'
        AND journal."sourceType" = ${AccountingJournalSourceType.PROVIDER_PAYOUT_BATCH}::"AccountingJournalSourceType"
        AND journal."status" = ${AccountingJournalBatchStatus.POSTED}::"AccountingJournalBatchStatus"
      LEFT JOIN "AccountingJournalEntry" entry
        ON entry."batchId" = journal."id"
        AND entry."side" = ${AccountingJournalEntrySide.CREDIT}::"AccountingJournalEntrySide"
        AND entry."accountCode" = 'company_bank_cash'
      LEFT JOIN "BankReconciliationMatch" match
        ON match."payoutBatchId" = payout."id"
        AND match."accountingJournalEntryId" = entry."id"
      LEFT JOIN "CompanyBankTransaction" bank
        ON bank."id" = match."bankTransactionId"
      WHERE payout."status" = ${PayoutBatchStatus.PAID}::"PayoutBatchStatus"
        AND COALESCE(
          journal."monthlyPeriod",
          TO_CHAR(COALESCE(payout."paidAt", payout."createdAt") AT TIME ZONE ${VIETNAM_TIME_ZONE}, 'YYYY-MM')
        ) = ${period}
      GROUP BY payout."id", payout."paidAt", payout."totalNetAmount"
    ),
    "openPayoutBankOutflows" AS (
      SELECT
        evidence."id",
        evidence."paidAt",
        evidence."targetAmount",
        evidence."matchedAmount",
        GREATEST(
          evidence."targetAmount" - LEAST(evidence."targetAmount", evidence."matchedAmount"),
          0
        )::bigint AS "remainingAmount"
      FROM "payoutBankOutflowEvidence" evidence
      WHERE evidence."matchedAmount" < evidence."targetAmount"
    )
  `;
}
