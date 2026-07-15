import { readSearchParam } from '../../lib/date-range';

export type PartnerControlPageFilters = {
  readonly q: string;
  readonly review: string;
  readonly sanction: string;
  readonly severity: string;
  readonly status: string;
};

export type PartnerControlActiveFilter = {
  readonly kind: string;
  readonly value: string;
  readonly label: string;
  readonly description: string;
};

type PartnerControlSearchParams = Record<string, string | string[] | undefined>;

export function buildPartnerControlFilters(params: PartnerControlSearchParams = {}): PartnerControlPageFilters {
  return {
    q: readPartnerControlParam(params.q).trim().toLowerCase(),
    review: readPartnerControlParam(params.review),
    status: readPartnerControlParam(params.status),
    severity: readPartnerControlParam(params.severity),
    sanction: readPartnerControlParam(params.sanction),
  };
}

export function buildPartnerControlActiveFilters(
  filters: PartnerControlPageFilters,
): PartnerControlActiveFilter[] {
  return [
    filters.review
      ? {
          kind: 'review',
          value: filters.review,
          label: reviewFilterLabel(filters.review),
          description: reviewFilterDescription(filters.review),
        }
      : null,
    filters.q
      ? {
          kind: 'search',
          value: filters.q,
          label: `Search: ${filters.q}`,
          description: 'Control rows are narrowed by partner, phone, category, reason, or report text.',
        }
      : null,
    filters.status
      ? {
          kind: 'status',
          value: filters.status,
          label: `Report: ${filters.status}`,
          description: controlFilterDescription('status', filters.status),
        }
      : null,
    filters.severity
      ? {
          kind: 'severity',
          value: filters.severity,
          label: `Report level: ${filters.severity === 'HIGH_PLUS' ? 'CRITICAL + HIGH' : filters.severity}`,
          description: controlFilterDescription('severity', filters.severity),
        }
      : null,
    filters.sanction
      ? {
          kind: 'sanction',
          value: filters.sanction,
          label: `Control: ${filters.sanction}`,
          description: controlFilterDescription('sanction', filters.sanction),
        }
      : null,
  ].filter(Boolean) as PartnerControlActiveFilter[];
}

export function partnerControlListHref(
  params: PartnerControlSearchParams,
  pageParam: 'reportPage' | 'sanctionPage',
  page: number,
) {
  const searchParams = new URLSearchParams();

  for (const key of ['details', 'q', 'review', 'status', 'severity', 'sanction', 'reportPage', 'sanctionPage'] as const) {
    const value = readPartnerControlParam(params[key]);
    if (value) {
      searchParams.set(key, value);
    }
  }

  if (page > 1) {
    searchParams.set(pageParam, String(page));
  } else {
    searchParams.delete(pageParam);
  }

  const query = searchParams.toString();
  return query ? `/partner-controls?${query}` : '/partner-controls';
}

export function isPartnerControlCashDebtReview(filters: PartnerControlPageFilters) {
  return filters.review === 'cash-debt';
}

function reviewFilterLabel(value: string) {
  if (value === 'cash-debt') {
    return 'Review: cash debt';
  }
  return `Review: ${value}`;
}

function reviewFilterDescription(value: string) {
  if (value === 'cash-debt') {
    return 'Partner controls are narrowed to Partners with negative wallet debt from cash booking commission.';
  }
  return 'Partner controls are narrowed to the linked review lane.';
}

function controlFilterDescription(kind: string, value: string) {
  if (kind === 'status' && value === 'OPEN') {
    return 'Open reports need triage before profile review or payout decisions.';
  }
  if (kind === 'status' && value === 'INVESTIGATING') {
    return 'Investigating reports need evidence, customer notes, or staff follow-up.';
  }
  if (kind === 'severity') {
    if (value === 'HIGH_PLUS') {
      return 'Urgent and major reports are prioritized together for safety review.';
    }
    return `${value.toLowerCase()} level reports are prioritized for operator review.`;
  }
  if (kind === 'sanction' && value === 'ACTIVE') {
    return 'Active account controls restrict work or payout and should be lifted only with a clear audit trail.';
  }
  if (kind === 'sanction') {
    return 'Account controls are narrowed to the selected lifecycle state.';
  }
  return 'Control board is narrowed by the active filter.';
}

function readPartnerControlParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}
