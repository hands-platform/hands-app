import { CustomersTableSection } from './customers-table-section';
import type { CustomerManagementTableRow } from './customer-management-view-model';

describe('CustomersTableSection', () => {
  it('renders the Vuexy-style customer management columns and icon actions', () => {
    const section = CustomersTableSection({
      rows: [buildRow()],
      sortLabel: 'last booking',
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer directory');
    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('+84900000000');
    expect(rendered).toContain('vi-VN');
    expect(rendered).toContain('13 Jun 2026');
    expect(rendered).toContain('Not captured');
    expect(rendered).toContain('12');
    expect(rendered).toContain('1,200,000');
    expect(rendered).toContain('View profile');
    expect(rendered).toContain('Payment records');
    expect(rendered).toContain('Chat archive');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/customers/customer-1', '/payments?customer=customer-1', '/chat-archive?q=customer-1']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'vuexy-customer-table-card',
        'admin-table-scroll',
        'table vuexy-customer-table',
        'vuexy-customer-actions vuexy-customer-actions-row',
        'vuexy-customer-action-dropdown',
        'vuexy-customer-action-trigger',
        'vuexy-customer-action-menu',
      ]),
    );
  });

  it('renders the empty state when no customers match filters', () => {
    const section = CustomersTableSection({
      rows: [],
      sortLabel: 'name',
    });

    const rendered = textContent(section);

    expect(rendered).toContain('0');
    expect(rendered).toContain('rows');
    expect(rendered).toContain('No customers found');
    expect(rendered).toContain('Change the filters or clear the search to view customer records.');
  });
});

function buildRow(): CustomerManagementTableRow {
  return {
    chatHref: '/chat-archive?q=customer-1',
    customerIdLabel: 'customer-1',
    detailHref: '/customers/customer-1',
    deviceLanguageLabel: 'vi-VN',
    email: 'customer@example.com',
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
