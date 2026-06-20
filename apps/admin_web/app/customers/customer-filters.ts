import { formatMoney } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';

export const DEFAULT_CUSTOMER_PAGE_SIZE = 10;
export const CUSTOMER_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type CustomerFilters = {
  page: number;
  pageSize: number;
  q: string;
  booking: string;
  bookingFlow: string;
  country: string;
  gender: string;
  reachability: string;
  address: string;
  payment: string;
  chat: string;
  memo: string;
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
  seen: string;
  minBookings: number | null;
  minCompleted: number | null;
  minSpend: number | null;
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
    booking: '',
    bookingFlow: normalizeCustomerBookingFlowFilter(readSearchParam(params.bookingFlow)),
    country: normalizeCustomerCountryFilter(readSearchParam(params.country)),
    gender: normalizeCustomerGenderFilter(readSearchParam(params.gender)),
    reachability: readSearchParam(params.reachability),
    address: readSearchParam(params.address),
    payment: '',
    chat: readSearchParam(params.chat),
    memo: readSearchParam(params.memo),
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
    seen: '',
    minBookings: null,
    minCompleted: readPositiveNumber(params.minCompleted),
    minSpend: readPositiveNumber(params.minSpend),
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
  appendTextParam(params, 'bookingFlow', next.bookingFlow);
  appendTextParam(params, 'country', next.country);
  appendTextParam(params, 'gender', next.gender);
  appendTextParam(params, 'reachability', next.reachability);
  appendTextParam(params, 'address', next.address);
  appendTextParam(params, 'chat', next.chat);
  appendTextParam(params, 'memo', next.memo);
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
  appendNumberParam(params, 'minCompleted', next.minCompleted);
  appendNumberParam(params, 'minSpend', next.minSpend);

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

export function customerSortLabel(sort: string) {
  if (sort === 'last-work') return 'last completed work';
  if (sort === 'booking-count') return 'reservations high to low';
  if (sort === 'booking-count-asc') return 'reservations low to high';
  if (sort === 'completed-count') return 'completed work count';
  if (sort === 'captured-spend') return 'captured spend';
  if (sort === 'last-seen') return 'last app session';
  if (sort === 'joined') return 'first signup date';
  if (sort === 'name') return 'customer name';
  return 'latest booking progress date';
}

export function buildCustomerActiveFilters(filters: CustomerFilters) {
  const labels: string[] = [];
  if (filters.q) labels.push(`Search: ${filters.q}`);
  if (filters.booking) labels.push(`Booking: ${filters.booking}`);
  if (filters.bookingFlow)
    labels.push(`Booking flow: ${customerBookingFlowFilterLabel(filters.bookingFlow)}`);
  if (filters.country) labels.push(`Country: ${customerCountryFilterLabel(filters.country)}`);
  if (filters.gender) labels.push(`Gender: ${customerGenderFilterLabel(filters.gender)}`);
  if (filters.reachability) labels.push(`Reachability: ${filters.reachability}`);
  if (filters.address) labels.push(`Address: ${filters.address}`);
  if (filters.payment) labels.push(`Payment: ${filters.payment}`);
  if (filters.chat) labels.push(`Chat: ${filters.chat}`);
  if (filters.memo) labels.push(`Memo: ${filters.memo}`);
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
  if (filters.seen) labels.push(`Recent access: ${filters.seen}`);
  if (filters.minCompleted !== null) labels.push(`Min completed: ${filters.minCompleted}`);
  if (filters.minSpend !== null) labels.push(`Min paid amount: ${formatMoney(filters.minSpend)}`);
  if (filters.sort !== 'last-booking') labels.push(`Sort: ${customerSortLabel(filters.sort)}`);
  return labels;
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
  return [
    'last-booking',
    'last-work',
    'booking-count',
    'booking-count-asc',
    'completed-count',
    'captured-spend',
    'last-seen',
    'joined',
    'name',
  ].includes(sort)
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

function appendNumberParam(params: URLSearchParams, key: string, value: number | null) {
  if (value !== null) {
    params.set(key, String(value));
  }
}

function normalizeCustomerBookingFlowFilter(value: string) {
  const allowed = [
    'open-matching',
    'first-pick',
    'customer-choice',
    'chat-live',
    'chat-missing',
    'service-live',
    'completed-work',
    'closed-record',
    'address-snapshot',
  ];
  return allowed.includes(value) ? value : '';
}

function normalizeCustomerCountryFilter(value: string) {
  const normalized = value.toUpperCase();
  const allowed = ['VN', 'KR', 'JP', 'CN', 'SG', 'TH', 'US', 'UNKNOWN'];
  return allowed.includes(normalized) ? normalized : '';
}

function normalizeCustomerGenderFilter(value: string) {
  const normalized = value.toLowerCase();
  const allowed = ['female', 'male', 'other', 'unknown'];
  return allowed.includes(normalized) ? normalized : '';
}

function customerBookingFlowFilterLabel(flow: string) {
  const labels: Record<string, string> = {
    'open-matching': 'Open matching wait',
    'first-pick': 'First-pick pending',
    'customer-choice': 'Customer final choice',
    'chat-live': 'Chat room opened',
    'chat-missing': 'Matched but chat missing',
    'service-live': 'Service in progress',
    'completed-work': 'Completed work',
    'closed-record': 'Closed or no-show record',
    'address-snapshot': 'Address snapshot saved',
  };
  return labels[flow] ?? flow;
}

function customerCountryFilterLabel(country: string) {
  const labels: Record<string, string> = {
    CN: 'China',
    JP: 'Japan',
    KR: 'South Korea',
    SG: 'Singapore',
    TH: 'Thailand',
    UNKNOWN: 'Unknown country',
    US: 'United States',
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
