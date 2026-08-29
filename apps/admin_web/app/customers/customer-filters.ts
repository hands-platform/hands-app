import { readSearchParam } from '../../lib/date-range';

export const DEFAULT_CUSTOMER_PAGE_SIZE = 10;
export const CUSTOMER_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type CustomerView = 'needs-action' | 'new-today' | 'active-today' | 'all';
export type CustomerSegment =
  | ''
  | 'never-booked'
  | 'usage-new-unbooked'
  | 'has-bookings'
  | 'completed'
  | 'cancellation-risk'
  | 'inactive-30d';
export type CustomerDateField = 'joined' | 'last-booking' | 'last-login';
export type CustomerDateRange = '' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';
export type CustomerSort = 'newest' | 'booking-count' | 'booking-count-asc' | 'name';

export type CustomerFilters = {
  page: number;
  pageSize: number;
  q: string;
  view: CustomerView;
  segment: CustomerSegment;
  country: string;
  gender: string;
  dateField: CustomerDateField;
  dateRange: CustomerDateRange;
  dateFrom: string;
  dateTo: string;
  sort: CustomerSort;
};

export type CustomerDataHrefs = {
  readonly listHref: string;
  readonly summaryHref: string;
};

export type CustomerViewCounts = {
  readonly activeToday: number;
  readonly all: number;
  readonly needsAction: number;
  readonly newToday: number;
};

export function buildCustomerFilters(params: Record<string, string | string[] | undefined>): CustomerFilters {
  const legacyDateFilter = readLegacyCustomerDateFilter(params);
  const dateField = readCustomerDateField(params.dateField) ?? legacyDateFilter.field ?? 'last-login';
  const requestedDateRange =
    normalizeCustomerDateRangeFilter(readSearchParam(params.dateRange)) || legacyDateFilter.range;
  const requestedDateFrom = readDateParam(params.dateFrom) || legacyDateFilter.from;
  const requestedDateTo = readDateParam(params.dateTo) || legacyDateFilter.to;
  const dateRange =
    requestedDateRange === 'custom' && !isValidCustomerCustomDateRange(requestedDateFrom, requestedDateTo)
      ? ''
      : requestedDateRange;
  const dateValues = resolveCustomerDateRange(dateRange, requestedDateFrom, requestedDateTo);

  return {
    page: readPageNumber(params.page),
    pageSize: readPageSize(params.pageSize),
    q: readSearchParam(params.q),
    view: readCustomerView(params.view),
    segment: readCustomerSegment(params.segment),
    country: normalizeCustomerCountryFilter(readSearchParam(params.country)),
    gender: normalizeCustomerGenderFilter(readSearchParam(params.gender)),
    dateField,
    dateRange,
    dateFrom: dateValues.from,
    dateTo: dateValues.to,
    sort: readCustomerSort(params.sort),
  };
}

export function buildCustomerListHref(filters: CustomerFilters, overrides: Partial<CustomerFilters> = {}) {
  const next: CustomerFilters = {
    ...filters,
    ...overrides,
    page: overrides.page ?? 1,
  };
  const params = buildCustomerPageQueryParams(next);
  return params.size ? `/customers?${params.toString()}` : '/customers';
}

export function buildCustomerExportHref(filters: CustomerFilters) {
  const params = buildCustomerPageQueryParams(filters);
  const query = params.toString();
  return query ? `/api/admin/customers/export?${query}` : '/api/admin/customers/export';
}

export function buildCustomerDataHrefs(filters: CustomerFilters): CustomerDataHrefs {
  const listParams = buildCustomerDataQueryParams(filters, { includeSort: true });
  listParams.set('take', String(filters.pageSize));
  listParams.set('skip', String((filters.page - 1) * filters.pageSize));

  const summaryParams = buildCustomerDataQueryParams({ ...filters, view: 'all' });

  return {
    listHref: `/admin/customers?${listParams.toString()}`,
    summaryHref: summaryParams.size
      ? `/admin/customers/summary?${summaryParams.toString()}`
      : '/admin/customers/summary',
  };
}

export function customerSortLabel(sort: CustomerSort) {
  if (sort === 'booking-count') return 'Most bookings';
  if (sort === 'booking-count-asc') return 'Fewest bookings';
  if (sort === 'name') return 'Customer name';
  return 'Newest customers';
}

export function buildCustomerActiveFilters(filters: CustomerFilters) {
  const labels: string[] = [];
  if (filters.q) labels.push(`Search: ${filters.q}`);
  if (filters.segment) labels.push(`Segment: ${customerSegmentLabel(filters.segment)}`);
  if (filters.country) labels.push(`Recorded app language: ${customerCountryFilterLabel(filters.country)}`);
  if (filters.gender) labels.push(`Gender: ${customerGenderFilterLabel(filters.gender)}`);
  if (filters.dateRange) {
    labels.push(
      `${customerDateFieldLabel(filters.dateField)}: ${customerDateRangeFilterLabel(
        filters.dateRange,
        filters.dateFrom,
        filters.dateTo,
      )}`,
    );
  }
  return labels;
}

export function customerViewLabel(view: CustomerView) {
  const labels: Record<CustomerView, string> = {
    all: 'All customers',
    'needs-action': 'Payment & review',
    'new-today': 'New today',
    'active-today': 'App seen today',
  };
  return labels[view];
}

export function customerViewTotal(
  view: CustomerView,
  counts: CustomerViewCounts | undefined,
  fallback: number,
) {
  if (!counts) return fallback;
  if (view === 'needs-action') return counts.needsAction;
  if (view === 'new-today') return counts.newToday;
  if (view === 'active-today') return counts.activeToday;
  return counts.all;
}

export function customerSegmentLabel(segment: CustomerSegment) {
  const labels: Record<Exclude<CustomerSegment, ''>, string> = {
    'never-booked': 'Never booked',
    'usage-new-unbooked': 'New in period · no production booking',
    'has-bookings': 'Has booking history',
    completed: 'Completed customers',
    'cancellation-risk': 'Cancellation / no-show history',
    'inactive-30d': 'Inactive 30 days',
  };
  return segment ? labels[segment] : 'All customer segments';
}

export function customerDateFieldLabel(field: CustomerDateField) {
  if (field === 'joined') return 'Joined date';
  if (field === 'last-booking') return 'Last booking activity';
  return 'Session activity period';
}

export function safeCustomerReturnTo(value: string | string[] | undefined) {
  const raw = readSearchParam(value);
  if (!raw || raw.startsWith('//') || raw.includes('\\')) return '/customers';

  try {
    const url = new URL(raw, 'http://admin.local');
    return url.origin === 'http://admin.local' && url.pathname === '/customers'
      ? `${url.pathname}${url.search}`
      : '/customers';
  } catch {
    return '/customers';
  }
}

function buildCustomerDataQueryParams(filters: CustomerFilters, options: { includeSort?: boolean } = {}) {
  const params = new URLSearchParams();

  appendTextParam(params, 'q', filters.q);
  if (filters.view !== 'all') appendTextParam(params, 'view', filters.view);
  appendTextParam(params, 'segment', filters.segment);
  appendTextParam(params, 'country', filters.country);
  appendTextParam(params, 'gender', filters.gender);
  appendCustomerDateParams(params, filters);
  if (options.includeSort && filters.sort !== 'newest') {
    appendTextParam(params, 'sort', filters.sort);
  }

  return params;
}

function appendCustomerDateParams(params: URLSearchParams, filters: CustomerFilters) {
  if (!filters.dateRange) return;

  const keys = customerDateApiKeys(filters.dateField);
  appendTextParam(params, keys.from, filters.dateFrom);
  appendTextParam(params, keys.to, filters.dateTo);
}

function customerDateApiKeys(field: CustomerDateField) {
  if (field === 'joined') return { from: 'joinedFrom', to: 'joinedTo' } as const;
  if (field === 'last-booking') return { from: 'lastBookingFrom', to: 'lastBookingTo' } as const;
  return { from: 'lastLoginFrom', to: 'lastLoginTo' } as const;
}

function normalizeCustomerDateRangeFilter(value: string): CustomerDateRange {
  const allowed: CustomerDateRange[] = ['today', 'yesterday', '7d', '30d', 'custom'];
  return allowed.includes(value as CustomerDateRange) ? (value as CustomerDateRange) : '';
}

function resolveCustomerDateRange(range: CustomerDateRange, from: string, to: string) {
  if (range === 'today') {
    const today = vietnamDateParam(0);
    return { from: today, to: today };
  }
  if (range === 'yesterday') {
    const yesterday = vietnamDateParam(-1);
    return { from: yesterday, to: yesterday };
  }
  if (range === '7d') {
    return { from: vietnamDateParam(-6), to: vietnamDateParam(0) };
  }
  if (range === '30d') {
    return { from: vietnamDateParam(-29), to: vietnamDateParam(0) };
  }
  if (range === 'custom') {
    return { from, to };
  }

  return { from: '', to: '' };
}

function vietnamDateParam(dayOffset: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function customerDateRangeFilterLabel(range: CustomerDateRange, from: string, to: string) {
  const labels: Record<CustomerDateRange, string> = {
    '': 'All dates',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    custom: [from, to].filter(Boolean).join(' - ') || 'Custom period',
    today: 'Today',
    yesterday: 'Previous day',
  };
  return labels[range];
}

function readCustomerView(value: string | string[] | undefined): CustomerView {
  const view = readSearchParam(value);
  return ['all', 'needs-action', 'new-today', 'active-today'].includes(view)
    ? (view as CustomerView)
    : 'needs-action';
}

function readCustomerSegment(value: string | string[] | undefined): CustomerSegment {
  const segment = readSearchParam(value);
  return ['never-booked', 'usage-new-unbooked', 'has-bookings', 'completed', 'cancellation-risk', 'inactive-30d'].includes(segment)
    ? (segment as CustomerSegment)
    : '';
}

function readCustomerDateField(value: string | string[] | undefined): CustomerDateField | null {
  const field = readSearchParam(value);
  return ['joined', 'last-booking', 'last-login'].includes(field) ? (field as CustomerDateField) : null;
}

function readCustomerSort(value: string | string[] | undefined): CustomerSort {
  const sort = readSearchParam(value);
  if (sort === 'last-booking') return 'newest';
  return ['newest', 'booking-count', 'booking-count-asc', 'name'].includes(sort)
    ? (sort as CustomerSort)
    : 'newest';
}

function readLegacyCustomerDateFilter(params: Record<string, string | string[] | undefined>) {
  const candidates = [
    legacyDateCandidate('joined', params.joinedRange, params.joinedFrom, params.joinedTo),
    legacyDateCandidate(
      'last-booking',
      params.lastBookingRange,
      params.lastBookingFrom,
      params.lastBookingTo,
    ),
    legacyDateCandidate('last-login', params.lastLoginRange, params.lastLoginFrom, params.lastLoginTo),
  ];
  return candidates.find((candidate) => candidate.range || candidate.from || candidate.to) ?? candidates[2];
}

function legacyDateCandidate(
  field: CustomerDateField,
  rangeValue: string | string[] | undefined,
  fromValue: string | string[] | undefined,
  toValue: string | string[] | undefined,
) {
  return {
    field,
    range: normalizeCustomerDateRangeFilter(readSearchParam(rangeValue)),
    from: readDateParam(fromValue),
    to: readDateParam(toValue),
  };
}

function readDateParam(value: string | string[] | undefined) {
  const date = readSearchParam(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';

  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? date
    : '';
}

function isValidCustomerCustomDateRange(from: string, to: string) {
  return Boolean(from && to && from <= to);
}

function readPositiveNumber(value: string | string[] | undefined) {
  const raw = readSearchParam(value).replaceAll(',', '');
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function readPageNumber(value: string | string[] | undefined) {
  const parsed = readPositiveNumber(value);
  return parsed && parsed > 0 ? parsed : 1;
}

function readPageSize(value: string | string[] | undefined) {
  const parsed = readPositiveNumber(value);
  return parsed && CUSTOMER_PAGE_SIZE_OPTIONS.includes(parsed as (typeof CUSTOMER_PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : DEFAULT_CUSTOMER_PAGE_SIZE;
}

function appendTextParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  }
}

function buildCustomerPageQueryParams(filters: CustomerFilters) {
  const params = new URLSearchParams();

  appendTextParam(params, 'q', filters.q);
  if (filters.view !== 'needs-action') appendTextParam(params, 'view', filters.view);
  appendTextParam(params, 'segment', filters.segment);
  appendTextParam(params, 'country', filters.country);
  appendTextParam(params, 'gender', filters.gender);
  if (filters.dateRange) {
    params.set('dateField', filters.dateField);
    params.set('dateRange', filters.dateRange);
    if (filters.dateRange === 'custom') {
      appendTextParam(params, 'dateFrom', filters.dateFrom);
      appendTextParam(params, 'dateTo', filters.dateTo);
    }
  }
  if (filters.sort !== 'newest') {
    params.set('sort', filters.sort);
  }
  if (filters.page > 1) {
    params.set('page', String(filters.page));
  }
  if (filters.pageSize !== DEFAULT_CUSTOMER_PAGE_SIZE) {
    params.set('pageSize', String(filters.pageSize));
  }

  return params;
}

function normalizeCustomerCountryFilter(value: string) {
  const normalized = value.toUpperCase();
  const legacyAliases: Record<string, string> = {
    CN: 'ZH',
    JP: 'JA',
    KR: 'KO',
    SG: 'EN',
    VN: 'VI',
  };
  const language = legacyAliases[normalized] ?? normalized;
  return ['VI', 'KO', 'JA', 'ZH', 'EN', 'UNKNOWN'].includes(language) ? language : '';
}

function normalizeCustomerGenderFilter(value: string) {
  const normalized = value.toLowerCase();
  const allowed = ['female', 'male', 'other', 'unknown'];
  return allowed.includes(normalized) ? normalized : '';
}

function customerCountryFilterLabel(country: string) {
  const labels: Record<string, string> = {
    EN: 'English',
    JA: 'Japanese',
    KO: 'Korean',
    UNKNOWN: 'Unknown language',
    VI: 'Vietnamese',
    ZH: 'Chinese',
  };
  return labels[country] ?? country;
}

function customerGenderFilterLabel(gender: string) {
  const labels: Record<string, string> = {
    female: 'Female',
    male: 'Male',
    other: 'Other',
    unknown: 'Not captured',
  };
  return labels[gender] ?? gender;
}
