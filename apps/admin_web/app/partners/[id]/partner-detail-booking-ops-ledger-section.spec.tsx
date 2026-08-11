import { readFileSync } from 'node:fs';

import { PartnerDetailBookingOpsLedgerSection } from './partner-detail-booking-ops-ledger-section';

describe('PartnerDetailBookingOpsLedgerSection', () => {
  it('uses the shared Vuexy badge atom for booking status', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-booking-ops-ledger-section.tsx', 'utf8');

    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain(
      '<span className={`pill ${statusPillClass(row.status)}`}>{row.status}</span>',
    );
  });

  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-booking-ops-ledger-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('uses the partner detail Vuexy table panel atom for the booking ops ledger surface', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-booking-ops-ledger-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('renders booking operation notes with shared table styling and links', () => {
    const section = PartnerDetailBookingOpsLedgerSection({
      rows: [
        {
          bookingLabel: 'BK-1001 / 9 Jun 2026',
          chatHref: '/chat-archive?q=BK-1001',
          closeoutDetail: 'Admin confirmed no-show evidence.',
          closeoutStatus: 'Closeout reviewed',
          id: 'BK-1001',
          noteDetail: 'Partner reported customer unavailable.',
          noteStatus: 'Manual note saved',
          relation: 'Selected',
          serviceLabel: 'Deep tissue',
          status: 'COMPLETED',
          taskDetail: 'Review retained chat transcript.',
          taskStatus: 'Evidence task',
        },
      ],
      statusPillClass: (status) => (status === 'COMPLETED' ? 'pill-success' : 'pill-neutral'),
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Booking operations note ledger');
    expect(rendered).toContain('1 booking note row(s)');
    expect(rendered).toContain('BK-1001 / 9 Jun 2026');
    expect(rendered).toContain('Manual note saved');
    expect(rendered).toContain('Evidence task');
    expect(rendered).toContain('Closeout reviewed');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings/BK-1001', '/chat-archive?q=BK-1001']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'text-link admin-ml-10',
        'pill pill-success',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('renders the existing empty message outside the table', () => {
    const section = PartnerDetailBookingOpsLedgerSection({
      rows: [],
      statusPillClass: () => 'pill-neutral',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('0 booking note row(s)');
    expect(rendered).toContain(
      'No booking-level operation notes or staff tasks matched this partner date filter.',
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
    expect(rendered).toContain('Showing 0 entries');
  });

  it('prefers shared date nodes over fallback booking ops date text', () => {
    const section = PartnerDetailBookingOpsLedgerSection({
      rows: [
        {
          bookingLabel: 'Fallback booking date',
          bookingLabelNode: <span>Shared booking ops date marker</span>,
          chatHref: '/chat-archive?q=BK-1002',
          closeoutDetail: 'Fallback closeout date',
          closeoutDetailNode: <span>Shared closeout date marker</span>,
          closeoutStatus: 'Closeout reviewed',
          id: 'BK-1002',
          noteDetail: 'Partner reported customer unavailable.',
          noteStatus: 'Manual note saved',
          relation: 'Selected',
          serviceLabel: 'Deep tissue',
          status: 'COMPLETED',
          taskDetail: 'Review retained chat transcript.',
          taskStatus: 'Evidence task',
        },
      ],
      statusPillClass: () => 'pill-success',
    });
    const rendered = normalizeSpaces(textContent(section));
    const source = readFileSync('app/partners/[id]/partner-detail-booking-ops-ledger-section.tsx', 'utf8');
    const modelSource = readFileSync('app/partners/[id]/partner-detail-record-summary-model.tsx', 'utf8');

    expect(rendered).toContain('Shared booking ops date marker');
    expect(rendered).toContain('Shared closeout date marker');
    expect(rendered).not.toContain('Fallback booking date');
    expect(rendered).not.toContain('Fallback closeout date');
    expect(source).toContain('bookingLabelNode?: ReactNode;');
    expect(source).toContain('closeoutDetailNode?: ReactNode;');
    expect(source).toContain('{row.bookingLabelNode ?? row.bookingLabel}');
    expect(source).toContain('{row.closeoutDetailNode ?? row.closeoutDetail}');
    expect(modelSource).toContain(
      '<DateTimeText fallback="Missing" value={bookingRecordCreatedAt(booking)} />',
    );
    expect(modelSource).toContain(
      '<DateTimeText fallback="Missing" value={booking.closedAt} /> / {bookingClosureLabel(booking)}',
    );
  });
});

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

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
