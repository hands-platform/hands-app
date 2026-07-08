import { readSearchParam } from '../../lib/date-range';

export const DEFAULT_CUSTOMER_PAGE_SIZE = 10;
export const CUSTOMER_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type CustomerFilters = {
  page: number;
  pageSize: number;
  q: string;
  country: string;
  gender: string;
  sort: string;
  joinedRange: string;
  joinedFrom: string;
  joinedTo: string;
  lastBookingRange: string;
  lastBookingFrom: string;
  lastBookingTo: string;
  lastLoginRange: string;
  lastLoginFrom: string;
  lastLoginTo: string;
};

export type CustomerDataHrefs = {
  readonly listHref: string;
  readonly summaryHref: string;
};

export function buildCustomerFilters(params: Record<string, string | string[] | undefined>): CustomerFilters {
  const joinedRange = normalizeCustomerDateRangeFilter(readSearchParam(params.joinedRange));
  const joinedDateRange = resolveCustomerDateRange(
    joinedRange,
    readDateParam(params.joinedFrom),
    readDateParam(params.joinedTo),
  );
  const lastBookingRange = normalizeCustomerDateRangeFilter(readSearchParam(params.lastBookingRange));
  const lastBookingDateRange = resolveCustomerDateRange(
    lastBookingRange,
    readDateParam(params.lastBookingFrom),
    readDateParam(params.lastBookingTo),
  );
  const lastLoginRange = normalizeCustomerDateRangeFilter(readSearchParam(params.lastLoginRange));
  const lastLoginDateRange = resolveCustomerDateRange(
    lastLoginRange,
    readDateParam(params.lastLoginFrom),
    readDateParam(params.lastLoginTo),
  );

  return {
    page: readPageNumber(params.page),
    pageSize: readPageSize(params.pageSize),
    q: readSearchParam(params.q),
    country: normalizeCustomerCountryFilter(readSearchParam(params.country)),
    gender: normalizeCustomerGenderFilter(readSearchParam(params.gender)),
    sort: readCustomerSort(params.sort),
    joinedRange,
    joinedFrom: joinedDateRange.from,
    joinedTo: joinedDateRange.to,
    lastBookingRange,
    lastBookingFrom: lastBookingDateRange.from,
    lastBookingTo: lastBookingDateRange.to,
    lastLoginRange,
    lastLoginFrom: lastLoginDateRange.from,
    lastLoginTo: lastLoginDateRange.to,
  };
}

export function buildCustomerListHref(filters: CustomerFilters, overrides: Partial<CustomerFilters> = {}) {
  const next: CustomerFilters = {
    ...filters,
    ...overrides,
    page: overrides.page ?? 1,
  };
  const params = new URLSearchParams();

  appendTextParam(params, 'q', next.q);
  appendTextParam(params, 'country', next.country);
  appendTextParam(params, 'gender', next.gender);
  appendTextParam(params, 'joinedRange', next.joinedRange);
  if (!next.joinedRange || next.joinedRange === 'custom') {
    appendTextParam(params, 'joinedFrom', next.joinedFrom);
    appendTextParam(params, 'joinedTo', next.joinedTo);
  }
  appendTextParam(params, 'lastBookingRange', next.lastBookingRange);
  if (!next.lastBookingRange || next.lastBookingRange === 'custom') {
    appendTextParam(params, 'lastBookingFrom', next.lastBookingFrom);
    appendTextParam(params, 'lastBookingTo', next.lastBookingTo);
  }
  appendTextParam(params, 'lastLoginRange', next.lastLoginRange);
  if (!next.lastLoginRange || next.lastLoginRange === 'custom') {
    appendTextParam(params, 'lastLoginFrom', next.lastLoginFrom);
    appendTextParam(params, 'lastLoginTo', next.lastLoginTo);
  }
  if (next.sort !== 'last-booking') {
    params.set('sort', next.sort);
  }
  if (next.pageSize !== DEFAULT_CUSTOMER_PAGE_SIZE) {
    params.set('pageSize', String(next.pageSize));
  }
  if (next.page > 1) {
    params.set('page', String(next.page));
  }

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

  const summaryParams = buildCustomerDataQueryParams(filters);

  return {
    listHref: `/admin/customers?${listParams.toString()}`,
    summaryHref: summaryParams.size
      ? `/admin/customers/summary?${summaryParams.toString()}`
      : '/admin/customers/summary',
  };
}

export function customerSortLabel(sort: string) {
  if (sort === 'booking-count') return 'reservations many first';
  if (sort === 'booking-count-asc') return 'reservations few first';
  return 'latest booking progress date';
}

export function buildCustomerActiveFilters(filters: CustomerFilters) {
  const labels: string[] = [];
  if (filters.q) labels.push(`Search: ${filters.q}`);
  if (filters.country) labels.push(`Country: ${customerCountryFilterLabel(filters.country)}`);
  if (filters.gender) labels.push(`Gender: ${customerGenderFilterLabel(filters.gender)}`);
  if (filters.joinedRange) {
    labels.push(
      `Sign-up date: ${customerDateRangeFilterLabel(filters.joinedRange, filters.joinedFrom, filters.joinedTo)}`,
    );
  } else {
    if (filters.joinedFrom) labels.push(`Joined from: ${filters.joinedFrom}`);
    if (filters.joinedTo) labels.push(`Joined to: ${filters.joinedTo}`);
  }
  if (filters.lastBookingRange) {
    labels.push(
      `Last reservation: ${customerDateRangeFilterLabel(
        filters.lastBookingRange,
        filters.lastBookingFrom,
        filters.lastBookingTo,
      )}`,
    );
  } else {
    if (filters.lastBookingFrom) labels.push(`Last reservation from: ${filters.lastBookingFrom}`);
    if (filters.lastBookingTo) labels.push(`Last reservation to: ${filters.lastBookingTo}`);
  }
  if (filters.lastLoginRange) {
    labels.push(
      `Last login date: ${customerDateRangeFilterLabel(
        filters.lastLoginRange,
        filters.lastLoginFrom,
        filters.lastLoginTo,
      )}`,
    );
  } else {
    if (filters.lastLoginFrom) labels.push(`Last login from: ${filters.lastLoginFrom}`);
    if (filters.lastLoginTo) labels.push(`Last login to: ${filters.lastLoginTo}`);
  }
  if (filters.sort !== 'last-booking') labels.push(`Sort: ${customerSortLabel(filters.sort)}`);
  return labels;
}

function buildCustomerDataQueryParams(filters: CustomerFilters, options: { includeSort?: boolean } = {}) {
  const params = new URLSearchParams();

  appendTextParam(params, 'q', filters.q);
  appendTextParam(params, 'country', filters.country);
  appendTextParam(params, 'gender', filters.gender);
  appendTextParam(params, 'joinedFrom', filters.joinedFrom);
  appendTextParam(params, 'joinedTo', filters.joinedTo);
  appendTextParam(params, 'lastBookingFrom', filters.lastBookingFrom);
  appendTextParam(params, 'lastBookingTo', filters.lastBookingTo);
  appendTextParam(params, 'lastLoginFrom', filters.lastLoginFrom);
  appendTextParam(params, 'lastLoginTo', filters.lastLoginTo);
  if (options.includeSort && filters.sort !== 'last-booking') {
    appendTextParam(params, 'sort', filters.sort);
  }

  return params;
}

function normalizeCustomerDateRangeFilter(value: string) {
  const allowed = ['today', 'yesterday', '7d', '30d', 'custom'];
  return allowed.includes(value) ? value : '';
}

function resolveCustomerDateRange(range: string, from: string, to: string) {
  if (range === 'today') {
    const today = localDateParam(0);
    return { from: today, to: today };
  }
  if (range === 'yesterday') {
    const yesterday = localDateParam(-1);
    return { from: yesterday, to: yesterday };
  }
  if (range === '7d') {
    return { from: localDateParam(-6), to: localDateParam(0) };
  }
  if (range === '30d') {
    return { from: localDateParam(-29), to: localDateParam(0) };
  }

  return { from, to };
}

function localDateParam(dayOffset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function customerDateRangeFilterLabel(range: string, from: string, to: string) {
  const labels: Record<string, string> = {
    '7d': 'Last 7 days',
    '30d': 'Last month',
    custom: [from, to].filter(Boolean).join(' - ') || 'Custom period',
    today: 'Today',
    yesterday: 'Yesterday',
  };
  return labels[range] ?? range;
}

function readCustomerSort(value: string | string[] | undefined) {
  const sort = readSearchParam(value);
  return ['last-booking', 'booking-count', 'booking-count-asc'].includes(sort)
    ? sort
    : 'last-booking';
}

function readDateParam(value: string | string[] | undefined) {
  const date = readSearchParam(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
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
  appendTextParam(params, 'country', filters.country);
  appendTextParam(params, 'gender', filters.gender);
  appendTextParam(params, 'joinedRange', filters.joinedRange);
  if (!filters.joinedRange || filters.joinedRange === 'custom') {
    appendTextParam(params, 'joinedFrom', filters.joinedFrom);
    appendTextParam(params, 'joinedTo', filters.joinedTo);
  }
  appendTextParam(params, 'lastBookingRange', filters.lastBookingRange);
  if (!filters.lastBookingRange || filters.lastBookingRange === 'custom') {
    appendTextParam(params, 'lastBookingFrom', filters.lastBookingFrom);
    appendTextParam(params, 'lastBookingTo', filters.lastBookingTo);
  }
  appendTextParam(params, 'lastLoginRange', filters.lastLoginRange);
  if (!filters.lastLoginRange || filters.lastLoginRange === 'custom') {
    appendTextParam(params, 'lastLoginFrom', filters.lastLoginFrom);
    appendTextParam(params, 'lastLoginTo', filters.lastLoginTo);
  }
  if (filters.sort !== 'last-booking') {
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
  const allowed = ['VN', 'KR', 'JP', 'CN', 'SG', 'UNKNOWN'];
  return allowed.includes(normalized) ? normalized : '';
}

function normalizeCustomerGenderFilter(value: string) {
  const normalized = value.toLowerCase();
  const allowed = ['female', 'male', 'other', 'unknown'];
  return allowed.includes(normalized) ? normalized : '';
}

function customerCountryFilterLabel(country: string) {
  const labels: Record<string, string> = {
    CN: 'China',
    JP: 'Japan',
    KR: 'South Korea',
    SG: 'Singapore',
    UNKNOWN: 'Unknown country',
    VN: 'Vietnam',
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
