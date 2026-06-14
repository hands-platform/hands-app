import { CustomersTableSection } from './customers-table-section';
import type { CustomerRow } from './customer-list-model';

describe('CustomersTableSection', () => {
  it('renders customer activity, finance, device, and detail link columns', () => {
    const section = CustomersTableSection({
      rows: [buildRow()],
      sortLabel: 'Last booking',
    });

    const rendered = textContent(section);
    const compactRendered = rendered.replace(/\s+/g, ' ');

    expect(rendered).toContain('All customers');
    expect(rendered).toContain('List view sorted by');
    expect(rendered).toContain('Last booking');
    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('+84900000000');
    expect(rendered).toContain('Deep tissue');
    expect(rendered).toContain('District 1');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('Repeated Partner');
    expect(rendered).toContain('Repeated selected or preferred Partner');
    expect(compactRendered).toContain('Customer 1 / admin 0 / Partner 0');
    expect(rendered).toContain('2');
    expect(rendered).toContain('chat room(s)');
    expect(rendered).toContain('1');
    expect(rendered).toContain('payment follow-up');
    expect(rendered).toContain('memo(s)');
    expect(rendered).toContain('Details');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/customers/customer-1']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['admin-table-scroll']));
  });

  it('renders the empty state when no customers match filters', () => {
    const section = CustomersTableSection({
      rows: [],
      sortLabel: 'Name',
    });

    const rendered = textContent(section);

    expect(rendered).toContain('0');
    expect(rendered).toContain('rows');
    expect(rendered).toContain('No customers found');
    expect(rendered).toContain('Change the filters or clear search to view customer records.');
  });
});

function buildRow(): CustomerRow {
  return {
    activeBookings: 1,
    addressCount: 2,
    addressSnapshotBookings: 1,
    adminClosedBookings: 0,
    bookingCount: 3,
    cancelledBookings: 1,
    capturedSpend: 1200000,
    chatMissingBookings: 0,
    chatRooms: 2,
    commonArea: 'District 1',
    commonPartner: 'Partner One',
    commonService: 'Deep tissue',
    completedBookings: 2,
    customerChoiceBookings: 1,
    customerClosedBookings: 1,
    email: 'customer@example.com',
    firstPickBookings: 1,
    id: 'customer-1',
    isLive: true,
    joinedAt: '2026-06-01T10:00:00.000Z',
    lastBookingAt: '2026-06-09T10:00:00.000Z',
    lastCompletedAt: '2026-06-08T10:00:00.000Z',
    lastCompletedLabel: 'Deep tissue massage',
    lastCompletedPartner: 'Partner One',
    lastSeenAt: '2026-06-09T10:05:00.000Z',
    latestMemoDetail: 'Needs receipt follow-up',
    latestMemoTitle: 'support.note',
    latestSessionAppVersion: '1.0.0',
    latestSessionDevice: 'device-1',
    latestSessionIp: '127.0.0.1',
    latestSessionPlatform: 'ios',
    memoCount: 1,
    name: 'Customer One',
    noShowBookings: 0,
    openMatchingBookings: 1,
    partnerClosedBookings: 0,
    paymentCount: 2,
    paymentIssues: 1,
    phone: '+84900000000',
    pushReachable: true,
    refundAmount: 100000,
    serviceLiveBookings: 0,
    activityLabel: '1 active booking(s)',
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
