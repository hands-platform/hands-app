import type {
  AdminBookingDetail,
  AdminProviderPlatformFeeLog,
  AdminProviderTaxLog,
  AdminProviderWalletLedgerEntry,
} from '../../../lib/admin-api';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { money } from './booking-formatters';
import type { BookingOperatingTimelineItem } from './booking-operating-timeline-items';

type BookingTimelineRefundRow =
  | NonNullable<AdminBookingDetail['refunds']>[number]
  | NonNullable<NonNullable<AdminBookingDetail['payment']>['refunds']>[number];

export function bookingOperatingFinanceTimelineItems(
  booking: AdminBookingDetail,
): BookingOperatingTimelineItem[] {
  const items: BookingOperatingTimelineItem[] = [];
  const paymentCurrency = booking.payment?.currency ?? booking.earning?.currency ?? 'VND';

  if (booking.payment) {
    items.push({
      id: `payment-${booking.payment.id ?? booking.id}`,
      type: 'PAY',
      title: `Payment ${booking.payment.status}`,
      detail: `${booking.payment.method} / ${money(booking.payment.amount, paymentCurrency)} / ${
        booking.payment.providerRef ?? 'no gateway ref'
      }`,
      at: booking.updatedAt ?? booking.createdAt,
      status: booking.payment.status,
    });
  }

  if (booking.earning) {
    items.push({
      id: `earning-${booking.earning.id}`,
      type: 'EARN',
      title: `Partner earning ${booking.earning.status}`,
      detail: `${money(booking.earning.netAmount, booking.earning.currency)} net / ${money(
        booking.earning.platformFee,
        booking.earning.currency,
      )} platform fee.`,
      at: booking.earning.createdAt,
      status: booking.earning.status,
    });
  }

  const refundRows = new Map<string, BookingTimelineRefundRow>();
  for (const refund of [...(booking.refunds ?? []), ...(booking.payment?.refunds ?? [])]) {
    refundRows.set(refund.id, refund);
  }
  for (const refund of refundRows.values()) {
    const refundReason = 'reason' in refund ? refund.reason : null;

    items.push({
      id: `refund-${refund.id}`,
      type: 'REFUND',
      title: `Refund ${refund.status}`,
      detail: `${money(refund.amount, paymentCurrency)} / ${refundReason ?? 'No reason note'}`,
      at: refund.createdAt,
      status: refund.status,
    });
  }

  if (bookingCashDebtNeedsSettlement(booking)) {
    items.push({
      id: `cash-debt-${booking.earning?.id ?? booking.id}`,
      type: 'CASH',
      title: 'Cash fee debt blocks finalization gates',
      detail:
        'Partner collected customer cash. Company fee must be deposited or admin-offset before final acceptance, service start, and payout release.',
      at: booking.earning?.createdAt ?? booking.updatedAt ?? booking.createdAt,
      status: 'Settlement needed',
    });
  }

  const taxLogs = new Map<string, AdminProviderTaxLog>();
  for (const taxLog of [...(booking.taxLogs ?? []), ...(booking.earning?.taxLogs ?? [])]) {
    taxLogs.set(taxLog.id, taxLog);
  }
  for (const taxLog of taxLogs.values()) {
    items.push({
      id: `tax-${taxLog.id}`,
      type: 'TAX',
      title: 'Tax withholding logged',
      detail: `${money(taxLog.withholdingAmount, taxLog.currency)} withheld from ${money(
        taxLog.taxableAmount,
        taxLog.currency,
      )} taxable amount.`,
      at: taxLog.createdAt,
      status: 'Logged',
    });
  }

  const feeLogs = new Map<string, AdminProviderPlatformFeeLog>();
  for (const feeLog of [...(booking.platformFeeLogs ?? []), ...(booking.earning?.platformFeeLogs ?? [])]) {
    feeLogs.set(feeLog.id, feeLog);
  }
  for (const feeLog of feeLogs.values()) {
    items.push({
      id: `fee-${feeLog.id}`,
      type: 'FEE',
      title: 'Platform fee logged',
      detail: `${money(feeLog.platformFeeAmount, feeLog.currency)} company fee from ${money(
        feeLog.grossAmount,
        feeLog.currency,
      )} gross.`,
      at: feeLog.createdAt,
      status: 'Logged',
    });
  }

  const walletEntries = new Map<string, AdminProviderWalletLedgerEntry>();
  for (const walletEntry of [
    ...(booking.walletLedgerEntries ?? []),
    ...(booking.earning?.walletLedgerEntries ?? []),
  ]) {
    walletEntries.set(walletEntry.id, walletEntry);
  }
  for (const walletEntry of walletEntries.values()) {
    items.push({
      id: `wallet-${walletEntry.id}`,
      type: 'WALLET',
      title: `Wallet ${walletEntry.type}`,
      detail: `${money(walletEntry.amount, walletEntry.currency)} / ${walletEntry.notes ?? walletEntry.sourceKey}`,
      at: walletEntry.createdAt,
      status: walletEntry.type,
    });
  }

  return items;
}
