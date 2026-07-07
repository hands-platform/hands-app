import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import type { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { formatDate, shortId } from './booking-formatters';
import type { OperatingLedgerRow } from './booking-operating-sections';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';

export type BookingDetailOperatingLedgerInput = {
  booking: AdminBookingDetail;
  finalPartnerSummary: ReturnType<typeof bookingFinalPartnerSummary>;
  participantCounts: {
    marketplace: number;
    total: number;
  };
  messageCount: number;
  paymentEvidence: {
    paymentStatus: string;
    readablePaymentMethodAmountLabel: string;
    refundRecordStatus: string;
    refundEvidence: string;
  };
  financeTrace: {
    customerPrice: string;
    platformFee: string;
    providerPayout: string;
    payoutRuleStatus: string;
    serviceOption: string;
    walletLedger: string;
    withholding: string;
  };
  financeFlagCount: number;
  latestLocation: AdminLocationSnapshot | null;
  addressPin: string;
  notificationTrace: {
    rows: ReadonlyArray<{ isPartnerAlert: boolean }>;
    backupBatches: readonly unknown[];
  };
  activityRecordCount: number;
  operatorNoteLines: readonly string[];
  closureSummary: {
    detail: string;
    status: string;
  };
};

export function bookingDetailOperatingLedger({
  booking,
  finalPartnerSummary,
  participantCounts,
  messageCount,
  paymentEvidence,
  financeTrace,
  financeFlagCount,
  latestLocation,
  addressPin,
  notificationTrace,
  activityRecordCount,
  operatorNoteLines,
  closureSummary,
}: BookingDetailOperatingLedgerInput): OperatingLedgerRow[] {
  const refundLedgerEvidence =
    paymentEvidence.refundRecordStatus === 'No refund record'
      ? 'No refund ledger row.'
      : paymentEvidence.refundEvidence;

  return [
    {
      area: 'Customer',
      status: booking.customerProfile?.id ? 'Linked' : 'Missing profile',
      evidence: `${booking.customerProfile?.user?.fullName ?? 'Customer'} / ${
        booking.customerProfile?.user?.phone ?? 'No phone'
      }`,
      href: '#customer',
    },
    {
      area: 'Partner',
      status: finalPartnerSummary.selected ? 'Linked' : 'Not selected',
      evidence: finalPartnerSummary.selected
        ? finalPartnerSummary.label
        : `${participantCounts.marketplace} marketplace / ${participantCounts.total} total participant row(s)`,
      href: '#handoff',
    },
    {
      area: 'Chat',
      status: booking.chatRoom ? 'Archived' : 'Missing',
      evidence: booking.chatRoom
        ? `Room ${shortId(booking.chatRoom.id)} / ${messageCount} message(s)`
        : 'Matched bookings should create a retained chat room.',
      href: '#chat',
    },
    {
      area: 'Service/Pricing',
      status: financeTrace.payoutRuleStatus,
      evidence: `${financeTrace.serviceOption} / customer ${financeTrace.customerPrice} / Partner ${financeTrace.providerPayout}`,
      href: '#service',
    },
    {
      area: 'Payment',
      status: paymentEvidence.paymentStatus,
      evidence: paymentEvidence.readablePaymentMethodAmountLabel,
      href: '#payment',
    },
    {
      area: 'Refund',
      status: paymentEvidence.refundRecordStatus,
      evidence: refundLedgerEvidence,
      href: '#payment',
    },
    {
      area: 'Finance',
      status: financeFlagCount ? `${financeFlagCount} check(s)` : 'Trace ready',
      evidence: `${financeTrace.providerPayout} Partner payout / ${financeTrace.platformFee} platform fee`,
      href: '#finance',
    },
    {
      area: 'Tax',
      status: (booking.taxLogs?.length ?? booking.earning?.taxLogs?.length ?? 0) ? 'Logged' : 'Not logged',
      evidence: financeTrace.withholding,
      href: '#finance',
    },
    {
      area: 'Wallet',
      status: bookingCashDebtNeedsSettlement(booking) ? 'Settlement needed' : 'No cash debt block',
      evidence: financeTrace.walletLedger,
      href: '#finance',
    },
    {
      area: 'Cash settlement',
      status: bookingCashDebtNeedsSettlement(booking)
        ? 'Partner blocked until settled'
        : booking.payment?.method === 'CASH'
          ? 'Cash ledger clear'
          : 'Not a cash booking',
      evidence:
        booking.payment?.method === 'CASH'
          ? `${financeTrace.platformFee} HANDS fee / ${financeTrace.withholding} withholding`
          : `${booking.payment?.method ?? 'No method'} payment path`,
      href: '#payment',
    },
    {
      area: 'Location',
      status: latestLocation ? 'Partner location saved' : 'No Partner location',
      evidence: latestLocation
        ? `${latestLocationLabel(latestLocation)} / ${formatDate(latestLocation.recordedAt)}`
        : serviceAddressFallbackLabel(addressPin),
      href: '#location',
    },
    {
      area: 'Alerts',
      status: `${notificationTrace.rows.length} notification(s)`,
      evidence: `${notificationTrace.rows.filter((row) => row.isPartnerAlert).length} Partner alert(s) / ${
        notificationTrace.backupBatches.length
      } marketplace alert batch(es)`,
      href: '#alerts',
    },
    {
      area: 'Audit',
      status: `${activityRecordCount} event(s)`,
      evidence: `${booking.auditLogs?.length ?? 0} audit row(s) / ${booking.opsTasks?.length ?? 0} task row(s)`,
      href: '#booking-activity',
    },
    {
      area: 'Operator notes',
      status: operatorNoteLines.length ? `${operatorNoteLines.length} note line(s)` : 'No notes',
      evidence: operatorNoteLines[operatorNoteLines.length - 1] ?? 'No internal handling note has been added.',
      href: '#operator-notes',
    },
    {
      area: 'Closure',
      status: closureSummary.status,
      evidence: closureSummary.detail,
      href: '#booking-activity',
    },
  ];
}

function latestLocationLabel(latestLocation: AdminLocationSnapshot) {
  const address = readAddressText(latestLocation);
  return address ? serviceAddressAreaLabel(address) : 'Location recorded without readable address';
}

function serviceAddressFallbackLabel(addressPin: string) {
  const address = readAddressText(addressPin);
  if (address) {
    return serviceAddressAreaLabel(address);
  }

  return addressPin === 'No pin' ? 'No service address location' : 'Service address record saved';
}
