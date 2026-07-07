import { createElement, Fragment, type ReactNode } from 'react';

import { MoneyText } from '../../components/money-text';
import { cashSettlementRowAgeHours } from './cash-settlement-page-helpers';
import type { CashSettlementProviderGroup, CashSettlementRow, CashSettlementSummary, CommandCard } from './cash-settlement-page-types';

export function buildCashSettlementExecutionDesk(
  rows: readonly CashSettlementRow[],
  providers: readonly CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): CommandCard[] {
  const missingReferenceRows = rows.filter((row) => !row.earning.settlementRef && !row.lastLedgerRef);
  const highestDebt = providers[0];
  const cashEvidenceRows = rows.filter((row) => row.paymentMethod === 'CASH' && row.earning.booking?.payment);

  return [
    {
      action: 'Do not clear wallet debt until evidence is tied to the booking or earning row.',
      className: missingReferenceRows.length ? 'ops-task-pending' : 'ops-task-done',
      detail: missingReferenceRows.length
        ? detailWithMoney(
            moneyText(missingReferenceRows.reduce((sum, row) => sum + row.debtAmount, 0), summary.currency),
            ' still needs a bank deposit reference or an approved admin offset memo.',
          )
        : 'Visible rows already have settlement or wallet impact references for finance review.',
      pillClass: missingReferenceRows.length ? 'pill-warn' : 'pill-success',
      status: missingReferenceRows.length ? `${missingReferenceRows.length} ref needed` : 'Refs ready',
      title: 'Deposit or offset evidence',
    },
    {
      action: 'Contact highest debt first, then oldest debt. Record facts only; do not create a Partner label.',
      className: highestDebt ? 'ops-task-pending' : 'ops-task-done',
      detail: highestDebt
        ? detailWithMoney(
            `${highestDebt.providerName} is first in the queue at `,
            moneyText(highestDebt.debtAmount, highestDebt.currency),
            `, open since ${highestDebt.oldestOpenLabel}.`,
          )
        : 'There is no Partner cash-fee debt waiting for contact.',
      pillClass: highestDebt ? 'pill-warn' : 'pill-success',
      status: highestDebt ? 'Debt first' : 'No queue',
      title: 'Partner contact order',
    },
    {
      action: 'Unlock marketplace finalization only when the Partner wallet is no longer negative.',
      className: summary.providerCount ? 'ops-task-blocked' : 'ops-task-done',
      detail: summary.providerCount
        ? 'Partners with negative cash-fee wallet debt can see marketplace requests while final acceptance, service start, and payout release wait for settlement.'
        : 'No Partner is blocked from final acceptance, service start, or payout release by cash-fee debt in the visible queue.',
      pillClass: summary.providerCount ? 'pill-danger' : 'pill-success',
      status: summary.providerCount ? `${summary.providerCount} blocked` : 'Open',
      title: 'Marketplace unlock condition',
    },
    {
      action: 'Payout release stays separate from customer booking history and customer wallet state.',
      className: summary.debtAmount > 0 ? 'ops-task-blocked' : 'ops-task-done',
      detail: summary.debtAmount > 0
        ? detailWithMoney(
            moneyText(summary.debtAmount, summary.currency),
            ' must be settled before payout release.',
          )
        : 'Cash-fee debt is clear; payout release follows the weekly, monthly, or admin-selected batch rule.',
      pillClass: summary.debtAmount > 0 ? 'pill-danger' : 'pill-success',
      status: summary.debtAmount > 0 ? 'Hold release' : 'Batch ready',
      title: 'Payout release condition',
    },
    {
      action: 'Open booking detail when payment method, amount, or chat evidence is unclear.',
      className: summary.missingPaymentEvidenceCount ? 'ops-task-pending' : 'ops-task-done',
      detail: rows.length
        ? `${cashEvidenceRows.length} visible row(s) have linked CASH payment evidence; ${summary.missingPaymentEvidenceCount} need payment review.`
        : 'No cash settlement row is visible for the current filters.',
      pillClass: summary.missingPaymentEvidenceCount ? 'pill-warn' : 'pill-success',
      status: `${cashEvidenceRows.length}/${rows.length} row(s)`,
      title: 'Cash evidence coverage',
    },
  ];
}

function detailWithMoney(...children: ReactNode[]): ReactNode {
  return createElement(Fragment, null, ...children);
}

function moneyText(amount: number, currency: string): ReactNode {
  return createElement(MoneyText, { amount, currency });
}

export function buildCommandCards(
  rows: readonly CashSettlementRow[],
  providers: readonly CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): CommandCard[] {
  const highDebtProviders = providers.filter((provider) => provider.debtAmount >= 500_000);

  return [
    {
      action: summary.providerCount
        ? 'Collect Partner deposit or approve admin offset before final acceptance, service start, or payout release resumes.'
        : 'No wallet is currently blocked by cash fee debt.',
      className: summary.providerCount ? 'ops-task-blocked' : 'ops-task-done',
      detail: detailWithMoney(
        `${summary.rowCount} open cash settlement row(s), `,
        moneyText(summary.debtAmount, summary.currency),
        ` total. ${summary.cashPaymentRowCount} row(s) are linked to cash payment evidence.`,
      ),
      pillClass: summary.providerCount ? 'pill-danger' : 'pill-success',
      status: `${summary.providerCount} Partner(s)`,
      title: 'Marketplace-held wallets',
    },
    {
      action: highDebtProviders.length
        ? 'Prioritize these Partners before reopening final acceptance, service start, or payout release.'
        : 'Normal settlement queue priority.',
      className: highDebtProviders.length ? 'ops-task-pending' : 'ops-task-done',
      detail: highDebtProviders.length
        ? providerDebtDetails(highDebtProviders)
        : 'No Partner is above the high-debt review threshold.',
      pillClass: highDebtProviders.length ? 'pill-warn' : 'pill-success',
      status: `${summary.highDebtProviderCount} HIGH`,
      title: 'High debt priority',
    },
    {
      action: summary.staleDebtRowCount ? 'Contact Partner and record deposit or offset evidence.' : 'No aging escalation needed.',
      className: summary.staleDebtRowCount ? 'ops-task-pending' : 'ops-task-done',
      detail: summary.staleDebtRowCount
        ? 'One or more cash debts have been open longer than 24 hours.'
        : 'No cash fee debt is older than 24 hours.',
      pillClass: summary.staleDebtRowCount ? 'pill-warn' : 'pill-success',
      status: `${summary.staleDebtRowCount} OLD`,
      title: 'Aging debt',
    },
    {
      action: summary.missingPaymentEvidenceCount
        ? 'Open booking detail before settling these rows.'
        : 'Rows are ready for finance confirmation.',
      className: summary.missingPaymentEvidenceCount ? 'ops-task-blocked' : 'ops-task-done',
      detail: summary.missingPaymentEvidenceCount
        ? 'Some rows lack linked payment evidence in the admin payload.'
        : 'Every visible row has booking payment evidence attached.',
      pillClass: summary.missingPaymentEvidenceCount ? 'pill-danger' : 'pill-success',
      status: `${summary.missingPaymentEvidenceCount} CHECK`,
      title: 'Payment evidence',
    },
  ];
}

export function buildDebtCauseCards(rows: readonly CashSettlementRow[], summary: CashSettlementSummary): CommandCard[] {
  const cashRows = rows.filter((row) => row.paymentMethod === 'CASH');
  const taxRows = rows.filter((row) => row.taxAmount > 0);
  const feeOnlyRows = rows.filter((row) => row.platformFee > 0 && row.taxAmount <= 0);
  const missingEvidenceRows = rows.filter((row) => !row.earning.booking?.payment || row.paymentMethod !== 'CASH');
  const staleRows = rows.filter((row) => cashSettlementRowAgeHours(row) >= 24);

  return [
    {
      action: cashRows.length ? 'Ask for company-fee deposit evidence or approve an admin offset.' : 'No visible row is tied to a cash payment.',
      className: cashRows.length ? 'ops-task-pending' : 'ops-task-done',
      detail: detailWithMoney(
        moneyText(cashRows.reduce((sum, row) => sum + row.bookingAmount, 0), summary.currency),
        ' customer cash was collected outside the platform and needs HANDS fee reconciliation.',
      ),
      pillClass: cashRows.length ? 'pill-warn' : 'pill-success',
      status: `${cashRows.length} ROW(S)`,
      title: 'Cash collected by Partner',
    },
    {
      action: 'This is the main reason final acceptance and service start are blocked while the wallet is negative.',
      className: rows.length ? 'ops-task-blocked' : 'ops-task-done',
      detail: detailWithMoney(
        moneyText(rows.reduce((sum, row) => sum + row.platformFee, 0), summary.currency),
        ' HANDS fee remains open across visible rows.',
      ),
      pillClass: rows.length ? 'pill-danger' : 'pill-success',
      status: `${feeOnlyRows.length} FEE ROW(S)`,
      title: 'Platform fee debt',
    },
    {
      action: taxRows.length ? 'Check tax policy version before approving an offset.' : 'No tax withholding is attached to visible rows.',
      className: taxRows.length ? 'ops-task-pending' : 'ops-task-done',
      detail: detailWithMoney(
        moneyText(taxRows.reduce((sum, row) => sum + row.taxAmount, 0), summary.currency),
        ' tax withholding is included in the negative-wallet calculation.',
      ),
      pillClass: taxRows.length ? 'pill-info' : 'pill-success',
      status: `${taxRows.length} TAX ROW(S)`,
      title: 'Tax withholding part',
    },
    {
      action: missingEvidenceRows.length ? 'Open booking/payment detail before settlement.' : 'Rows are ready for finance evidence confirmation.',
      className: missingEvidenceRows.length ? 'ops-task-blocked' : 'ops-task-done',
      detail: missingEvidenceRows.length
        ? 'Some rows lack cash payment evidence or are not marked CASH in the linked payment payload.'
        : 'Visible rows have cash payment evidence attached.',
      pillClass: missingEvidenceRows.length ? 'pill-danger' : 'pill-success',
      status: `${missingEvidenceRows.length} CHECK`,
      title: 'Evidence gaps',
    },
    {
      action: staleRows.length ? 'Prioritize Partner contact and evidence collection.' : 'Normal settlement cadence is enough.',
      className: staleRows.length ? 'ops-task-pending' : 'ops-task-done',
      detail: staleRows.length
        ? detailWithMoney(
            moneyText(staleRows.reduce((sum, row) => sum + row.debtAmount, 0), summary.currency),
            ' has been open longer than the first finance follow-up window.',
          )
        : 'No visible debt is older than 24 hours.',
      pillClass: staleRows.length ? 'pill-warn' : 'pill-success',
      status: `${staleRows.length} OVER 24H`,
      title: 'Aging follow-up',
    },
  ];
}

function providerDebtDetails(providers: readonly CashSettlementProviderGroup[]): ReactNode {
  return detailWithMoney(
    ...providers.slice(0, 2).flatMap((provider, index): ReactNode[] => [
      index > 0 ? ' / ' : '',
      `${provider.providerName}: `,
      moneyText(provider.debtAmount, provider.currency),
    ]),
  );
}
