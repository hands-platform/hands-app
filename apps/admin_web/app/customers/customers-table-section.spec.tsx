import { readFileSync } from 'node:fs';
import { CustomersTableSection } from './customers-table-section';
import type { CustomerFilters } from './customer-filters';
import type { CustomerManagementTableRow } from './customer-management-view-model';

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
    expect(source).not.toContain('Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries');
  });

  it('uses the shared Vuexy table panel atom instead of repeating table card classes', () => {
    const source = readFileSync('app/customers/customers-table-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-customer-table-card',
    );
  });

  it('uses the shared date time atom for last login timestamps', () => {
    const source = readFileSync('app/customers/customers-table-section.tsx', 'utf8');
    const modelSource = readFileSync('app/customers/customer-management-view-model.ts', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(modelSource).not.toContain('readonly lastLoginDateLabel: string;');
    expect(source).not.toContain('<strong>{row.lastLoginDateLabel}</strong>');
    expect(modelSource).not.toContain("lastLoginDateLabel: row.lastSeenAt ? formatDate(row.lastSeenAt) : 'Not captured'");
  });

  it('renders the Vuexy-style customer management columns without actions', () => {
    const section = CustomersTableSection({
      filters: buildFilters({ country: 'VN', gender: 'female' }),
      pagination: pagination([buildRow()], { page: 1, totalRows: 12 }),
      sortLabel: 'last booking',
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer directory');
    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('+84900000000');
    expect(rendered).toContain('Vietnam');
    expect(rendered).toContain('Female');
    expect(rendered).toContain('13 Jun 2026');
    expect(rendered).toContain('Not captured');
    expect(rendered).toContain('13 Jun 2026, 03:15 (12)');
    expect(rendered).toContain('1,200,000');
    expect(rendered).toContain('Country');
    expect(rendered).toContain('Gender');
    expect(rendered).toContain('Last Completed');
    expect(rendered).toContain('Showing 1 to 10 of 12 entries');
    expect(rendered).not.toContain('Device Language');
    expect(rendered).not.toContain('Total Reservations Completed');
    expect(rendered).not.toContain('Actions');
    expect(rendered).not.toContain('View profile');
    expect(rendered).not.toContain('Payment records');
    expect(rendered).not.toContain('Chat archive');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/customers/customer-1',
        '/customers?country=VN&gender=female',
        '/customers?country=VN&gender=female&page=2',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-customer-table-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-customer-table',
        'vuexy-booking-person vuexy-customer-person',
        'vuexy-booking-avatar',
        'vuexy-booking-person-link',
        'vuexy-booking-country-cell',
        'vuexy-booking-country-flag',
        'vuexy-booking-table-footer vuexy-customer-table-footer',
        'vuexy-booking-pagination',
        'admin-person-avatar-shell',
        'admin-avatar-status-dot is-online',
      ]),
    );
    expect(classNamesIn(section)).not.toContain('vuexy-customer-actions vuexy-customer-actions-row');
  });

  it('renders the empty state when no customers match filters', () => {
    const section = CustomersTableSection({
      filters: buildFilters(),
      pagination: pagination([]),
      sortLabel: 'name',
    });

    const rendered = textContent(section);

    expect(rendered).toContain('0');
    expect(rendered).toContain('0 customer(s)');
    expect(rendered).toContain('No customers found');
    expect(rendered).toContain('Change the filters or clear the search to view customer records.');
  });
});

function buildRow(): CustomerManagementTableRow {
  return {
    avatarStatus: 'online',
    chatHref: '/chat-archive?q=customer-1',
    countryFlag: 'VN',
    countryFlagLabel: 'Vietnam flag',
    countryLabel: 'Vietnam',
    customerIdLabel: 'customer-1',
    detailHref: '/customers/customer-1',
    deviceLanguageLabel: 'vi-VN',
    email: 'customer@example.com',
    genderLabel: 'Female',
    initials: 'CO',
    lastLoginAddressLabel: 'Not captured',
    lastSeenAt: '2026-06-12T20:15:00.000Z',
    joinedLabel: '2026-06-01',
    name: 'Customer One',
    paymentsHref: '/payments?customer=customer-1',
    phone: '+84900000000',
    lastCompletedLabel: '13 Jun 2026, 03:15 (12)',
    totalWalletAmountLabel: '1,200,000',
  };
}

function buildFilters(input: Partial<CustomerFilters> = {}): CustomerFilters {
  return {
    country: '',
    gender: '',
    joinedRange: '',
    joinedFrom: '',
    joinedTo: '',
    lastBookingRange: '',
    lastBookingFrom: '',
    lastBookingTo: '',
    lastLoginRange: '',
    lastLoginFrom: '',
    lastLoginTo: '',
    page: 1,
    pageSize: 10,
    q: '',
    sort: 'last-booking',
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
