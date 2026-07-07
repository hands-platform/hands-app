import { createElement, Fragment, type ReactNode } from 'react';

import { MoneyText } from '../../components/money-text';
import type {
  CashSettlementHandoffItem,
  CashSettlementProviderGroup,
  CashSettlementRow,
  CashSettlementSummary,
  EvidenceChecklistItem,
  WalletRecoveryStep,
} from './cash-settlement-page-types';

export function buildWalletRecoverySteps(
  rows: readonly CashSettlementRow[],
  providers: readonly CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): WalletRecoveryStep[] {
  const hasOpenDebt = summary.rowCount > 0;
  const missingEvidenceRows = rows.filter((row) => !row.earning.booking?.payment || row.paymentMethod !== 'CASH');
  const highestDebt = providers[0];

  return [
    {
      detail: hasOpenDebt
        ? detailWithMoney(
            `${summary.providerCount} Partner wallet(s) are negative because cash bookings created `,
            moneyText(summary.debtAmount, summary.currency),
            ' of unpaid HANDS fee or withholding debt.',
          )
        : 'No Partner wallet is currently negative because of cash-fee debt.',
      operatorRule:
        'Use booking, payment, earning, and chat evidence. Record facts only; do not turn this into a Partner or customer label.',
      pillClass: hasOpenDebt ? 'pill-danger' : 'pill-success',
      status: hasOpenDebt ? `${summary.rowCount} open` : 'Clear',
      title: '1. Confirm why the wallet is negative',
    },
    {
      detail: missingEvidenceRows.length
        ? 'Some rows need payment evidence review before finance should clear the wallet.'
        : 'Visible rows have the minimum booking/payment evidence needed for settlement review.',
      operatorRule:
        'Use a bank transfer reference when the Partner pays HANDS, or an admin offset memo when finance deducts from future earnings.',
      pillClass: missingEvidenceRows.length ? 'pill-warn' : 'pill-success',
      status: missingEvidenceRows.length ? `${missingEvidenceRows.length} check` : 'Evidence ready',
      title: '2. Collect deposit or approve offset',
    },
    {
      detail: highestDebt
        ? detailWithMoney(
            `Start with ${highestDebt.providerName}, currently `,
            moneyText(highestDebt.debtAmount, highestDebt.currency),
            ' open.',
          )
        : 'There is no open row waiting for confirmation.',
      operatorRule:
        'Submitting the settlement form marks the negative earning paid and creates the wallet impact evidence.',
      pillClass: hasOpenDebt ? 'pill-warn' : 'pill-success',
      status: hasOpenDebt ? 'Action needed' : 'No action',
      title: '3. Confirm deposit / offset on the row',
    },
    {
      detail: hasOpenDebt
        ? 'Final acceptance, service start, and payout release remain blocked until the Partner wallet is no longer negative.'
        : 'Partners with cleared wallets can proceed through eligible marketplace finalization and payout release checks.',
      operatorRule:
        'Negative-wallet Partners may still see marketplace requests. Only final acceptance, service start, and payout release are gated.',
      pillClass: hasOpenDebt ? 'pill-danger' : 'pill-success',
      status: hasOpenDebt ? 'Still gated' : 'Unlocked',
      title: '4. Reopen finalization and payout release',
    },
  ];
}

export function buildCashSettlementHandoffMap(
  rows: readonly CashSettlementRow[],
  providers: readonly CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): CashSettlementHandoffItem[] {
  const hasOpenDebt = summary.rowCount > 0;
  const highestDebt = providers[0];
  const rowsWithLedgerRefs = rows.filter((row) => row.lastLedgerRef || row.earning.settlementRef);
  const missingReferenceRows = rows.filter((row) => !row.lastLedgerRef && !row.earning.settlementRef);
  const cashRows = rows.filter((row) => row.paymentMethod === 'CASH');

  return [
    {
      className: cashRows.length ? 'ops-task-pending' : 'ops-task-done',
      detail: cashRows.length
        ? detailWithMoney(
            moneyText(cashRows.reduce((sum, row) => sum + row.bookingAmount, 0), summary.currency),
            ' was collected by Partners as customer cash.',
          )
        : 'No visible row is currently linked to a CASH payment method.',
      href: '/bookings?view=cash-debt',
      operatorRule: 'Use booking detail for payment, chat, and marketplace participant evidence.',
      pillClass: cashRows.length ? 'pill-warn' : 'pill-success',
      status: `${summary.cashPaymentRowCount} cash row(s)`,
      title: 'Cash booking source',
    },
    {
      className: hasOpenDebt ? 'ops-task-blocked' : 'ops-task-done',
      detail: highestDebt
        ? detailWithMoney(
            `${highestDebt.providerName} has the largest open wallet debt: `,
            moneyText(highestDebt.debtAmount, highestDebt.currency),
            '.',
          )
        : 'No Partner wallet has cash-fee debt in the current queue.',
      href: '/partner-controls?review=cash-debt',
      operatorRule: 'Negative wallet applies only to Partners; customers never carry negative wallet debt.',
      pillClass: hasOpenDebt ? 'pill-danger' : 'pill-success',
      status: hasOpenDebt ? `${summary.providerCount} wallet(s)` : 'Clear',
      title: 'Partner wallet debt',
    },
    {
      className: missingReferenceRows.length ? 'ops-task-pending' : 'ops-task-done',
      detail: missingReferenceRows.length
        ? 'Finance still needs a bank deposit reference or an approved admin offset memo.'
        : `${rowsWithLedgerRefs.length} row(s) already have a settlement or wallet impact reference.`,
      href: '/cash-settlements?queue=missing-ref',
      operatorRule: 'The settlement action must keep booking, payment, earning, and wallet references aligned.',
      pillClass: missingReferenceRows.length ? 'pill-warn' : 'pill-success',
      status: missingReferenceRows.length ? `${missingReferenceRows.length} ref needed` : 'Evidence linked',
      title: 'Deposit or offset evidence',
    },
    {
      className: hasOpenDebt ? 'ops-task-blocked' : 'ops-task-done',
      detail: hasOpenDebt
        ? 'Partners may see and join marketplace requests, but final acceptance, service start, and payout release wait for wallet settlement.'
        : 'Cleared Partner wallets can proceed through eligible marketplace finalization again.',
      href: '/bookings?view=marketplace',
      operatorRule: 'Partner app message: Unpaid HANDS fees must be settled before final acceptance or service start.',
      pillClass: hasOpenDebt ? 'pill-danger' : 'pill-success',
      status: hasOpenDebt ? 'Finalization gated' : 'Finalization open',
      title: 'Marketplace reopen rule',
    },
    {
      className: hasOpenDebt ? 'ops-task-pending' : 'ops-task-done',
      detail: hasOpenDebt
        ? detailWithMoney(moneyText(summary.debtAmount, summary.currency), ' must be settled before payout release.')
        : 'Payout release can continue through normal weekly, monthly, or admin-selected batch checks.',
      href: '/payouts',
      operatorRule: 'Cash debt settlement should be visible before finance approves payout release.',
      pillClass: hasOpenDebt ? 'pill-warn' : 'pill-success',
      status: hasOpenDebt ? 'Hold payout' : 'Release checks',
      title: 'Payout release gate',
    },
  ];
}

function detailWithMoney(...children: ReactNode[]): ReactNode {
  return createElement(Fragment, null, ...children);
}

function moneyText(amount: number, currency: string): ReactNode {
  return createElement(MoneyText, { amount, currency });
}

export function buildCashSettlementEvidenceChecklist(
  rows: readonly CashSettlementRow[],
  providers: readonly CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): EvidenceChecklistItem[] {
  const highDebtProviders = providers.filter((provider) => provider.debtAmount >= 500000);
  const rowsWithRefs = rows.filter((row) => row.lastLedgerRef);

  return [
    {
      className: rows.length ? 'ops-task-pending' : 'ops-task-done',
      detail: 'Confirm bank deposit reference or approved offset memo before settling the cash fee debt.',
      href: '/cash-settlements',
      operatorRule: 'The settlement action requires an auditable reference and note.',
      pillClass: rows.length ? 'pill-warn' : 'pill-success',
      status: `${rows.length} open row(s)`,
      title: 'Company-fee evidence',
    },
    {
      className: summary.providerCount ? 'ops-task-blocked' : 'ops-task-done',
      detail:
        'Negative wallet Partners can see marketplace requests, but final acceptance, service start, and payout release wait until settlement is confirmed.',
      href: '/partner-controls',
      operatorRule: 'Reopen marketplace finalization only after settlement or approved offset is recorded.',
      pillClass: summary.providerCount ? 'pill-danger' : 'pill-success',
      status: `${summary.providerCount} Partner(s)`,
      title: 'Wallet finalization gate',
    },
    {
      className: highDebtProviders.length ? 'ops-task-pending' : 'ops-task-done',
      detail: 'Prioritize the highest debt and oldest open rows for operator handoff.',
      href: '/finance-closeout',
      operatorRule: 'Use Partner detail, booking detail, and finance closeout together.',
      pillClass: highDebtProviders.length ? 'pill-warn' : 'pill-success',
      status: `${highDebtProviders.length} follow-up`,
      title: 'High-debt follow-up',
    },
    {
      className: rowsWithRefs.length === rows.length ? 'ops-task-done' : 'ops-task-pending',
      detail: 'Existing wallet impact references should match the booking, payment, and earning row.',
      href: '/audit-log?bucket=Finance%2FCloseout',
      operatorRule: 'If a reference is missing, leave the row open until finance has evidence.',
      pillClass: rowsWithRefs.length === rows.length ? 'pill-success' : 'pill-info',
      status: `${rowsWithRefs.length} ref(s)`,
      title: 'Wallet evidence',
    },
  ];
}
