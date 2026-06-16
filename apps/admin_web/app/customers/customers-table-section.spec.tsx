import { CustomersTableSection } from './customers-table-section';
import type { CustomerManagementTableRow } from './customer-management-view-model';

describe('CustomersTableSection', () => {
  it('renders the Vuexy-style customer management columns and actions', () => {
    const section = CustomersTableSection({
      rows: [buildRow()],
      sortLabel: 'last booking',
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer directory');
    expect(rendered).toContain('customer management board');
    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('+84900000000');
    expect(rendered).toContain('2 active booking(s)');
    expect(rendered).toContain('Deep tissue');
    expect(rendered).toContain('District 1 / repeated Partner One');
    expect(rendered).toContain('In app now');
    expect(rendered).toContain('1,200,000');
    expect(rendered).toContain('support.note');
    expect(rendered).toContain('Open');
    expect(rendered).toContain('Payments');
    expect(rendered).toContain('Chats');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/customers/customer-1', '/payments?customer=customer-1', '/chat-archive?q=customer-1']),
    );
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['vuexy-customer-table-card', 'admin-table-scroll']));
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
    activityDetail: 'Last booking 2026-06-09',
    activityLabel: '2 active booking(s)',
    addressLabel: '2 saved location(s)',
    bookingLabel: '5 booking(s) / 1 first-pick / 2 final choice',
    chatHref: '/chat-archive?q=customer-1',
    chatLabel: '2 retained room(s)',
    closureLabel: '1 closed / 0 no-show',
    customerIdLabel: 'customer-1',
    detailHref: '/customers/customer-1',
    email: 'customer@example.com',
    financeDetail: '100,000 refunded / 2 payment row(s)',
    financeLabel: '1,200,000 paid',
    initials: 'CO',
    joinedLabel: '2026-06-01',
    name: 'Customer One',
    opsDetail: '2 chat room(s) / 1 memo(s) / 1 payment follow-up',
    opsLabel: 'support.note',
    paymentsHref: '/payments?customer=customer-1',
    patternDetail: 'District 1 / repeated Partner One',
    patternLabel: 'Deep tissue',
    phone: '+84900000000',
    reachabilityDetail: 'ios / push ready',
    reachabilityLabel: 'In app now',
    sessionLabel: 'ios / v1.0.0 / device-1',
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
