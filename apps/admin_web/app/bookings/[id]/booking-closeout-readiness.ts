import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import type { AttentionFlag } from '../../../lib/admin-attention-flags';
import { bookingProviderLocationMetricHelper } from '../../../lib/booking-provider-location-copy';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { bookingChatReady } from './booking-chat-evidence';
import {
  bookingAddressSnapshotLabel,
  money,
} from './booking-formatters';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';

type CloseoutReadinessInput = {
  readonly booking: AdminBookingDetail;
  readonly financeFlags: readonly AttentionFlag[];
  readonly latestLocation?: AdminLocationSnapshot;
  readonly messageCount: number;
  readonly notificationCount: number;
};

type CloseoutReadinessItem = {
  readonly id: string;
  readonly label: string;
  readonly status: string;
  readonly detail: string;
  readonly owner: string;
  readonly href: string;
  readonly ready: boolean;
};

export function bookingCloseoutReadiness({
  booking,
  financeFlags,
  latestLocation,
  messageCount,
  notificationCount,
}: CloseoutReadinessInput) {
  const terminalStatus = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(
    booking.status,
  );
  const activeStatus = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);
  const finalPartner = bookingFinalPartnerSummary(booking);
  const hasAddress =
    Boolean(booking.addressSnapshot) || (booking.lat !== undefined && booking.lng !== undefined);
  const hasFinanceCloseout =
    booking.status !== 'COMPLETED' ||
    Boolean(
      booking.earning &&
        (booking.earning.taxLogs?.length ?? booking.taxLogs?.length ?? 0) > 0 &&
        (booking.earning.platformFeeLogs?.length ?? booking.platformFeeLogs?.length ?? 0) > 0 &&
        (booking.earning.walletLedgerEntries?.length ?? booking.walletLedgerEntries?.length ?? 0) > 0,
    );
  const paymentNeedsRelease = ['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status);
  const paymentReady =
    !booking.payment ||
    (booking.status === 'COMPLETED'
      ? ['CAPTURED', 'PAID', 'SETTLED'].includes(booking.payment.status) || booking.payment.method === 'CASH'
      : paymentNeedsRelease
        ? ['RELEASED', 'REFUNDED', 'VOIDED', 'CANCELLED'].includes(booking.payment.status)
        : true);
  const cashDebtNeedsSettlement = bookingCashDebtNeedsSettlement(booking);
  const partnerChoiceReady =
    booking.status === 'CREATED' ||
    booking.status === 'OPEN_MATCHING' ||
    finalPartner.selected ||
    ['CANCELLED', 'EXPIRED'].includes(booking.status);
  const chatReady = !activeStatus && !terminalStatus ? true : bookingChatReady(booking);
  const locationReady = !activeStatus || Boolean(latestLocation);
  const auditReady = (booking.auditLogs?.length ?? 0) > 0 || (booking.opsTasks?.length ?? 0) > 0;

  const items: CloseoutReadinessItem[] = [
    {
      id: 'customer-record',
      label: 'Customer',
      status:
        booking.customerProfile?.id && hasAddress
          ? 'Customer and address linked'
          : 'Customer/address needs review',
      detail: `${booking.customerProfile?.user?.fullName ?? 'Customer'} / ${
        booking.customerProfile?.user?.phone ?? 'No phone'
      } / ${hasAddress ? bookingAddressSnapshotLabel(booking) : 'No confirmed service address'}`,
      owner: 'Support',
      href: '#customer',
      ready: Boolean(booking.customerProfile?.id && hasAddress),
    },
    {
      id: 'partner-choice',
      label: 'Partner',
      status: partnerChoiceReady ? 'Partner choice state explainable' : 'Final Partner missing',
      detail: finalPartner.selected
        ? `${finalPartner.label} / ${booking.participants?.length ?? 0} participant(s)`
        : 'Customer has not selected a final Partner yet.',
      owner: 'Dispatch',
      href: '#participants',
      ready: partnerChoiceReady,
    },
    {
      id: 'chat-record',
      label: 'Chat',
      status: chatReady ? 'Chat record valid' : 'Chat record missing',
      detail: booking.chatRoom
        ? `${messageCount} retained message(s). Chat record remains available after mobile chat is hidden.`
        : 'Matched, active, or closed service records should keep the admin transcript.',
      owner: 'Support',
      href: '#chat',
      ready: chatReady,
    },
    {
      id: 'payment-state',
      label: 'Payment',
      status: paymentReady ? 'Payment path aligned' : 'Payment closeout pending',
      detail: booking.payment
        ? `${booking.payment.method} / ${booking.payment.status} / ${money(
            booking.payment.amount,
            booking.payment.currency,
          )}`
        : 'No payment record is linked.',
      owner: 'Finance',
      href: '#payment',
      ready: paymentReady,
    },
    {
      id: 'finance-ledger',
      label: 'Finance',
      status: hasFinanceCloseout && financeFlags.length === 0 ? 'Ledger complete' : 'Ledger needs review',
      detail:
        booking.status === 'COMPLETED'
          ? `Earning ${booking.earning?.status ?? 'missing'} / ${financeFlags.length} finance check(s).`
          : 'Finance ledger becomes mandatory after completion.',
      owner: 'Finance',
      href: '#finance',
      ready: hasFinanceCloseout && financeFlags.length === 0,
    },
    {
      id: 'cash-settlement',
      label: 'Cash',
      status: cashDebtNeedsSettlement ? 'Cash fee settlement required' : 'No cash fee block',
      detail: cashDebtNeedsSettlement
        ? 'Partner cash collection created company-fee debt; settle before final acceptance, service start, or payout release.'
        : 'No negative cash-fee wallet block is active for this booking.',
      owner: 'Finance',
      href: '#finance',
      ready: !cashDebtNeedsSettlement,
    },
    {
      id: 'location-signal',
      label: 'Location',
      status: locationReady ? 'Location state valid' : 'Partner location missing',
      detail: latestLocation
        ? `${latestLocationLabel(latestLocation)} / ${bookingProviderLocationMetricHelper(latestLocation.recordedAt)}`
        : 'No Partner service location is saved for this active booking.',
      owner: 'Dispatch',
      href: '#location',
      ready: locationReady,
    },
    {
      id: 'alerts-audit',
      label: 'Audit',
      status: auditReady ? 'Operator trail available' : 'No operator trail yet',
      detail: `${notificationCount} notification(s), ${booking.auditLogs?.length ?? 0} audit row(s), ${
        booking.opsTasks?.length ?? 0
      } structured task(s).`,
      owner: 'Operations',
      href: '#booking-activity',
      ready: auditReady,
    },
  ];

  const openItems = items.filter((item) => !item.ready);
  const status =
    openItems.length === 0
      ? 'Ready'
      : terminalStatus || booking.status === 'COMPLETED'
        ? `${openItems.length} closeout item(s)`
        : `${openItems.length} monitor item(s)`;
  const tone =
    openItems.length === 0
      ? 'pill-success'
      : openItems.some((item) => ['Payment', 'Finance', 'Cash'].includes(item.label))
        ? 'pill-warn'
        : 'pill-info';

  return {
    status,
    tone,
    helper:
      openItems.length === 0
        ? 'All factual records needed for this booking stage are aligned.'
        : `${openItems.map((item) => item.label).join(', ')} should be checked before the next handoff or closeout.`,
    items,
    openItems,
  };
}

function latestLocationLabel(latestLocation: AdminLocationSnapshot) {
  const address = readAddressText(latestLocation);
  return address ? serviceAddressAreaLabel(address) : 'Location recorded without readable address';
}
