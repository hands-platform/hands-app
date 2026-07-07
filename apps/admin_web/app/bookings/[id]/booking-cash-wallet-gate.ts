import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingFinanceTrace } from './booking-finance-trace';
import { money, providerName, shortId } from './booking-formatters';

export function bookingCashDebtNeedsSettlement(booking: AdminBookingDetail) {
  return (
    booking.payment?.method === 'CASH' &&
    Boolean(booking.earning) &&
    (booking.earning?.netAmount ?? 0) < 0 &&
    booking.earning?.status !== 'PAID'
  );
}

export function bookingCashFeeSettlementPath(
  booking: AdminBookingDetail,
  financeTrace: ReturnType<typeof bookingFinanceTrace>,
) {
  const isCash = financeTrace.paymentMethod === 'CASH';
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const walletEntries = [
    ...(booking.walletLedgerEntries ?? []),
    ...(booking.earning?.walletLedgerEntries ?? []),
  ];
  const taxLogCount = (booking.taxLogs ?? booking.earning?.taxLogs ?? []).length;
  const platformFeeLogCount = (booking.platformFeeLogs ?? booking.earning?.platformFeeLogs ?? []).length;
  const settlementAmount = Math.abs(booking.earning?.netAmount ?? financeTrace.walletTotalAmount ?? 0);
  const settlementRef = `HANDS-CASH-${shortId(booking.id).toUpperCase()}`;
  const selectedPartner = booking.selectedProvider ?? booking.preferredProvider;
  const status = !isCash
    ? 'Non-cash flow'
    : cashDebt
      ? 'Deposit or offset needed'
      : walletEntries.length
        ? 'Cash ledger clear'
        : 'Cash closeout pending';
  const tone = !isCash
    ? 'pill-neutral'
    : cashDebt
      ? 'pill-danger'
      : walletEntries.length
        ? 'pill-success'
        : 'pill-warn';

  return {
    status,
    tone,
    cards: [
      {
        label: 'Payment method',
        value: financeTrace.paymentMethod,
        helper: isCash
          ? 'Partner collected customer cash directly.'
          : 'Customer payment is handled outside the cash-debt path.',
        href: '#payment',
      },
      {
        label: 'HANDS fee due',
        value: financeTrace.platformFee,
        helper: `${financeTrace.withholding} withholding / ${financeTrace.netHandsFee} net HANDS fee.`,
        href: '#finance',
      },
      {
        label: 'Wallet debt',
        value: cashDebt ? money(settlementAmount, financeTrace.currency) : financeTrace.walletLedger,
        helper: cashDebt
          ? 'Final acceptance, service start, and payout release stay blocked until settlement evidence clears this.'
          : 'No active negative wallet block is visible on this booking.',
        href: cashDebt ? '/cash-settlements' : '#finance',
      },
      {
        label: 'Settlement reference',
        value: cashDebt ? settlementRef : 'Not required',
        helper: cashDebt
          ? 'Use this reference for company deposit evidence or admin offset notes.'
          : 'No cash fee deposit reference is needed right now.',
        href: cashDebt ? '/cash-settlements' : '#booking-activity',
      },
    ],
    rows: [
      {
        lane: 'Cash collection source',
        scope: 'Whether the Partner collected customer cash directly.',
        status: isCash ? 'Cash booking' : 'Non-cash',
        tone: isCash ? 'pill-info' : 'pill-neutral',
        evidence: `${financeTrace.paymentMethod} / customer ${financeTrace.customerPrice} / Partner ${
          selectedPartner ? providerName(selectedPartner) : 'not selected'
        }`,
        nextStep: isCash
          ? 'Confirm cash fee accounting after service completion.'
          : 'Use normal payment capture, refund, and payout checks.',
      },
      {
        lane: 'Fee and tax evidence',
        scope: 'Tax, platform fee, VAT/other cost, and withholding records.',
        status:
          taxLogCount || platformFeeLogCount
            ? `${taxLogCount} tax / ${platformFeeLogCount} fee log(s)`
            : 'Logs pending',
        tone: taxLogCount || platformFeeLogCount ? 'pill-info' : 'pill-warn',
        evidence: `${financeTrace.platformFee} HANDS fee / ${financeTrace.feeCosts} / ${financeTrace.withholding}`,
        nextStep:
          'Keep tax and fee policy versioned in Admin; do not hardcode rates in the booking workflow.',
      },
      {
        lane: 'Partner wallet impact',
        scope: 'Wallet impact created by cash settlement or payout closeout.',
        status: cashDebt ? 'Negative wallet' : walletEntries.length ? 'Ledger saved' : 'No ledger row',
        tone: cashDebt ? 'pill-danger' : walletEntries.length ? 'pill-success' : 'pill-warn',
        evidence: `${financeTrace.walletLedger} / ${walletEntries.length} wallet row(s)`,
        nextStep: cashDebt
          ? 'Block final acceptance, service start, and payout release until deposit or approved offset is recorded.'
          : walletEntries.length
            ? 'Keep the wallet row as settlement evidence.'
            : 'Create or inspect wallet impact records during completed closeout.',
      },
      {
        lane: 'Unblock path',
        scope: 'How operations clears a negative wallet state.',
        status: cashDebt ? 'Action required' : 'No active block',
        tone: cashDebt ? 'pill-danger' : 'pill-success',
        evidence: cashDebt
          ? `${settlementRef} / ${money(settlementAmount, financeTrace.currency)} due`
          : 'Final acceptance, service start, and payout release are not blocked by this booking.',
        nextStep: cashDebt
          ? 'Collect company deposit evidence or apply an approved admin offset, then settle the cash debt.'
          : 'No settlement action needed from this booking.',
      },
    ],
  };
}
