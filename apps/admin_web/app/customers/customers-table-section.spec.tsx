import { CustomersTableSection } from './customers-table-section';
import type { CustomerManagementTableRow } from './customer-management-view-model';

describe('CustomersTableSection', () => {
  it('renders the Vuexy-style customer management columns without actions', () => {
    const section = CustomersTableSection({
      rows: [buildRow()],
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
    expect(rendered).toContain('12');
    expect(rendered).toContain('1,200,000');
    expect(rendered).toContain('Country');
    expect(rendered).toContain('Gender');
    expect(rendered).not.toContain('Device Language');
    expect(rendered).not.toContain('Actions');
    expect(rendered).not.toContain('View profile');
    expect(rendered).not.toContain('Payment records');
    expect(rendered).not.toContain('Chat archive');
    expect(hrefsIn(section)).toEqual(['/customers/customer-1']);
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-customer-table-card',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-customer-table',
        'vuexy-booking-person vuexy-customer-person',
        'vuexy-booking-person-link',
        'vuexy-booking-country-cell',
        'vuexy-booking-country-flag',
        'admin-person-avatar-shell',
        'admin-avatar-status-dot is-online',
      ]),
    );
    expect(classNamesIn(section)).not.toContain('vuexy-customer-actions vuexy-customer-actions-row');
  });

  it('renders the empty state when no customers match filters', () => {
    const section = CustomersTableSection({
      rows: [],
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
    lastLoginDateLabel: '13 Jun 2026, 03:15',
    joinedLabel: '2026-06-01',
    name: 'Customer One',
    paymentsHref: '/payments?customer=customer-1',
    phone: '+84900000000',
    totalReservationsCompletedLabel: '12',
    totalWalletAmountLabel: '1,200,000',
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
