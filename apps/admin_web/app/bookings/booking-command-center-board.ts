import type { BookingCommandTone } from './booking-command-display';

type BookingCommandCenterMetric = {
  readonly label: string;
  readonly value: string;
};

export type BookingCommandCenterFacts = {
  readonly active: readonly unknown[];
  readonly backupSelected: readonly unknown[];
  readonly cashDebt: readonly unknown[];
  readonly chatEvidence: readonly unknown[];
  readonly chatReady: readonly unknown[];
  readonly closeoutChecks: readonly unknown[];
  readonly evidenceMissing: readonly unknown[];
  readonly expiredMatching: readonly unknown[];
  readonly locationChecks: readonly unknown[];
  readonly matchedWithoutChat: readonly unknown[];
  readonly missingAuthorizedPaymentRefs: readonly unknown[];
  readonly noShow: readonly unknown[];
  readonly noSupply: readonly unknown[];
  readonly open: readonly unknown[];
  readonly paymentChecks: readonly unknown[];
  readonly preferredPending: readonly unknown[];
  readonly pricingChecks: readonly unknown[];
  readonly quietChat: readonly unknown[];
  readonly refundReview: readonly unknown[];
};

export type BookingCommandCenterLane = {
  readonly detail: string;
  readonly href: string;
  readonly metrics: readonly BookingCommandCenterMetric[];
  readonly status: string;
  readonly title: string;
  readonly tone: BookingCommandTone;
};

export function bookingCommandCenterFromFacts(
  facts: BookingCommandCenterFacts,
): BookingCommandCenterLane[] {
  return [
    {
      title: 'Dispatch pressure',
      status: facts.noSupply.length > 0 || facts.expiredMatching.length > 0 ? 'Action needed' : 'Stable',
      tone: facts.expiredMatching.length > 0 ? 'danger' : facts.noSupply.length > 0 ? 'warn' : 'ok',
      detail:
        facts.noSupply.length > 0
          ? 'Open matching has customer demand without partner supply.'
          : 'Active booking demand has enough current operating data.',
      href:
        facts.noSupply.length > 0 || facts.expiredMatching.length > 0
          ? facts.noSupply.length > 0
            ? '/bookings?view=no-supply'
            : '/bookings?view=attention'
          : '/bookings?view=active',
      metrics: [
        metric('active', facts.active.length),
        metric('open', facts.open.length),
        metric('no supply', facts.noSupply.length),
        metric('preferred pending', facts.preferredPending.length),
      ],
    },
    {
      title: 'Customer protection',
      status:
        facts.expiredMatching.length > 0 || facts.matchedWithoutChat.length > 0
          ? 'Protect now'
          : 'Clear',
      tone:
        facts.expiredMatching.length > 0 || facts.matchedWithoutChat.length > 0
          ? 'danger'
          : facts.locationChecks.length > 0
            ? 'warn'
            : 'ok',
      detail:
        facts.expiredMatching.length > 0
          ? 'Matching window expired before a final partner was selected.'
          : 'Customer-facing booking handoff has no critical blocker.',
      href:
        facts.expiredMatching.length > 0 || facts.matchedWithoutChat.length > 0
          ? '/bookings?view=attention'
          : '/bookings?view=location',
      metrics: [
        metric('expired', facts.expiredMatching.length),
        metric('no chat', facts.matchedWithoutChat.length),
        metric('location checks', facts.locationChecks.length),
        metric('quiet chat', facts.quietChat.length),
      ],
    },
    {
      title: 'Evidence readiness',
      status:
        facts.evidenceMissing.length > 0
          ? 'Needs records'
          : facts.chatEvidence.length > 0
            ? 'Review ready'
            : 'Clear',
      tone:
        facts.evidenceMissing.length > 0 ? 'warn' : facts.chatEvidence.length > 0 ? 'info' : 'ok',
      detail:
        facts.evidenceMissing.length > 0
          ? 'Some manual outcome bookings need retained chat, alert, or location context before action.'
          : facts.chatEvidence.length > 0
            ? 'Communication evidence is available for bookings that may need operator review.'
            : 'No booking currently needs a chat evidence decision board review.',
      href:
        facts.evidenceMissing.length > 0
          ? '/bookings?view=evidence-missing'
          : facts.chatEvidence.length > 0
            ? '/bookings?view=chat-evidence'
            : '/bookings?view=manual-decision',
      metrics: [
        metric('chat evidence', facts.chatEvidence.length),
        metric('evidence missing', facts.evidenceMissing.length),
        metric('refund review', facts.refundReview.length),
        metric('quiet chat', facts.quietChat.length),
      ],
    },
    {
      title: 'Payment closeout',
      status:
        facts.paymentChecks.length > 0 ||
        facts.closeoutChecks.length > 0 ||
        facts.noShow.length > 0 ||
        facts.pricingChecks.length > 0
          ? 'Review'
          : 'Ready',
      tone:
        facts.closeoutChecks.length > 0
          ? 'danger'
          : facts.paymentChecks.length > 0
            ? 'danger'
            : facts.noShow.length > 0
              ? 'warn'
              : facts.pricingChecks.length > 0
                ? 'warn'
                : 'ok',
      detail:
        facts.closeoutChecks.length > 0
          ? 'Completed bookings are missing earning, tax, platform fee, or wallet closeout records.'
          : facts.paymentChecks.length > 0
            ? 'Some bookings need capture, release, refund, cash debt, or missing reference review.'
            : facts.noShow.length > 0
              ? 'No-show bookings need a clear payment and customer communication outcome.'
              : 'Payment and service pricing policy records are aligned.',
      href:
        facts.closeoutChecks.length > 0
          ? '/bookings?view=closeout'
          : facts.paymentChecks.length > 0
            ? facts.cashDebt.length > 0
              ? '/bookings?view=cash-debt'
              : '/bookings?view=payment'
            : facts.noShow.length > 0
              ? '/bookings?view=no-show'
              : '/bookings?view=pricing',
      metrics: [
        metric('payment', facts.paymentChecks.length),
        metric('closeout', facts.closeoutChecks.length),
        metric('no-show', facts.noShow.length),
        metric('pricing', facts.pricingChecks.length),
        metric('cash debt', facts.cashDebt.length),
        metric('missing refs', facts.missingAuthorizedPaymentRefs.length),
      ],
    },
    {
      title: 'Handoff quality',
      status: facts.locationChecks.length > 0 || facts.quietChat.length > 0 ? 'Monitor' : 'Clear',
      tone: facts.locationChecks.length > 0 ? 'warn' : facts.quietChat.length > 0 ? 'info' : 'ok',
      detail:
        facts.locationChecks.length > 0
          ? 'Live service state has missing or stale last-known partner location.'
          : 'Chat, marketplace selection, and location handoff look normal.',
      href: facts.locationChecks.length > 0 ? '/bookings?view=location' : '/bookings?view=chat',
      metrics: [
        metric('location', facts.locationChecks.length),
        metric('marketplace chosen', facts.backupSelected.length),
        metric('chat live', facts.chatReady.length),
        metric('quiet chat', facts.quietChat.length),
      ],
    },
  ];
}

function metric(label: string, value: number): BookingCommandCenterMetric {
  return { label, value: value.toString() };
}
