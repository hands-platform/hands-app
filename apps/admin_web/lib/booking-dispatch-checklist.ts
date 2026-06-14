export type DispatchStep = {
  priority: 'Now' | 'Monitor' | 'Done';
  title: string;
  detail: string;
  owner: string;
  tone: string;
  actionHref?: string;
  actionLabel?: string;
};

export type BookingDispatchPartner = {
  label: string;
  phone?: string | null;
} | null;

export type BookingDispatchPayment = {
  id?: string | null;
  status: string;
  href?: string;
  hint: string;
  terminal: boolean;
} | null;

export type BookingDispatchChecklistInput = {
  bookingStatus: string;
  attentionFlagCount: number;
  payment: BookingDispatchPayment;
  selectedPartner: BookingDispatchPartner;
  preferredPartner: BookingDispatchPartner;
  isPreferredAwaitingDecision: boolean;
  participantCount: number;
  hasChatRoom: boolean;
  chatRoomId?: string | null;
  messageCount: number;
  activeWithLocationNeed: boolean;
  hasLatestProviderLocation: boolean;
  latestProviderLocationFreshness?: string | null;
  providerLocationAgeLabel: string;
};

const activeChatStatuses = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);

function partnerPhoneHref(partner: BookingDispatchPartner) {
  return partner?.phone ? `tel:${partner.phone}` : undefined;
}

function currentPartner(input: BookingDispatchChecklistInput) {
  return input.selectedPartner ?? input.preferredPartner;
}

export function bookingDispatchChecklist(input: BookingDispatchChecklistInput): DispatchStep[] {
  const steps: DispatchStep[] = [];
  const partner = currentPartner(input);
  const partnerPhone = partnerPhoneHref(partner);

  if (
    input.bookingStatus === 'CANCELLED' &&
    input.payment &&
    !['RELEASED', 'REFUNDED'].includes(input.payment.status)
  ) {
    steps.push({
      priority: 'Now',
      title: 'Resolve cancelled payment',
      detail: `Booking is cancelled but payment is still ${input.payment.status}. Release the hold or refund before closing.`,
      owner: 'Payments operator',
      tone: 'pill-danger',
      actionHref: input.payment.href,
      actionLabel: 'Open payment',
    });
  }

  if (input.bookingStatus === 'COMPLETED' && input.payment?.status === 'AUTHORIZED') {
    steps.push({
      priority: 'Now',
      title: 'Capture completed service',
      detail: 'Service is complete while payment is still authorized. Capture it unless a dispute is active.',
      owner: 'Payments operator',
      tone: 'pill-danger',
      actionHref: input.payment.href,
      actionLabel: 'Capture payment',
    });
  }

  if (
    input.bookingStatus === 'OPEN_MATCHING' &&
    input.preferredPartner &&
    input.isPreferredAwaitingDecision
  ) {
    steps.push({
      priority: 'Now',
      title: 'Preferred Partner response',
      detail: `${input.preferredPartner.label} has the first response window. Contact them if the customer is waiting too long.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: partnerPhoneHref(input.preferredPartner),
      actionLabel: 'Call Partner',
    });
  }

  if (input.bookingStatus === 'OPEN_MATCHING' && input.participantCount === 0) {
    steps.push({
      priority: 'Monitor',
      title: 'Supply monitor',
      detail: 'No Partner participation is recorded yet. Keep Partner availability and notification delivery visible.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: '/partners',
      actionLabel: 'Open Partners',
    });
  }

  if (input.bookingStatus === 'MATCHED' && !input.hasChatRoom) {
    steps.push({
      priority: 'Now',
      title: 'Recover chat room',
      detail: 'Partner is selected but no chat room exists. This can block service coordination.',
      owner: 'Support operator',
      tone: 'pill-danger',
    });
  }

  if (input.activeWithLocationNeed && !input.hasLatestProviderLocation) {
    steps.push({
      priority: 'Now',
      title: 'Request Partner location',
      detail: 'The Partner has not shared a saved service pin for this active booking.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: partnerPhone,
      actionLabel: 'Call Partner',
    });
  }

  if (
    input.activeWithLocationNeed &&
    input.hasLatestProviderLocation &&
    input.latestProviderLocationFreshness !== 'recent'
  ) {
    steps.push({
      priority: 'Monitor',
      title: 'Refresh stale location',
      detail: `${input.providerLocationAgeLabel}. Ask the Partner to share current location again if the customer asks.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: partnerPhone,
      actionLabel: 'Call Partner',
    });
  }

  if (input.hasChatRoom && input.messageCount === 0 && activeChatStatuses.has(input.bookingStatus)) {
    steps.push({
      priority: 'Monitor',
      title: 'First chat contact',
      detail: 'Chat is ready but quiet. Monitor for first contact if the customer reports uncertainty.',
      owner: 'Customer support',
      tone: 'pill-info',
    });
  }

  if (input.selectedPartner) {
    steps.push({
      priority: 'Done',
      title: 'Partner handoff locked',
      detail: `${input.selectedPartner.label} is the current final Partner for this booking.`,
      owner: 'Dispatch operator',
      tone: 'pill-success',
      actionHref: partnerPhoneHref(input.selectedPartner),
      actionLabel: 'Call Partner',
    });
  }

  if (input.hasChatRoom) {
    steps.push({
      priority: 'Done',
      title: 'Chat room ready',
      detail: `Room ${input.chatRoomId} has ${input.messageCount} message(s).`,
      owner: 'Customer support',
      tone: 'pill-success',
    });
  }

  if (input.payment) {
    steps.push({
      priority: input.payment.terminal ? 'Done' : 'Monitor',
      title: 'Payment state',
      detail: input.payment.hint,
      owner: 'Payments operator',
      tone: input.payment.terminal ? 'pill-success' : 'pill-info',
      actionHref: input.payment.href,
      actionLabel: 'Open payment',
    });
  }

  if (
    steps.length === 0 ||
    (input.attentionFlagCount === 0 && steps.every((step) => step.priority === 'Done'))
  ) {
    steps.push({
      priority: 'Done',
      title: 'Normal monitoring',
      detail:
        'No same-shift operator action is active. Keep this booking visible until the next status transition.',
      owner: 'Operations',
      tone: 'pill-success',
    });
  }

  return steps;
}
