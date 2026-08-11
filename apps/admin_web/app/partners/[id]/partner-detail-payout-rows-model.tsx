import { adminPayoutBatchOperatorEvidenceLines } from '../../../components/admin-finance-operator-evidence';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import type { PartnerCashDebtOriginRow } from './partner-detail-cash-debt-origin-section';
import {
  amountValue,
  formatDate,
  shortRecordId,
  walletLedgerLabel,
} from './partner-detail-format';
import type {
  PartnerPayoutBatchRow,
  PartnerPayoutEarningRow,
  PartnerPayoutOperationsView,
} from './partner-detail-payout-operations-section';
import type { buildProviderPayoutOps } from './partner-detail-payout-security-model';
import type { ProviderDetail } from './partner-detail-types';

type PartnerEarning = NonNullable<ProviderDetail['earnings']>[number];
type PartnerPayoutBatch = NonNullable<ProviderDetail['payoutBatches']>[number];

export function isCashFeeDebt(earning: PartnerEarning) {
  return earning.netAmount < 0 && earning.booking?.payment?.method === 'CASH' && earning.status !== 'PAID';
}

export function buildPartnerCashDebtOriginRows(
  earnings: readonly PartnerEarning[],
): PartnerCashDebtOriginRow[] {
  return earnings.slice(0, 5).map((earning) => ({
    amountLabel: <MoneyText amount={Math.abs(amountValue(earning.netAmount))} />,
    bookingHref: earning.bookingId ? `/bookings/${earning.bookingId}` : undefined,
    bookingLabel: earning.bookingId ? shortRecordId(earning.bookingId) : 'unknown',
    createdAt: earning.createdAt,
    evidenceLabel: partnerCashDebtEvidenceLabel(earning),
    handsFeeLabel: <MoneyText amount={earning.platformFee} />,
    id: earning.id,
    originLabel: partnerCashDebtOriginLabel(earning),
    paymentMethod: earning.booking?.payment?.method ?? 'UNKNOWN',
    taxLabel: <MoneyText amount={earning.withholdingAmount} />,
  }));
}

export function buildPartnerPayoutOperationsView(
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
): PartnerPayoutOperationsView {
  return {
    blockers: payoutOps.blockers,
    cards: payoutOps.cards,
    hold: payoutOps.hold
      ? {
          expiresAt: payoutOps.hold.expiresAt ?? null,
          reason: payoutOps.hold.reason,
          startsAt: payoutOps.hold.startsAt ?? null,
        }
      : null,
    status: payoutOps.status,
    tone: payoutOps.tone,
  };
}

export function buildPartnerPayoutEarningRows(
  earnings: readonly PartnerEarning[],
): PartnerPayoutEarningRow[] {
  return earnings.slice(0, 5).map((earning) => {
    const cashDebt = isCashFeeDebt(earning);
    const bookingPrefix = earning.bookingId ? `Booking ${shortRecordId(earning.bookingId)} / ` : '';

    return {
      amountLine: (
        <>
          Gross <MoneyText amount={earning.grossAmount} /> / platform fee{' '}
          <MoneyText amount={earning.platformFee} /> / withholding{' '}
          <MoneyText amount={earning.withholdingAmount} />
        </>
      ),
      detailLine: `${bookingPrefix}payment ${earning.booking?.payment?.method ?? 'UNKNOWN'} / created ${formatDate(
        earning.createdAt,
      )}`,
      detailLineNode: (
        <>
          {bookingPrefix}payment {earning.booking?.payment?.method ?? 'UNKNOWN'} / created{' '}
          <DateTimeText fallback="Missing" value={earning.createdAt} />
        </>
      ),
      id: earning.id,
      settlementNotes: earning.settlementNotes,
      settlementRef: earning.settlementRef,
      smallLabel: earning.paidAt
        ? `Settled ${formatDate(earning.paidAt)}`
        : cashDebt
          ? 'Settlement warning'
          : 'Unpaid',
      smallLabelNode: earning.paidAt ? (
        <>
          Settled <DateTimeText fallback="Missing" value={earning.paidAt} />
        </>
      ) : undefined,
      statusLabel: cashDebt ? 'CASH DEBT' : earning.status,
      title: cashDebt ? (
        <>
          Owes HANDS <MoneyText amount={Math.abs(amountValue(earning.netAmount))} />
        </>
      ) : (
        <>
          Net <MoneyText amount={earning.netAmount} />
        </>
      ),
      walletLines: (earning.walletLedgerEntries ?? []).slice(0, 2).map((entry) => {
        const reference = entry.reference ? ` / ref ${entry.reference}` : '';
        return (
          <>
            Wallet {walletLedgerLabel(entry.type)}:{' '}
            <MoneyText amount={entry.amount} currency={entry.currency ?? earning.currency ?? 'VND'} />
            {reference}
          </>
        );
      }),
    };
  });
}

export function buildPartnerPayoutBatchRows(
  batches: readonly PartnerPayoutBatch[],
): PartnerPayoutBatchRow[] {
  return batches.slice(0, 5).map((batch) => ({
    createdLine: `Created ${formatDate(batch.createdAt)}${
      batch.transferRef ? ` / transfer ${batch.transferRef}` : ''
    }`,
    createdLineNode: (
      <>
        Created <DateTimeText fallback="Missing" value={batch.createdAt} />
        {batch.transferRef ? ` / transfer ${batch.transferRef}` : ''}
      </>
    ),
    href: `/payouts#${batch.id}`,
    id: batch.id,
    operatorEvidence: adminPayoutBatchOperatorEvidenceLines(batch),
    paidLine: batch.paidAt ? `Paid ${formatDate(batch.paidAt)}` : null,
    paidLineNode: batch.paidAt ? (
      <>
        Paid <DateTimeText fallback="Missing" value={batch.paidAt} />
      </>
    ) : undefined,
    status: batch.status,
    totalNetLabel: <MoneyText amount={batch.totalNetAmount} />,
  }));
}

function partnerCashDebtOriginLabel(earning: PartnerEarning) {
  const method = earning.booking?.payment?.method ?? 'CASH';
  if (method === 'CASH') {
    return 'Partner collected customer cash; HANDS fee/tax remains unpaid until deposit or approved offset.';
  }
  return `Negative wallet row needs finance review because payment method is ${method}.`;
}

function partnerCashDebtEvidenceLabel(earning: PartnerEarning) {
  if (earning.settlementRef) {
    return `Ref ${earning.settlementRef}`;
  }
  const ledgerRef = earning.walletLedgerEntries?.find((entry) => entry.reference)?.reference;
  if (ledgerRef) {
    return `Ledger ${ledgerRef}`;
  }
  return 'Evidence needed';
}
