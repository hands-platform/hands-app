import { LEGACY_OPERATIONAL_POLICY_KEYS, OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';

type PolicySaveCheck = {
  label: string;
  detail: string;
  href: string;
};

type PolicyImpactDetails = {
  area: string;
  title: string;
  detail: string;
  saveChecks: PolicySaveCheck[];
};

export function policyImpactDetails(key: string): PolicyImpactDetails {
  const impactKey = policyImpactDetailsKey(key);
  return POLICY_IMPACT_DETAILS[impactKey] ?? FALLBACK_POLICY_IMPACT_DETAILS;
}

const BOOKING_CREATE_GATE_POLICY_IMPACT_DETAILS: Record<string, PolicyImpactDetails> = {
  [OPERATIONAL_POLICY_KEYS.bookingDistanceGateEnabled]: {
    area: 'Booking create gate',
    title: 'Controls whether local booking distance checks are enforced',
    detail:
      'When enabled, booking creation checks the preferred partner distance against the selected service address before payment authorization. Customer GPS is optional evidence only.',
    saveChecks: [
      {
        label: 'Blocked create attempts',
        detail:
          'Review booking create rejections before disabling or re-enabling this gate, because customers can still browse globally while booking remains local.',
        href: '/bookings?view=blocked-create',
      },
      {
        label: 'Audit evidence',
        detail: 'Confirm recent rejected creates include clear address and distance evidence for support.',
        href: '/audit-log?query=booking.create.rejected',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.bookingServiceAreaRequired]: {
    area: 'Booking create gate',
    title: 'Controls whether booking addresses must be inside enabled Vietnam service areas',
    detail:
      'Customers may browse partner profiles for context, but immediate booking should only open at confirmed Vietnam service addresses while service-area enforcement is enabled.',
    saveChecks: [
      {
        label: 'Service area launch list',
        detail: 'Confirm the target Vietnam province or district is enabled before relaxing this control.',
        href: '/setup',
      },
      {
        label: 'Blocked create attempts',
        detail: 'Check whether failed bookings are caused by missing service area configuration.',
        href: '/bookings?view=blocked-create',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.bookingMaxCustomerCurrentToAddressKm]: {
    area: 'Booking create gate',
    title: 'Blocks distant customer GPS-to-service-address attempts',
    detail:
      'When fresh customer GPS is available, booking creation is blocked if the selected service address is this far or farther from the customer current location.',
    saveChecks: [
      {
        label: 'Distance reject rows',
        detail:
          'Review rejected booking attempts where the customer current GPS was too far from the selected service address.',
        href: '/audit-log?query=CUSTOMER_CURRENT_LOCATION_TOO_FAR',
      },
      {
        label: 'Customer support queue',
        detail:
          'Check whether customers are selecting distant addresses because GPS failed or address search was unclear.',
        href: '/customers',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.bookingMaxPreferredPartnerDistanceKm]: {
    area: 'Booking create gate',
    title: 'Controls preferred first-pick Partner distance',
    detail:
      'The customer-selected first-pick Partner must be close enough to the booking address before the booking can authorize payment and open matching.',
    saveChecks: [
      {
        label: 'First-pick distance rejects',
        detail:
          'Review rejected booking attempts where the selected first-pick Partner was too far from the booking address.',
        href: '/audit-log?query=PREFERRED_PARTNER_TOO_FAR',
      },
      {
        label: 'Partner location coverage',
        detail: 'Check whether partners have fresh last locations in the city before widening this limit.',
        href: '/partners?review=location',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.bookingCurrentLocationFreshnessMinutes]: {
    area: 'Booking create gate',
    title: 'Controls current customer GPS freshness for the distance gate',
    detail:
      'The app may attach recent customer GPS evidence when available. Fresh GPS can block distant selected service addresses; stale or missing GPS does not replace the confirmed service address.',
    saveChecks: [
      {
        label: 'GPS distance gate rows',
        detail: 'Review GPS-related blocked booking attempts before changing the freshness window.',
        href: '/bookings?view=blocked-create',
      },
      {
        label: 'Address selection flow',
        detail:
          'Confirm customers can still search and confirm a Vietnam service address when GPS is denied.',
        href: '/setup',
      },
    ],
  },
};

const MATCHING_MARKETPLACE_POLICY_IMPACT_DETAILS: Record<string, PolicyImpactDetails> = {
  [OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes]: {
    area: 'Booking timer',
    title: 'Affects new booking expiry windows',
    detail:
      'New requests use this value for the first-pick Partner response timer and Redis matching TTL. Existing open bookings keep their saved expiry.',
    saveChecks: [
      {
        label: 'First-pick queue',
        detail:
          'Check how many bookings are still waiting for the preferred partner before shortening the timer.',
        href: '/bookings?view=first-pick',
      },
      {
        label: 'Customer choice backlog',
        detail: 'Confirm customers are not already waiting too long after partners accept.',
        href: '/bookings?view=customer-choice',
      },
    ],
  },
  [LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters]: {
    area: 'Partner supply',
    title: 'Controls who can see and participate in marketplace requests',
    detail:
      'Partner open-booking lists, participation validation, marketplace notifications, and customer choice list visibility use this radius.',
    saveChecks: [
      {
        label: 'Stage impact preview',
        detail: 'Preview how the selected radius changes marketplace supply and no-supply checks.',
        href: '/operations-policy#matching-stage-impact',
      },
      {
        label: 'Marketplace ready',
        detail: 'Review partners that can actually receive and participate in marketplace requests.',
        href: '/partners?review=marketplace-ready',
      },
    ],
  },
  [LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit]: {
    area: 'Partner supply',
    title: 'Controls how many marketplace Partners are exposed',
    detail:
      'Eligible marketplace Partners are sorted by distance, then capped by this limit before notification jobs and customer-visible supply are created.',
    saveChecks: [
      {
        label: 'Marketplace notification load',
        detail: 'Check delivery volume and failed partner alerts before raising invitation volume.',
        href: '/notifications',
      },
      {
        label: 'Marketplace shortlist',
        detail:
          'Confirm the customer choice shortlist will stay readable when more partners can participate.',
        href: '/bookings?view=marketplace',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.travelBufferMinutes]: {
    area: 'Availability',
    title: 'Controls partner availability after work',
    detail:
      'Nearby sorting and availability calculations use this buffer before a partner becomes eligible for another booking.',
    saveChecks: [
      {
        label: 'Partner capacity',
        detail: 'Review online partners and session freshness before reducing rest/travel time.',
        href: '/app-sessions?role=PROVIDER&state=live',
      },
      {
        label: 'Capacity pressure',
        detail: 'Look for stacked bookings that may create late arrivals if the buffer is too low.',
        href: '/bookings?view=matching',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.preferredAcceptMode]: {
    area: 'Customer choice',
    title: 'Controls first-pick priority and customer fallback',
    detail:
      'The first-pick Partner can match first under API rules. If first-pick does not validly win, the customer selects from participating Partners.',
    saveChecks: [
      {
        label: 'Customer choice queue',
        detail: 'Use this queue to confirm accepted partners are waiting for customer final choice.',
        href: '/bookings?view=customer-choice',
      },
      {
        label: 'Handoff repair',
        detail: 'Check chat and service-start failures after the customer chooses a final partner.',
        href: '/bookings?view=handoff-repair',
      },
    ],
  },
  [LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode]: {
    area: 'Marketplace flow',
    title: 'Controls when other partners can participate',
    detail:
      'Immediate mode keeps marketplace participation parallel with the first-pick window. Legacy delayed values are normalized to immediate participation by the API.',
    saveChecks: [
      {
        label: 'Open matching timeline',
        detail:
          'Confirm marketplace visibility stays parallel while old delayed policy rows are still being phased out.',
        href: '/bookings?view=matching',
      },
      {
        label: 'Policy stage preview',
        detail: 'Confirm the stage preview treats delayed values as compatibility-only.',
        href: '/operations-policy#matching-stage-impact',
      },
    ],
  },
};

const SETTLEMENT_POLICY_IMPACT_DETAILS: Record<string, PolicyImpactDetails> = {
  [OPERATIONAL_POLICY_KEYS.walletNegativeGate]: {
    area: 'Wallet controls',
    title: 'Controls unpaid cash-fee debt enforcement',
    detail:
      'Policy controls cash-fee debt settlement. Marketplace requests remain visible, while final acceptance, service start, and payout release stay blocked while the wallet is negative.',
    saveChecks: [
      {
        label: 'Cash debt queue',
        detail:
          'Review partners held from final acceptance, service start, or payout release by unpaid HANDS cash fees before changing settlement gates.',
        href: '/partners?review=cash-debt',
      },
      {
        label: 'Settlement command queue',
        detail: 'Check pending repayments and manual offsets before relaxing debt enforcement.',
        href: '/cash-settlements',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.cashSettlementClearance]: {
    area: 'Cash settlement',
    title: 'Controls negative wallet clearance evidence',
    detail:
      'Cash jobs create company fee debt because the partner receives cash directly. This policy defines whether operators need deposit evidence, admin offset approval, or both before clearing a negative wallet hold.',
    saveChecks: [
      {
        label: 'Cash settlement queue',
        detail:
          'Review open cash fee debts, deposit references, and manual offsets before changing clearance rules.',
        href: '/cash-settlements',
      },
      {
        label: 'Partner cash holds',
        detail:
          'Check partners blocked from final acceptance, service start, or payout release by unpaid platform fees.',
        href: '/partners?review=cash-debt',
      },
    ],
  },
  // Authority markers: 'payout.batch_cycle_policy':
  // Positive partner earnings remain settlement-batch based.
  [OPERATIONAL_POLICY_KEYS.payoutBatchCycle]: {
    area: 'Payout settlement',
    title: 'Controls positive earning payout cadence',
    detail:
      'Positive partner earnings remain settlement-batch based. Operators can run weekly, monthly, or admin-selected-day batches, but each paid batch should keep transfer references, withholding logs, and wallet impact evidence.',
    saveChecks: [
      {
        label: 'Payout batches',
        detail:
          'Review draft, approved, and paid batches before changing payout cadence or exception handling.',
        href: '/payouts',
      },
      {
        label: 'Earnings ledger',
        detail:
          'Confirm unpaid earnings, tax logs, withholding records, and wallet entries are ready for the next batch.',
        href: '/earnings',
      },
    ],
  },
};

const ACTION_CLOSEOUT_POLICY_IMPACT_DETAILS: Record<string, PolicyImpactDetails> = {
  [OPERATIONAL_POLICY_KEYS.actionEvidenceGateMode]: {
    area: 'Action gates',
    title: 'Controls booking action evidence posture',
    detail:
      'Operators use this policy before payment capture, release, cash-fee settlement, expiry, no-show, and completed closeout actions. It keeps decisions tied to retained booking evidence instead of informal judgment.',
    saveChecks: [
      {
        label: 'Manual decision queue',
        detail:
          'Review bookings that need payment or closeout decisions before tightening the evidence requirement.',
        href: '/bookings?view=manual-decision',
      },
      {
        label: 'Closeout checklist',
        detail: 'Confirm completed, cancelled, expired, and no-show closeout evidence is visible.',
        href: '/bookings?view=closeout',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.firstPickExpiryAction]: {
    area: 'First-pick expiry',
    title: 'Controls operator handling after the first-pick timer',
    detail:
      'When the preferred partner does not respond within the response window, the marketplace can remain open for nearby partner participation. The policy must never assign a final partner automatically.',
    saveChecks: [
      {
        label: 'First-pick overdue queue',
        detail: 'Review bookings waiting on the preferred partner before changing expiry handling.',
        href: '/bookings?view=first-pick',
      },
      {
        label: 'Marketplace alternatives',
        detail: 'Confirm nearby partners are available before choosing a stricter expiry posture.',
        href: '/bookings?view=marketplace',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.cancellationAfterMatch]: {
    area: 'Cancellation money',
    title: 'Controls payment handling after partner commitment',
    detail:
      'Admin-review mode releases normal early cancellations. Auto-fee mode keeps matched cancellation payment holds for operator review.',
    saveChecks: [
      {
        label: 'Cancellation closeout',
        detail:
          'Review cancellation reasons, matched state, and refund exposure before changing fee posture.',
        href: '/bookings?view=closeout',
      },
      {
        label: 'Refund command board',
        detail: 'Check manual refund workload before holding more matched cancellations.',
        href: '/refunds',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.noShowEvidenceRequirement]: {
    area: 'No-show evidence',
    title: 'Controls minimum records before no-show closeout',
    detail:
      'No-show remains a factual admin closeout. This policy defines which retained records operators should inspect before marking a booking no-show and deciding payment handling.',
    saveChecks: [
      {
        label: 'No-show board',
        detail: 'Review no-show records with chat, location, notification, and note evidence visible.',
        href: '/bookings?view=no-show',
      },
      {
        label: 'Chat archive repair',
        detail: 'Check missing chat rooms before using chat as a required evidence source.',
        href: '/chat-archive?status=missing-room',
      },
    ],
  },
  [OPERATIONAL_POLICY_KEYS.noShowPartnerReport]: {
    area: 'No-show review',
    title: 'Controls no-show evidence and payment review posture',
    detail:
      'Admin-review mode keeps no-show and fee decisions manual. Evidence mode records required evidence in notes and audit logs for consistent review.',
    saveChecks: [
      {
        label: 'No-show board',
        detail: 'Review active no-show cases and missing evidence before tightening no-show policy.',
        href: '/bookings?view=no-show',
      },
      {
        label: 'No-show alerts',
        detail:
          'Check alert delivery so partners and customers are informed before no-show closeout is reviewed.',
        href: '/notifications?review=no-show',
      },
    ],
  },
};

const NOTIFICATION_POLICY_IMPACT_DETAILS: Record<string, PolicyImpactDetails> = {
  [OPERATIONAL_POLICY_KEYS.partnerAlertChannel]: {
    area: 'Alert routing',
    title: 'Controls partner booking alert delivery route',
    detail:
      'In-app mode records inbox notifications only. FCM mode routes partner booking alerts through FCM push delivery and logs delivery results.',
    saveChecks: [
      {
        label: 'Delivery operations queue',
        detail: 'Confirm failed delivery codes and disabled devices before changing alert routing.',
        href: '/notifications',
      },
      {
        label: 'Setup checklist',
        detail:
          'Verify FCM project IDs, server credentials, and mobile config files are ready before enabling external push.',
        href: '/setup',
      },
    ],
  },
};

const POLICY_IMPACT_DETAILS: Record<string, PolicyImpactDetails> = {
  ...BOOKING_CREATE_GATE_POLICY_IMPACT_DETAILS,
  ...MATCHING_MARKETPLACE_POLICY_IMPACT_DETAILS,
  ...SETTLEMENT_POLICY_IMPACT_DETAILS,
  ...ACTION_CLOSEOUT_POLICY_IMPACT_DETAILS,
  ...NOTIFICATION_POLICY_IMPACT_DETAILS,
};

const FALLBACK_POLICY_IMPACT_DETAILS: PolicyImpactDetails = {
  area: 'Operations',
  title: 'Operational policy',
  detail: 'This setting is tracked for auditability and future automation.',
  saveChecks: [
    {
      label: 'Audit trail',
      detail: 'Check recent policy changes and leave a clear reason before saving another change.',
      href: '/audit-log',
    },
    {
      label: 'Operations dashboard',
      detail: 'Review live booking, partner, and customer health before changing behavior.',
      href: '/',
    },
  ],
};

const POLICY_IMPACT_DETAIL_ALIASES: Record<string, string> = {
  [OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters]: LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  [OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes]:
    LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
  [OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit]:
    LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
  [OPERATIONAL_POLICY_KEYS.marketplaceOpenMode]: LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
};

function policyImpactDetailsKey(key: string) {
  return POLICY_IMPACT_DETAIL_ALIASES[key] ?? key;
}
