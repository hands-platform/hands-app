import { participantChatHandoffState } from './admin-participant-chat-handoff';
import { participantDistancePolicy } from './admin-distance-policy';
import { participantChoicePresentation } from './admin-participant-ledger-copy';
import { formatDistanceMeters } from './admin-format';

const CHAT_REQUIRED_BOOKING_STATUSES = new Set([
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
  'COMPLETED',
]);

export type MarketplaceParticipantLedgerSummaryRow = {
  readonly choiceLabel: string;
  readonly roleLabel: string;
  readonly statusLabel: string;
};

export type MarketplaceParticipantLedgerSummary = ReturnType<typeof buildMarketplaceParticipantLedgerSummary>;

export type MarketplaceParticipantLedgerPill = {
  readonly label: string;
  readonly tone: 'pill-info' | 'pill-success' | 'pill-warn';
};

export type MarketplaceParticipantLedgerRowInput<TBooking, TParticipant> = {
  readonly alertLabel: string;
  readonly alertTone: string;
  readonly booking: TBooking;
  readonly bookingStatus: string;
  readonly customerSelectable: boolean;
  readonly distanceMeters: number | null;
  readonly hasChatRoom: boolean;
  readonly joinedLabel: string;
  readonly marketplaceRadiusMeters: number;
  readonly participant: TParticipant;
  readonly participantPartnerId: string | null;
  readonly partnerLabel: string;
  readonly preferredPartnerId: string | null;
  readonly respondedLabel: string;
  readonly selectedPartnerId: string | null;
  readonly sortTimestamp: number;
  readonly status: string;
  readonly walletLabel: string;
  readonly walletTone: string;
  readonly windowLabel: string;
};

export type MarketplaceParticipantLedgerRow<TBooking, TParticipant> = {
  readonly alertLabel: string;
  readonly alertTone: string;
  readonly booking: TBooking;
  readonly chatHandoffLabel: string;
  readonly chatHandoffTone: string;
  readonly choiceLabel: string;
  readonly choiceNextStep: string;
  readonly choiceReason: string;
  readonly choiceTone: string;
  readonly distanceLabel: string;
  readonly distancePolicyHelper: string;
  readonly distancePolicyLabel: string;
  readonly distancePolicyTone: string;
  readonly evidenceDetail: string;
  readonly evidenceLabel: string;
  readonly evidenceTone: string;
  readonly joinedLabel: string;
  readonly participant: TParticipant;
  readonly partnerLabel: string;
  readonly respondedLabel: string;
  readonly roleLabel: string;
  readonly statusLabel: string;
  readonly statusTone: string;
  readonly walletLabel: string;
  readonly walletTone: string;
  readonly windowLabel: string;
};

export function buildMarketplaceParticipantLedgerSummary(
  rows: readonly MarketplaceParticipantLedgerSummaryRow[],
) {
  return {
    declined: rows.filter((row) => row.statusLabel === 'Declined').length,
    firstPick: rows.filter((row) => row.roleLabel === 'First-pick Partner').length,
    marketplace: rows.filter((row) => row.roleLabel === 'Marketplace participant').length,
    selected: rows.filter((row) => row.choiceLabel === 'Selected by customer').length,
    total: rows.length,
    waitingChoice: rows.filter((row) => row.choiceLabel === 'Customer-selectable').length,
  };
}

export function buildMarketplaceParticipantLedgerPills(
  summary: MarketplaceParticipantLedgerSummary,
): readonly MarketplaceParticipantLedgerPill[] {
  return [
    { label: `First-pick Partners ${summary.firstPick}`, tone: 'pill-info' },
    { label: `Marketplace participants ${summary.marketplace}`, tone: 'pill-info' },
    { label: `Selected marketplace Partner ${summary.selected}`, tone: 'pill-success' },
    { label: `Waiting customer choice ${summary.waitingChoice}`, tone: 'pill-warn' },
    { label: `Declined responses ${summary.declined}`, tone: 'pill-info' },
  ];
}

export function buildMarketplaceParticipantLedgerRows<TBooking, TParticipant>(
  inputs: readonly MarketplaceParticipantLedgerRowInput<TBooking, TParticipant>[],
): readonly MarketplaceParticipantLedgerRow<TBooking, TParticipant>[] {
  return inputs
    .map(toLedgerRow)
    .sort((left, right) => {
      if (left.choiceLabel === 'Selected by customer' && right.choiceLabel !== 'Selected by customer') {
        return -1;
      }
      if (right.choiceLabel === 'Selected by customer' && left.choiceLabel !== 'Selected by customer') {
        return 1;
      }
      return right.sortTimestamp - left.sortTimestamp;
    })
    .map(toPublicLedgerRow);
}

type SortableMarketplaceParticipantLedgerRow<TBooking, TParticipant> =
  MarketplaceParticipantLedgerRow<TBooking, TParticipant> & {
    readonly sortTimestamp: number;
  };

function toLedgerRow<TBooking, TParticipant>(
  input: MarketplaceParticipantLedgerRowInput<TBooking, TParticipant>,
): SortableMarketplaceParticipantLedgerRow<TBooking, TParticipant> {
  const isPreferred = Boolean(
    input.participantPartnerId && input.participantPartnerId === input.preferredPartnerId,
  );
  const isFinal = Boolean(input.selectedPartnerId && input.participantPartnerId === input.selectedPartnerId);
  const finalPartnerRecorded = Boolean(input.selectedPartnerId);
  const distancePolicy = participantDistancePolicy(input.distanceMeters, input.marketplaceRadiusMeters);
  const choice = participantChoicePresentation({
    anotherFinalPartnerSelected: Boolean(input.selectedPartnerId && !isFinal),
    customerSelectable: input.customerSelectable,
    isFinal,
    isPreferred,
    status: input.status,
  });
  const chatHandoff = participantChatHandoffState({
    chatRequired: finalPartnerRecorded || CHAT_REQUIRED_BOOKING_STATUSES.has(input.bookingStatus),
    customerSelectable: input.customerSelectable,
    finalPartnerRecorded,
    hasChatRoom: input.hasChatRoom,
    isFinal,
    status: input.status,
  });

  return {
    alertLabel: input.alertLabel,
    alertTone: input.alertTone,
    booking: input.booking,
    chatHandoffLabel: chatHandoff.label,
    chatHandoffTone: chatHandoff.tone,
    choiceLabel: choice.choiceLabel,
    choiceNextStep: choice.choiceNextStep,
    choiceReason: choice.choiceReason,
    choiceTone: choice.choiceTone,
    distanceLabel: formatDistanceMeters(input.distanceMeters),
    distancePolicyHelper: distancePolicy.helper,
    distancePolicyLabel: distancePolicy.label,
    distancePolicyTone: distancePolicy.tone,
    ...marketplaceParticipantEvidenceState(input.status, input.participantPartnerId, input.preferredPartnerId, isFinal),
    joinedLabel: input.joinedLabel,
    participant: input.participant,
    partnerLabel: input.partnerLabel,
    respondedLabel: input.respondedLabel,
    roleLabel: isPreferred ? 'First-pick Partner' : 'Marketplace participant',
    sortTimestamp: input.sortTimestamp,
    statusLabel: marketplaceParticipantStatusLabel(input.status),
    statusTone: marketplaceParticipantStatusTone(input.status),
    walletLabel: input.walletLabel,
    walletTone: input.walletTone,
    windowLabel: input.windowLabel,
  };
}

function toPublicLedgerRow<TBooking, TParticipant>(
  row: SortableMarketplaceParticipantLedgerRow<TBooking, TParticipant>,
): MarketplaceParticipantLedgerRow<TBooking, TParticipant> {
  return {
    alertLabel: row.alertLabel,
    alertTone: row.alertTone,
    booking: row.booking,
    chatHandoffLabel: row.chatHandoffLabel,
    chatHandoffTone: row.chatHandoffTone,
    choiceLabel: row.choiceLabel,
    choiceNextStep: row.choiceNextStep,
    choiceReason: row.choiceReason,
    choiceTone: row.choiceTone,
    distanceLabel: row.distanceLabel,
    distancePolicyHelper: row.distancePolicyHelper,
    distancePolicyLabel: row.distancePolicyLabel,
    distancePolicyTone: row.distancePolicyTone,
    evidenceDetail: row.evidenceDetail,
    evidenceLabel: row.evidenceLabel,
    evidenceTone: row.evidenceTone,
    joinedLabel: row.joinedLabel,
    participant: row.participant,
    partnerLabel: row.partnerLabel,
    respondedLabel: row.respondedLabel,
    roleLabel: row.roleLabel,
    statusLabel: row.statusLabel,
    statusTone: row.statusTone,
    walletLabel: row.walletLabel,
    walletTone: row.walletTone,
    windowLabel: row.windowLabel,
  };
}

function marketplaceParticipantEvidenceState(
  status: string,
  participantPartnerId: string | null,
  preferredPartnerId: string | null,
  isFinal: boolean,
) {
  if (isFinal) {
    return {
      evidenceLabel: 'Final selected row',
      evidenceDetail: 'Customer chose this Partner; the row remains after matching for operations history.',
      evidenceTone: 'pill-success',
    };
  }

  if (status === 'REJECTED') {
    return {
      evidenceLabel: 'Declined response row',
      evidenceDetail: 'Decline is retained as response evidence, not as a customer-selectable Partner.',
      evidenceTone: 'pill-info',
    };
  }

  if (participantPartnerId && participantPartnerId === preferredPartnerId) {
    return {
      evidenceLabel: 'First-pick response row',
      evidenceDetail: 'Preferred Partner response evidence from the 10-minute first-pick window.',
      evidenceTone: 'pill-info',
    };
  }

  return {
    evidenceLabel: 'Marketplace participation row',
    evidenceDetail: 'Partner entered the customer choice list from booking-address marketplace participation.',
    evidenceTone: 'pill-info',
  };
}

function marketplaceParticipantStatusLabel(status: string) {
  if (status === 'ACCEPTED') {
    return 'Accepted';
  }
  if (status === 'SELECTED') {
    return 'Selected';
  }
  if (status === 'REJECTED') {
    return 'Declined';
  }
  if (status === 'JOINED') {
    return 'Participating';
  }
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function marketplaceParticipantStatusTone(status: string) {
  if (status === 'SELECTED') {
    return 'pill-success';
  }
  if (status === 'JOINED' || status === 'ACCEPTED') {
    return 'pill-info';
  }
  if (status === 'REJECTED') {
    return 'pill-info';
  }
  return 'pill-neutral';
}
