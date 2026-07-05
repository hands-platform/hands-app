import { createElement, Fragment, type ReactNode } from 'react';

import { MoneyText } from '../../components/money-text';
import { shortRecordId } from '../../lib/admin-format';
import type { CashSettlementPriorityBoardRow } from './cash-settlement-priority-board-section';
import { cashSettlementRowAgeHours } from './cash-settlement-page-helpers';
import type { CashSettlementPriorityItem, CashSettlementRow } from './cash-settlement-page-types';

export function buildCashSettlementPriorityBoardRows(
  items: readonly CashSettlementPriorityItem[],
): CashSettlementPriorityBoardRow[] {
  return items.map((item) => ({
    ageLabel: item.ageLabel,
    bookingHref: `/bookings/${item.row.earning.bookingId}`,
    bookingLabel: shortRecordId(item.row.earning.bookingId),
    currency: item.row.earning.currency,
    debtAmount: item.row.debtAmount,
    pillClass: item.pillClass,
    priority: item.priority,
    providerName: item.row.providerName,
    providerPhone: item.row.providerPhone,
    reason: item.reason,
    requiredEvidence: item.requiredEvidence,
    unlockResult: item.unlockResult,
  }));
}

export function buildCashSettlementPriorityBoard(rows: readonly CashSettlementRow[]): CashSettlementPriorityItem[] {
  return rows
    .slice()
    .sort((left, right) => {
      if (left.debtAmount !== right.debtAmount) {
        return right.debtAmount - left.debtAmount;
      }
      return cashSettlementRowAgeHours(right) - cashSettlementRowAgeHours(left);
    })
    .slice(0, 8)
    .map((row) => {
      const ageHours = cashSettlementRowAgeHours(row);
      const missingReference = !row.earning.settlementRef && !row.lastLedgerRef;
      const missingPaymentEvidence = !row.earning.booking?.payment || row.paymentMethod !== 'CASH';
      const priority =
        row.debtAmount >= 500_000
          ? 'High debt'
          : ageHours >= 24
            ? 'Over 24h'
            : missingReference || missingPaymentEvidence
              ? 'Evidence check'
              : 'Ready';
      const pillClass =
        row.debtAmount >= 500_000
          ? 'pill-danger'
          : ageHours >= 24
            ? 'pill-warn'
            : missingReference || missingPaymentEvidence
              ? 'pill-info'
              : 'pill-success';

      return {
        ageLabel: ageHours >= 1 ? `${Math.round(ageHours)}h open` : row.createdAtLabel,
        pillClass,
        priority,
        reason: settlementPriorityReason(row, ageHours, missingReference, missingPaymentEvidence),
        requiredEvidence: settlementRequiredEvidence(row, missingReference, missingPaymentEvidence),
        row,
        unlockResult: settlementUnlockResult(row),
      };
    });
}

function settlementPriorityReason(
  row: CashSettlementRow,
  ageHours: number,
  missingReference: boolean,
  missingPaymentEvidence: boolean,
) {
  if (row.debtAmount >= 500_000) {
    return detailWithMoney(
      'Largest debt lane: ',
      moneyText(row.debtAmount, row.earning.currency),
      ' is holding final acceptance.',
    );
  }
  if (ageHours >= 24) {
    return `Aging lane: this cash-fee debt has been open for about ${Math.round(ageHours)} hours.`;
  }
  if (missingPaymentEvidence) {
    return 'Payment evidence lane: booking payment method or amount needs review before settlement.';
  }
  if (missingReference) {
    return 'Reference lane: finance still needs a bank deposit ref or approved offset memo.';
  }
  return 'Ready lane: minimum evidence exists; finance can confirm deposit or offset on the row.';
}

function settlementRequiredEvidence(
  row: CashSettlementRow,
  missingReference: boolean,
  missingPaymentEvidence: boolean,
) {
  return [
    missingPaymentEvidence
      ? 'Check booking payment method and customer cash amount.'
      : detailWithMoney('Cash payment evidence: ', moneyText(row.bookingAmount, row.earning.currency), ' collected.'),
    missingReference
      ? `Attach deposit or offset reference: ${row.settlementReference}.`
      : `Existing ref: ${row.earning.settlementRef ?? row.lastLedgerRef}.`,
    detailWithMoney(
      'Confirm HANDS fee ',
      moneyText(row.platformFee, row.earning.currency),
      ' and tax ',
      moneyText(row.taxAmount, row.earning.currency),
      '.',
    ),
  ];
}

function settlementUnlockResult(row: CashSettlementRow) {
  return [
    'Final acceptance, service start, and payout release unlock only after wallet balance is no longer negative.',
    'Payout release returns to batch review after settlement.',
    `Customer wallet stays unchanged; this is Partner cash-fee debt for booking ${shortRecordId(row.earning.bookingId)}.`,
  ];
}

function detailWithMoney(...children: ReactNode[]): ReactNode {
  return createElement(Fragment, null, ...children);
}

function moneyText(amount: number, currency: string): ReactNode {
  return createElement(MoneyText, { amount, currency });
}
