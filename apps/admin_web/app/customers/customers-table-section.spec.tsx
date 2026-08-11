import { readFileSync } from 'node:fs';
import { CustomersTableSection } from './customers-table-section';
import type { CustomerFilters } from './customer-filters';
import type { CustomerManagementTableRow } from './customer-management-view-model';

const globalsCss = readFileSync('app/globals.css', 'utf8');

describe('CustomersTableSection', () => {
  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/customers/customers-table-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<strong>No customers found</strong>');
  });

  it('reuses the shared Admin table pagination footer atom', () => {
    const source = readFileSync('app/customers/customers-table-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).not.toContain('AdminRoundedPagination');
    expect(source).not.toContain(
      'Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries',
    );
  });

  it('uses the shared Vuexy table panel atom instead of repeating table card classes', () => {
    const source = readFileSync('app/customers/customers-table-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-customer-table-card',
    );
  });

  it('uses the shared date time atom for visible customer directory timestamps', () => {
    const source = readFileSync('app/customers/customers-table-section.tsx', 'utf8');
    const modelSource = readFileSync('app/customers/customer-management-view-model.ts', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(modelSource).toContain('readonly completedBookings: number;');
    expect(modelSource).toContain('readonly lastCompletedAt: string | null;');
    expect(source).toContain('Booking updated <DateTimeText value={row.bookingUpdatedAt} />');
    expect(source).toContain('App seen <DateTimeText value={row.lastSeenAt} />');
    expect(source).toContain('<DateTimeText value={row.lastCompletedAt} />');
    expect(modelSource).not.toContain('readonly joinedLabel: string;');
    expect(modelSource).not.toContain('readonly lastCompletedLabel: string;');
    expect(source).not.toContain('<strong>{row.joinedLabel}</strong>');
    expect(source).not.toContain('<strong>{row.lastCompletedLabel}</strong>');
    expect(modelSource).not.toContain(
      "joinedLabel: row.joinedAt ? formatDate(row.joinedAt) : 'Join date missing'",
    );
    expect(modelSource).not.toContain(
      'lastCompletedLabel: customerLastCompletedLabel(row.lastCompletedAt, row.completedBookings)',
    );
    expect(modelSource).not.toContain('readonly lastLoginDateLabel: string;');
    expect(source).not.toContain('<strong>{row.lastLoginDateLabel}</strong>');
    expect(modelSource).not.toContain(
      "lastLoginDateLabel: row.lastSeenAt ? formatDate(row.lastSeenAt) : 'Not captured'",
    );
  });

  it('keeps total paid and wallet balance as separate money values', () => {
    const source = readFileSync('app/customers/customers-table-section.tsx', 'utf8');
    const modelSource = readFileSync('app/customers/customer-management-view-model.ts', 'utf8');

    expect(source).toContain('MoneyText');
    expect(modelSource).toContain('readonly totalPaid: number;');
    expect(modelSource).toContain('readonly customerWalletBalance: number;');
    expect(source).toContain('<MoneyText amount={row.totalPaid} />');
    expect(source).toContain('<MoneyText amount={row.customerWalletBalance} />');
    expect(source).toContain('Captured payments');
    expect(source).toContain('Wallet balance');
  });

  it('uses the stable customer id instead of a shortened display label for table row keys', () => {
    const source = readFileSync('app/customers/customers-table-section.tsx', 'utf8');
    const modelSource = readFileSync('app/customers/customer-management-view-model.ts', 'utf8');

    expect(modelSource).toContain('readonly id: string;');
    expect(modelSource).toContain('id: row.id,');
    expect(source).toContain('<tr key={row.id}>');
    expect(source).not.toContain('<tr key={row.customerIdLabel}>');
    expect(source).not.toContain('{row.customerIdLabel}');
  });

  it('keeps one desktop table with a sticky customer column and scoped horizontal scroll', () => {
    expect(globalsCss).toContain('.vuexy-customer-table-card {\n  container-type: inline-size;');
    expect(globalsCss).toContain('.vuexy-customer-table-card .admin-table-scroll');
    expect(globalsCss).toContain('overflow-x: auto;');
    expect(globalsCss).toContain(
      '.vuexy-customer-table th:first-child,\n.vuexy-customer-table td:first-child',
    );
    expect(globalsCss).toContain('position: sticky;');
    expect(globalsCss).toContain('min-width: 930px;');
    expect(globalsCss).not.toContain('.vuexy-customer-table {\n  min-width: 780px;');
  });

  it('renders the five-column operational directory', () => {
    const section = CustomersTableSection({
      allCustomerCount: 35,
      filters: buildFilters({ country: 'VI', gender: 'female', view: 'all' }),
      pagination: pagination([buildRow()], { page: 1, totalRows: 12 }),
      sortLabel: 'last booking',
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer directory');
    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('+84*******00');
    expect(rendered).not.toContain('+84900000000');
    expect(rendered).not.toContain('Vietnam');
    expect(rendered).not.toContain('Female');
    expect(rendered).toContain('13 Jun 2026');
    expect(rendered).not.toContain('Not captured');
    expect(rendered).toContain('No open booking');
    expect(rendered).toContain('App seen');
    expect(rendered).toContain('12 completed · 14 total');
    expect(rendered).toContain('Payment failed 2');
    expect(rendered).toContain('Refund requests 1');
    expect(rendered).toContain('History');
    expect(rendered).toContain('No-show 1');
    expect(rendered).toContain('1.200.000 VND');
    expect(rendered).toContain('200.000 VND');
    expect(rendered).not.toContain('App locale');
    expect(rendered).not.toContain('Sign-up Date');
    expect(rendered).not.toContain('Last address');
    expect(rendered).toContain('Current situation');
    expect(rendered).toContain('Booking history');
    expect(rendered).toContain('Open work');
    expect(rendered).toContain('Payments & wallet');
    expect(rendered).toContain('Showing 1 to 10 of 12 entries');
    expect(rendered).not.toContain('Device Language');
    expect(rendered).not.toContain('Total Reservations Completed');
    expect(rendered).not.toContain('Actions');
    expect(rendered).not.toContain('View profile');
    expect(rendered).not.toContain('Payment records');
    expect(rendered).not.toContain('Chat archive');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26country%3DVI%26gender%3Dfemale',
        '/customers?view=all&country=VI&gender=female',
        '/customers?view=all&country=VI&gender=female&page=2',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-customer-table-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-customer-table',
        'vuexy-booking-person vuexy-customer-person',
        'vuexy-booking-avatar',
        'vuexy-booking-person-link',
        'vuexy-customer-attention-list',
        'vuexy-customer-value-cell',
        'vuexy-booking-table-footer vuexy-customer-table-footer',
        'admin-rounded-pagination vuexy-booking-pagination',
        'admin-person-avatar-shell',
        'admin-avatar-status-dot is-online',
      ]),
    );
    expect(classNamesIn(section)).not.toContain('vuexy-customer-actions vuexy-customer-actions-row');
  });

  it('renders the empty state when no customers match filters', () => {
    const section = CustomersTableSection({
      allCustomerCount: 35,
      filters: buildFilters(),
      pagination: pagination([]),
      sortLabel: 'name',
    });

    const rendered = textContent(section);

    expect(rendered).toContain('0');
    expect(rendered).toContain('0 customers');
    expect(rendered).toContain('Payment and review queue');
    expect(rendered).toContain('No payment or review work');
    expect(rendered).toContain(
      'There are no failed payments, requested refunds, or reported reviews to process.',
    );
    expect(rendered).toContain('Browse all 35 customers');
  });

  it('keeps the generic empty state for All customers', () => {
    const rendered = textContent(
      CustomersTableSection({
        allCustomerCount: 0,
        filters: buildFilters({ view: 'all' }),
        pagination: pagination([]),
        sortLabel: 'name',
      }),
    );

    expect(rendered).toContain('Customer directory');
    expect(rendered).toContain('No customer profiles found');
    expect(rendered).toContain('No customer accounts have been created yet.');
  });

  it.each([
    ['new-today', 'No customers joined today'],
    ['active-today', 'No app activity today'],
  ] as const)('uses a specific empty state for %s', (view, title) => {
    const rendered = textContent(
      CustomersTableSection({
        allCustomerCount: 35,
        filters: buildFilters({ view }),
        pagination: pagination([]),
        sortLabel: 'name',
      }),
    );

    expect(rendered).toContain(title);
  });

  it('distinguishes a filtered empty result from an empty directory', () => {
    const rendered = textContent(
      CustomersTableSection({
        allCustomerCount: 35,
        filters: buildFilters({ q: 'missing', view: 'all' }),
        pagination: pagination([]),
        sortLabel: 'name',
      }),
    );

    expect(rendered).toContain('No customers match these filters');
    expect(rendered).toContain('Change or clear the active filters to view customer records.');
  });

  it('renders a neutral detail lock without a profile link for directory-only operators', () => {
    const row = { ...buildRow(), detailHref: null };
    const section = CustomersTableSection({
      allCustomerCount: 1,
      filters: buildFilters({ view: 'all' }),
      pagination: pagination([row]),
      sortLabel: 'Newest first',
    });

    expect(textContent(section)).toContain('Customer detail access required');
    expect(hrefsIn(section)).not.toContain('/customers/customer-1');
  });
});

function buildRow(): CustomerManagementTableRow {
  return {
    avatarStatus: 'online',
    bookingStatusLabel: 'No open booking',
    bookingStatusTone: 'neutral',
    bookingUpdatedAt: null,
    completedBookings: 12,
    bookingCount: 14,
    detailHref: '/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26country%3DVI%26gender%3Dfemale',
    id: 'customer-1',
    initials: 'CO',
    lastSeenAt: '2026-06-12T20:15:00.000Z',
    name: 'Customer One',
    phone: '+84*******00',
    shortId: 'customer-1',
    lastCompletedAt: '2026-06-12T20:15:00.000Z',
    openSignals: [
      { label: 'Payment failed 2', tone: 'danger' },
      { label: 'Refund requests 1', tone: 'warning' },
    ],
    historySignals: [{ label: 'No-show 1', tone: 'neutral' }],
    customerWalletBalance: 200000,
    totalPaid: 1200000,
  };
}

function buildFilters(input: Partial<CustomerFilters> = {}): CustomerFilters {
  return {
    country: '',
    dateField: 'last-login',
    dateFrom: '',
    dateRange: '',
    dateTo: '',
    gender: '',
    page: 1,
    pageSize: 10,
    q: '',
    segment: '',
    sort: 'newest',
    view: 'needs-action',
    ...input,
  };
}

function pagination(
  rows: readonly CustomerManagementTableRow[],
  input: { readonly page?: number; readonly totalRows?: number } = {},
) {
  const totalRows = input.totalRows ?? rows.length;
  return {
    from: totalRows === 0 ? 0 : 1,
    page: input.page ?? 1,
    pageSize: 10,
    rows,
    to: Math.min(10, totalRows),
    totalPages: Math.max(1, Math.ceil(totalRows / 10)),
    totalRows,
  };
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
