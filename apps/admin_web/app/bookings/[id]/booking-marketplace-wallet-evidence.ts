import type { AdminBookingDetail } from '../../../lib/admin-api';
import { formatDistanceMeters } from '../../../lib/admin-format';
import { bookingFinanceTrace } from './booking-finance-trace';
import { providerName } from './booking-formatters';
import { bookingMarketplacePartnerSupply } from './booking-marketplace-supply';
import { bookingNotificationTrace } from './booking-notification-trace';
import {
  bookingCustomerSelectableParticipantsForFinalChoice,
} from './booking-participant-rules';

export function bookingMarketplaceWalletEvidence({
  booking,
  marketplaceSupply,
  financeTrace,
  notificationTrace,
  walletDebt,
}: {
  booking: AdminBookingDetail;
  marketplaceSupply: ReturnType<typeof bookingMarketplacePartnerSupply>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  walletDebt: boolean;
}) {
  const participants = booking.participants ?? [];
  const acceptedParticipants = participants.filter((participant) => participant.status === 'ACCEPTED');
  const customerChoiceCandidates = bookingCustomerSelectableParticipantsForFinalChoice(booking);
  const rejectedParticipants = participants.filter((participant) => participant.status === 'REJECTED');
  const selectedParticipants = participants.filter((participant) => participant.status === 'SELECTED');
  const finalPartner = booking.selectedProvider;
  const marketplaceAlerts = notificationTrace.backupBatches.length;
  const excludedMarketplaceRows = marketplaceSupply.rows.filter((row) => !row.eligible).length;
  const status = finalPartner
    ? 'Final choice recorded'
    : customerChoiceCandidates.length
      ? 'Customer choice pending'
      : participants.length
        ? 'Participating Partners visible'
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
          ? 'Customer-selected final Partner is stored on this booking.'
          : 'Operators do not auto-assign; customer choice is still required.',
        href: finalPartner?.id ? `/partners/${finalPartner.id}` : '#participants',
      },
      {
        label: 'Marketplace policy',
        value: formatDistanceMeters(marketplaceSupply.radiusMeters),
        helper: `${marketplaceSupply.eligibleCount} currently eligible Partner(s) by booking address.`,
        href: '#marketplace-supply',
      },
      {
        label: 'Marketplace alerts',
        value: `${marketplaceAlerts} batch(es)`,
        helper: `${notificationTrace.rows.filter((row) => row.isPartnerAlert).length} Partner alert row(s).`,
        href: '#alerts',
      },
      {
        label: 'Wallet gate',
        value: walletDebt ? 'Settlement needed' : 'Clear',
        helper: walletDebt
          ? 'Cash-fee debt blocks final acceptance, service start, and payout release.'
          : 'No active cash-fee wallet block is visible for this booking.',
        href: walletDebt ? '/cash-settlements' : '#finance',
      },
      {
        label: 'HANDS fee origin',
        value: financeTrace.platformFee,
        helper:
          financeTrace.paymentMethod === 'CASH'
            ? `${financeTrace.walletLedger} wallet impact from cash collection.`
            : `${financeTrace.providerPayout} Partner payout for non-cash flow.`,
        href: '#finance',
      },
    ],
    commandStrip: [
      {
        label: 'Participant evidence boundary',
        value: `${participants.length} actual row(s)`,
        helper:
          'Only Partners who entered the booking are retained here; marketplace visibility is not an activity record.',
        href: '#participants',
      },
      {
        label: 'Customer final Partner',
        value: finalPartner ? providerName(finalPartner) : 'Pending customer choice',
        helper:
          'No automatic assignment. The final Partner must come from the customer selection record.',
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
        value: walletDebt ? 'Settlement gate active' : 'Gate clear',
        helper: walletDebt
          ? 'Cash-fee debt blocks final acceptance and service start while participant rows remain visible.'
          : 'No active cash-fee wallet block is attached to this booking evidence.',
        href: walletDebt ? '/cash-settlements' : '#finance',
      },
    ],
    rows: [
      {
        lane: 'Participation ledger',
        scope: 'Only actual participating, accepted, rejected, or final Partner rows are stored as participants.',
        status: `${participants.length} participant row(s)`,
        tone: participants.length ? 'pill-info' : 'pill-neutral',
        record: participants.length
          ? participants
              .slice(0, 4)
              .map((participant) => `${providerName(participant.providerProfile)} ${participant.status}`)
              .join(' / ')
          : 'No Partner participation has been recorded for this booking yet.',
        operatorUse:
          'Use this lane to confirm who actually entered the customer choice list. Wallet-blocked view attempts are not stored here.',
      },
      {
        lane: 'Marketplace reach',
        scope: 'Confirmed service address controls distance-based participation.',
        status: `${marketplaceSupply.eligibleCount} eligible`,
        tone: marketplaceSupply.eligibleCount ? 'pill-success' : 'pill-warn',
        record: `${formatDistanceMeters(marketplaceSupply.radiusMeters)} radius / ${
          excludedMarketplaceRows
        } excluded by current evidence.`,
        operatorUse:
          'Use this lane to explain why marketplace Partner supply is available or why operations may need location/policy review.',
      },
      {
        lane: 'Customer final choice',
        scope: 'HANDS does not automatically assign the final Partner.',
        status: finalPartner ? 'Recorded' : customerChoiceCandidates.length ? 'Pending' : 'Waiting',
        tone: finalPartner ? 'pill-success' : customerChoiceCandidates.length ? 'pill-warn' : 'pill-info',
        record: finalPartner
          ? providerName(finalPartner)
          : `${customerChoiceCandidates.length} customer-selectable Partner(s), ${participants.length} participant row(s).`,
        operatorUse:
          'Use this lane to confirm that the customer, not the system, created the final match before chat and service handoff.',
      },
      {
        lane: 'Wallet settlement gate',
        scope:
          'Negative Partner wallet keeps marketplace requests visible and participation open, but final acceptance and service start wait for settlement.',
        status: walletDebt ? 'Settlement needed' : 'Clear',
        tone: walletDebt ? 'pill-danger' : 'pill-success',
        record: financeTrace.walletLedger,
        operatorUse: walletDebt
          ? 'Partner app message: Unpaid HANDS fees must be settled before final acceptance or service start. Collect the HANDS fee deposit or apply an approved offset before final acceptance, service start, or payout release.'
          : 'No active cash-fee wallet debt from this booking is currently gating final acceptance or service start.',
      },
      {
        lane: 'Cash fee accounting',
        scope: 'Cash bookings can create Partner wallet debt because the Partner collects customer cash directly.',
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
