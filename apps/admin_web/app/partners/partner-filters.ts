import { readSearchParam } from '../../lib/date-range';

export type ProviderSecurityState =
  | 'clear'
  | 'account-blocked'
  | 'blocked'
  | 'session-check'
  | 'shared'
  | 'missing';

export type ProviderFilters = {
  q: string;
  verification: string;
  providerStatus: string;
  kyc: string;
  location: string;
  security: string;
  readiness: string;
  bookingFlow: string;
  review: string;
  sort: string;
};

export function buildProviderFilters(
  params: Record<string, string | string[] | undefined>,
): ProviderFilters {
  return {
    q: readParam(params.q),
    verification: readParam(params.verification),
    providerStatus: readParam(params.providerStatus),
    kyc: readParam(params.kyc),
    location: readParam(params.location),
    security: normalizeProviderSecurityFilter(readParam(params.security)),
    readiness: readParam(params.readiness),
    bookingFlow: normalizePartnerBookingFlowFilter(readParam(params.bookingFlow)),
    review: normalizePartnerReviewFilter(readParam(params.review)),
    sort: readPartnerSort(readParam(params.sort)),
  };
}

export function buildProviderActiveFilters(filters: ProviderFilters) {
  return [
    filters.q
      ? {
          kind: 'search',
          value: filters.q,
          label: `Search: ${filters.q}`,
          description: 'Partner list is narrowed by name, phone, location, service, report, or control text.',
        }
      : null,
    filters.verification
      ? {
          kind: 'verification',
          value: filters.verification,
          label: `Verification: ${filters.verification}`,
          description: providerFilterDescription('verification', filters.verification),
        }
      : null,
    filters.providerStatus
      ? {
          kind: 'providerStatus',
          value: filters.providerStatus,
          label: `Status: ${filters.providerStatus}`,
          description: providerFilterDescription('providerStatus', filters.providerStatus),
        }
      : null,
    filters.kyc
      ? {
          kind: 'kyc',
          value: filters.kyc,
          label: `KYC: ${filters.kyc}`,
          description: providerFilterDescription('kyc', filters.kyc),
        }
      : null,
    filters.location
      ? {
          kind: 'location',
          value: filters.location,
          label: `Location: ${filters.location}`,
          description: providerFilterDescription('location', filters.location),
        }
      : null,
    filters.security
      ? {
          kind: 'security',
          value: filters.security,
          label: `Device/session: ${providerSecurityLabel(filters.security as ProviderSecurityState)}`,
          description: providerFilterDescription('security', filters.security),
        }
      : null,
    filters.readiness
      ? {
          kind: 'readiness',
          value: filters.readiness,
          label: `Readiness: ${filters.readiness}`,
          description: providerFilterDescription('readiness', filters.readiness),
        }
      : null,
    filters.bookingFlow
      ? {
          kind: 'bookingFlow',
          value: filters.bookingFlow,
          label: `Booking flow: ${partnerBookingFlowFilterLabel(filters.bookingFlow)}`,
          description: providerFilterDescription('bookingFlow', filters.bookingFlow),
        }
      : null,
    filters.review
      ? {
          kind: 'review',
          value: filters.review,
          label: `Review: ${partnerReviewFilterLabel(filters.review)}`,
          description: providerFilterDescription('review', filters.review),
        }
      : null,
    filters.sort !== 'ops-priority'
      ? {
          kind: 'sort',
          value: filters.sort,
          label: `Sort: ${partnerSortLabel(filters.sort)}`,
          description: 'Partner list sort order is changed for a specific checklist review.',
        }
      : null,
  ].filter(Boolean) as Array<{ kind: string; value: string; label: string; description: string }>;
}

export function providerFilterDescription(kind: string, value: string) {
  if (kind === 'verification' && value === 'SUBMITTED') {
    return 'Submitted identity files are waiting for admin approval or rejection.';
  }
  if (kind === 'verification' && value === 'APPROVED') {
    return 'Approved partners can progress toward dispatch if other readiness checks pass.';
  }
  if (kind === 'verification' && value === 'BLOCKED') {
    return 'Blocked partner accounts cannot receive customer requests.';
  }
  if (kind === 'providerStatus') {
    return 'Partner availability is narrowed to the selected online/offline state.';
  }
  if (kind === 'kyc') {
    return 'KYC review is narrowed to the selected identity state.';
  }
  if (kind === 'location') {
    return 'Location freshness is narrowed so dispatch can check stale or missing partner pins.';
  }
  if (kind === 'security') {
    return 'Device/session review is narrowed to device, session, or account control state.';
  }
  if (kind === 'readiness') {
    return 'Readiness shows whether a partner can safely appear in customer discovery and dispatch.';
  }
  if (kind === 'bookingFlow' && value === 'active-booking') {
    return 'Booking flow is narrowed to partners with live or in-progress booking records.';
  }
  if (kind === 'bookingFlow' && value === 'first-pick') {
    return 'Booking flow is narrowed to partners that were the preferred first-pick partner.';
  }
  if (kind === 'bookingFlow' && value === 'marketplace-joined') {
    return 'Booking flow is narrowed to partners that participated in an open matching request.';
  }
  if (kind === 'bookingFlow' && value === 'final-partner') {
    return 'Booking flow is narrowed to partners selected by the customer as final partner.';
  }
  if (kind === 'bookingFlow' && value === 'chat-live') {
    return 'Booking flow is narrowed to partners with retained booking chat rooms.';
  }
  if (kind === 'bookingFlow' && value === 'chat-missing') {
    return 'Booking flow is narrowed to matched or service-stage rows where chat room evidence is missing.';
  }
  if (kind === 'bookingFlow' && value === 'completed-work') {
    return 'Booking flow is narrowed to partners with completed work records.';
  }
  if (kind === 'bookingFlow' && value === 'no-work') {
    return 'Booking flow is narrowed to partners with no completed work yet.';
  }
  if (kind === 'review' && value === 'push') {
    return 'Push readiness highlights partners whose devices cannot reliably receive booking alerts.';
  }
  if (kind === 'review' && value === 'reports') {
    return 'Report review highlights partners with open reports or active account controls.';
  }
  if (kind === 'review' && value === 'public-media') {
    return 'Public media review highlights uploaded partner photos that are pending or rejected.';
  }
  if (kind === 'review' && value === 'payout-setup') {
    return 'First earning payout setup highlights partners who have earned revenue but still need tax profile, address, or agreements before withdrawal.';
  }
  if (kind === 'review' && value === 'cash-debt') {
    return 'Cash fee debt highlights partners whose marketplace alerts and participation wait until HANDS commission is settled.';
  }
  if (kind === 'review' && value === 'acceptance-blocked') {
    return 'Direct request held highlights partners still waiting on account, identity, bank, device, location, or alert gates before preferred direct requests.';
  }
  if (kind === 'review' && value === 'direct-ready') {
    return 'Direct request ready highlights partners who can receive a preferred customer request immediately.';
  }
  if (kind === 'review' && value === 'marketplace-ready') {
    return 'Marketplace ready highlights partners who can receive availability alerts and join customer choice lists.';
  }
  if (kind === 'review' && value === 'marketplace-blocked') {
    return 'Marketplace repair highlights partners who need wallet, location, status, identity, or alert fixes before receiving alerts or participating.';
  }
  if (kind === 'review') {
    return 'Review queue focuses the table on one operational approval lane.';
  }
  return 'Partner list is narrowed by the active filter.';
}

export function emptyProviderMessage(activeFilters: Array<{ description: string }>) {
  if (activeFilters.length === 0) {
    return 'No partners loaded. Start the API and seed data to populate this table.';
  }
  return 'No partners match the active filters. Clear filters or switch to another review lane.';
}

export function partnerSortLabel(sort: string) {
  if (sort === 'last-work') return 'last completed work';
  if (sort === 'booking-count') return 'booking count';
  if (sort === 'completed-count') return 'completed work count';
  if (sort === 'gross-revenue') return 'gross revenue';
  if (sort === 'pending-payout') return 'pending payout';
  if (sort === 'available-payout') return 'available payout';
  if (sort === 'last-activity') return 'last app activity';
  if (sort === 'location-freshness') return 'location freshness';
  if (sort === 'wallet-debt') return 'wallet debt first';
  if (sort === 'name') return 'name';
  return 'checklist order';
}

export function partnerReviewFilterLabel(review: string) {
  const labels: Record<string, string> = {
    kyc: 'KYC updates',
    documents: 'Document review',
    'public-media': 'Public media review',
    bank: 'Bank payout review',
    'payout-setup': 'First earning payout setup',
    'cash-debt': 'Cash fee debt',
    tax: 'Tax profile review',
    security: 'Device/session check',
    reports: 'Reports/controls',
    blocked: 'Account blocks',
    location: 'Location freshness',
    push: 'Push alert readiness',
    'acceptance-blocked': 'Direct request held',
    'direct-ready': 'Direct request ready',
    'marketplace-ready': 'Marketplace ready',
    'marketplace-blocked': 'Marketplace repair',
  };
  return labels[review] ?? review;
}

export function partnerBookingFlowFilterLabel(flow: string) {
  const labels: Record<string, string> = {
    'active-booking': 'Has active booking',
    'first-pick': 'First-pick booking',
    'marketplace-joined': 'Marketplace participant',
    'final-partner': 'Customer final choice',
    'chat-live': 'Chat room opened',
    'chat-missing': 'Matched but chat missing',
    'completed-work': 'Completed work',
    'no-work': 'No completed work',
  };
  return labels[flow] ?? flow;
}

export function buildPartnerExportSlug(filters: ProviderFilters) {
  const parts = [
    filters.q ? 'search' : '',
    filters.bookingFlow ? `flow-${filters.bookingFlow}` : '',
    filters.review ? `review-${filters.review}` : '',
    filters.providerStatus ? `status-${filters.providerStatus.toLowerCase()}` : '',
    filters.verification ? `verification-${filters.verification.toLowerCase()}` : '',
    filters.kyc ? `kyc-${filters.kyc.toLowerCase()}` : '',
    filters.location ? `location-${filters.location}` : '',
    filters.security ? `device-${filters.security}` : '',
    filters.readiness ? `readiness-${filters.readiness}` : '',
    filters.sort ? `sort-${filters.sort}` : '',
  ].filter(Boolean);

  return (parts.length > 0 ? parts.join('-') : 'all')
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function providerSecurityLabel(status: ProviderSecurityState) {
  if (status === 'account-blocked') return 'Account blocked';
  if (status === 'blocked') return 'Device blocked';
  if (status === 'session-check') return 'Session check';
  if (status === 'shared') return 'Shared device';
  if (status === 'missing') return 'No app device';
  return 'Device clear';
}

function readParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function normalizePartnerReviewFilter(value: string) {
  if (value === 'backup-ready') return 'marketplace-ready';
  if (value === 'backup-blocked') return 'marketplace-blocked';
  return value;
}

function normalizeProviderSecurityFilter(value: string) {
  if (value === 'suspicious') return 'session-check';
  return value;
}

function normalizePartnerBookingFlowFilter(value: string) {
  const allowed = [
    'active-booking',
    'first-pick',
    'marketplace-joined',
    'final-partner',
    'chat-live',
    'chat-missing',
    'completed-work',
    'no-work',
  ];
  return allowed.includes(value) ? value : '';
}

function readPartnerSort(value: string) {
  return [
    'ops-priority',
    'last-work',
    'booking-count',
    'completed-count',
    'gross-revenue',
    'pending-payout',
    'available-payout',
    'last-activity',
    'location-freshness',
    'wallet-debt',
    'name',
  ].includes(value)
    ? value
    : 'ops-priority';
}
