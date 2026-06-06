import type { AdminBookingDetail } from '../../../lib/admin-api';
import { formatDistanceMeters } from '../../../lib/admin-format';
import { bookingFinanceTrace } from './booking-finance-trace';
import { providerName } from './booking-formatters';
import { bookingBackupPartnerSupply } from './booking-marketplace-supply';
import { bookingNotificationTrace } from './booking-notification-trace';
import {
  bookingPreferredProviderId,
  isCustomerSelectableParticipantForFinalChoice,
} from './booking-participant-rules';

export function bookingMarketplaceWalletEvidence({
  booking,
  backupSupply,
  financeTrace,
  notificationTrace,
  walletDebt,
}: {
  booking: AdminBookingDetail;
  backupSupply: ReturnType<typeof bookingBackupPartnerSupply>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  walletDebt: boolean;
}) {
  const participants = booking.participants ?? [];
  const acceptedParticipants = participants.filter((participant) => participant.status === 'ACCEPTED');
  const customerChoiceCandidates = participants.filter((participant) =>
    isCustomerSelectableParticipantForFinalChoice(participant, bookingPreferredProviderId(booking)),
  );
  const rejectedParticipants = participants.filter((participant) => participant.status === 'REJECTED');
  const selectedParticipants = participants.filter((participant) => participant.status === 'SELECTED');
  const finalPartner = booking.selectedProvider;
  const marketplaceAlerts = notificationTrace.backupBatches.length;
  const excludedMarketplaceRows = backupSupply.rows.filter((row) => !row.eligible).length;
  const status = finalPartner
    ? 'Final choice recorded'
    : customerChoiceCandidates.length
      ? 'Customer choice pending'
      : participants.length
        ? 'Participating partners visible'
        : 'Waiting for participation';
  const tone = finalPartner
    ? 'pill-success'
    : customerChoiceCandidates.length
      ? 'pill-warn'
      : participants.length
        ? 'pill-info'
        : 'pill-neutral';

  return {
    status,
    tone,
    cards: [
      {
        label: 'Actual participants',
        value: `${participants.length} participant row(s)`,
        helper: `${acceptedParticipants.length} accepted / ${rejectedParticipants.length} rejected / ${selectedParticipants.length} selected row(s).`,
        href: '#participants',
      },
      {
        label: 'Customer final choice',
        value: finalPartner ? providerName(finalPartner) : 'Not selected',
        helper: finalPartner
          ? 'Customer-selected final partner is stored on this booking.'
          : 'Operators do not auto-assign; customer choice is still required.',
        href: finalPartner?.id ? `/partners/${finalPartner.id}` : '#participants',
      },
      {
        label: 'Marketplace policy',
        value: formatDistanceMeters(backupSupply.radiusMeters),
        helper: `${backupSupply.eligibleCount} currently eligible partner(s) by booking address.`,
        href: '#marketplace-supply',
      },
      {
        label: 'Marketplace alerts',
        value: `${marketplaceAlerts} batch(es)`,
        helper: `${notificationTrace.rows.filter((row) => row.isPartnerAlert).length} partner alert row(s).`,
        href: '#alerts',
      },
      {
        label: 'Wallet gate',
        value: walletDebt ? 'Settlement needed' : 'Clear',
        helper: walletDebt
          ? 'Cash-fee debt blocks marketplace participation and payout release.'
          : 'No active cash-fee wallet block is visible for this booking.',
        href: walletDebt ? '/cash-settlements' : '#finance',
      },
      {
        label: 'HANDS fee origin',
        value: financeTrace.platformFee,
        helper:
          financeTrace.paymentMethod === 'CASH'
            ? `${financeTrace.walletLedger} wallet impact from cash collection.`
            : `${financeTrace.providerPayout} partner payout for non-cash flow.`,
        href: '#finance',
      },
    ],
    commandStrip: [
      {
        label: 'Participant evidence boundary',
        value: `${participants.length} actual row(s)`,
        helper:
          'Only partners who entered the booking are retained here; view-only wallet blocks are excluded before participant creation.',
        href: '#participants',
      },
      {
        label: 'Customer final partner',
        value: finalPartner ? providerName(finalPartner) : 'Pending customer choice',
        helper:
          'No automatic assignment. The final partner must come from the customer selection record.',
        href: finalPartner?.id ? `/partners/${finalPartner.id}` : '#participants',
      },
      {
        label: 'Chat evidence handoff',
        value: booking.chatRoom
          ? `${booking.chatRoom.messages?.length ?? 0} retained message(s)`
          : finalPartner
            ? 'Chat missing'
            : 'Not opened yet',
        helper:
          'Chat opens after customer final selection and stays retained in Admin even when mobile hides completed-service chat.',
        href: '#chat',
      },
      {
        label: 'Wallet/cash fee gate',
        value: walletDebt ? 'Participation blocked' : 'Gate clear',
        helper: walletDebt
          ? 'Cash-fee debt blocks marketplace participation before a participant row can be created.'
          : 'No active cash-fee wallet block is attached to this booking evidence.',
        href: walletDebt ? '/cash-settlements' : '#finance',
      },
    ],
    rows: [
      {
        lane: 'Participation ledger',
        scope: 'Only actual participating, accepted, rejected, or final partner rows are stored as participants.',
        status: `${participants.length} participant row(s)`,
        tone: participants.length ? 'pill-info' : 'pill-neutral',
        record: participants.length
          ? participants
              .slice(0, 4)
              .map((participant) => `${providerName(participant.providerProfile)} ${participant.status}`)
              .join(' / ')
          : 'No partner participation has been recorded for this booking yet.',
        operatorUse:
          'Use this lane to confirm who actually entered the customer choice list. Wallet-blocked view attempts are not stored here.',
      },
      {
        lane: 'Marketplace reach',
        scope: 'Booking address is the source of truth for distance-based participation.',
        status: `${backupSupply.eligibleCount} eligible`,
        tone: backupSupply.eligibleCount ? 'pill-success' : 'pill-warn',
        record: `${formatDistanceMeters(backupSupply.radiusMeters)} radius / ${
          excludedMarketplaceRows
        } excluded by current evidence.`,
        operatorUse:
          'Use this lane to explain why marketplace partner supply is available or why operations may need location/policy review.',
      },
      {
        lane: 'Customer final choice',
        scope: 'HANDS does not automatically assign the final partner.',
        status: finalPartner ? 'Recorded' : customerChoiceCandidates.length ? 'Pending' : 'Waiting',
        tone: finalPartner ? 'pill-success' : customerChoiceCandidates.length ? 'pill-warn' : 'pill-info',
        record: finalPartner
          ? providerName(finalPartner)
          : `${customerChoiceCandidates.length} customer-selectable partner(s), ${participants.length} participant row(s).`,
        operatorUse:
          'Use this lane to confirm that the customer, not the system, created the final match before chat and service handoff.',
      },
      {
        lane: 'Wallet participation gate',
        scope:
          'Negative partner wallet keeps marketplace demand visible but blocks marketplace participation before the join is recorded.',
        status: walletDebt ? 'Settlement needed' : 'Clear',
        tone: walletDebt ? 'pill-danger' : 'pill-success',
        record: financeTrace.walletLedger,
        operatorUse: walletDebt
          ? 'Partner app message: Unpaid HANDS fees must be settled before you can participate in this marketplace booking. Collect the HANDS fee deposit or apply an approved offset before this partner can participate in new marketplace bookings.'
          : 'Partner app message: Unpaid HANDS fees must be settled before you can participate in this marketplace booking. No cash-fee wallet debt from this booking is currently gating marketplace participation.',
      },
      {
        lane: 'Cash fee accounting',
        scope: 'Cash bookings can create partner wallet debt because the partner collects customer cash directly.',
        status:
          financeTrace.paymentMethod === 'CASH'
            ? walletDebt
              ? 'Debt open'
              : 'Cash ledger clear'
            : 'Non-cash',
        tone:
          financeTrace.paymentMethod === 'CASH'
            ? walletDebt
              ? 'pill-danger'
              : 'pill-success'
            : 'pill-neutral',
        record: `${financeTrace.platformFee} HANDS fee / ${financeTrace.withholding} withholding / ${financeTrace.netHandsFee} net fee.`,
        operatorUse:
          'Use this lane with cash settlement records to explain why wallet balance changed and what must be settled.',
      },
    ],
  };
}
