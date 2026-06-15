import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';

// Authority markers:
// Customer picks one first-pick partner
// Marketplace partners can participate by policy
// Customer sees available partner choices

type MatchingPlaybookTag = {
  label: string;
  tone: string;
};

export type MatchingPlaybookItem = {
  step: string;
  title: string;
  detail: string;
  className: string;
  tags: MatchingPlaybookTag[];
};

function formatPartnerLimitForSentence(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed} Partners`;
  }

  return trimmed
    .replace(/\bpartner\(s\)\b/gi, 'Partners')
    .replace(/\bpartners\b/gi, 'Partners')
    .replace(/\bpartner\b/gi, 'Partner');
}

export function buildMatchingPlaybook(displayPolicyByKey: (key: string) => string): MatchingPlaybookItem[] {
  const responseWindow = displayPolicyByKey('matching.provider_response_window_minutes');
  const backupRadius = displayPolicyByKey(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters);
  const backupLimit = formatPartnerLimitForSentence(
    displayPolicyByKey(OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit),
  );
  const backupOpenMode = displayPolicyByKey(OPERATIONAL_POLICY_KEYS.marketplaceOpenMode);
  const preferredAcceptMode = displayPolicyByKey('matching.preferred_accept_mode');
  const walletGate = displayPolicyByKey('wallet.negative_balance_gate');
  const alertChannel = displayPolicyByKey('notification.partner_alert_channel');

  return [
    {
      step: '1',
      title: 'Customer picks one first-pick Partner',
      detail:
        'The customer chooses a Partner profile and service option first. This creates a direct booking request and opens the matching window.',
      className: 'timeline-done',
      tags: [
        { label: 'Direct request', tone: 'pill-success' },
        { label: preferredAcceptMode, tone: 'pill-info' },
      ],
    },
    {
      step: '2',
      title: 'First-pick Partner response window starts',
      detail: `The first-pick Partner has ${responseWindow} to accept. Existing open bookings keep their saved expiry time.`,
      className: 'timeline-active',
      tags: [
        { label: responseWindow, tone: 'pill-info' },
        { label: 'Timer saved on booking', tone: 'pill-neutral' },
      ],
    },
    {
      step: '3',
      title: 'Marketplace Partners can participate by policy',
      detail: `Up to ${backupLimit} inside ${backupRadius} can see or participate in the marketplace lane according to "${backupOpenMode}".`,
      className: 'timeline-active',
      tags: [
        { label: backupRadius, tone: 'pill-info' },
        { label: backupLimit, tone: 'pill-info' },
        { label: backupOpenMode, tone: 'pill-warn' },
      ],
    },
    {
      step: '4',
      title: 'Customer sees available Partner choices',
      detail:
        'Accepted or participating Partners appear in the customer waiting screen so the customer can confirm the final Partner when customer-confirm mode is active.',
      className: 'timeline-active',
      tags: [
        { label: 'Customer choice list', tone: 'pill-success' },
        { label: preferredAcceptMode, tone: 'pill-info' },
      ],
    },
    {
      step: '5',
      title: 'Wallet and control gates protect operations',
      detail: `Negative cash-fee debt follows "${walletGate}". Payout holds, account blocks, and stale location should be reviewed before Partner dispatch.`,
      className: walletGate.includes('Block') ? 'timeline-active' : 'timeline-done',
      tags: [
        { label: walletGate, tone: walletGate.includes('Block') ? 'pill-danger' : 'pill-warn' },
        { label: 'Partner controls', tone: 'pill-info' },
      ],
    },
    {
      step: '6',
      title: 'Matched chat and service execution',
      detail: `After final Partner selection, matched chat and operational follow-up continue in-app. Partner alert routing currently follows "${alertChannel}".`,
      className: 'timeline-done',
      tags: [
        { label: 'Matched chat opens', tone: 'pill-success' },
        { label: alertChannel, tone: 'pill-info' },
      ],
    },
  ];
}
