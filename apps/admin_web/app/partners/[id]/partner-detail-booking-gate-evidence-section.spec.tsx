import { readFileSync } from 'node:fs';

import { PartnerDetailBookingGateEvidenceSection } from './partner-detail-booking-gate-evidence-section';

describe('PartnerDetailBookingGateEvidenceSection', () => {
  it('uses the shared Vuexy badge atoms for gate evidence pills', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-booking-gate-evidence-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${attempt.tone}`}>{attempt.gateLabel}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{attempt.addressLabel}</span>');
    expect(source).not.toContain('readonly formatDate: (value?: string | null) => string;');
    expect(source).not.toContain('formatDate(latestAttempt.at)');
    expect(source).not.toContain('formatDate(attempt.at)');
  });

  it('renders booking create gate attempts as a Vuexy table', () => {
    const section = PartnerDetailBookingGateEvidenceSection({
      loadedAttempts: [
        {
          addressLabel: 'Cau Giay, Ha Noi',
          at: '2026-06-20T10:00:00.000Z',
          auditHref: '/audit-log?bucket=Booking&q=attempt-1',
          bookingMonitorHref: '/bookings?view=blocked-create&attemptId=attempt-1',
          detail: 'Requested service address is too far from current customer location.',
          distanceLabel: '51.2 km',
          gate: 'first-pick-distance',
          gateLabel: 'DISTANCE',
          id: 'attempt-1',
          reasonLabel: 'First-pick distance blocked',
          tone: 'pill-danger',
        },
      ],
      filteredAttempts: [
        {
          addressLabel: 'Cau Giay, Ha Noi',
          at: '2026-06-20T10:00:00.000Z',
          auditHref: '/audit-log?bucket=Booking&q=attempt-1',
          bookingMonitorHref: '/bookings?view=blocked-create&attemptId=attempt-1',
          detail: 'Requested service address is too far from current customer location.',
          distanceLabel: '51.2 km',
          gate: 'first-pick-distance',
          gateLabel: 'DISTANCE',
          id: 'attempt-1',
          reasonLabel: 'First-pick distance blocked',
          tone: 'pill-danger',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner booking create gate evidence');
    expect(rendered).toContain('Loaded attempts');
    expect(rendered).toContain('Filtered attempts');
    expect(rendered).toContain('Latest gate');
    expect(rendered).toContain('Gate');
    expect(rendered).toContain('Reason');
    expect(rendered).toContain('Address');
    expect(rendered).toContain('Distance');
    expect(rendered).toContain('Attempted');
    expect(rendered).toContain('DISTANCE');
    expect(rendered).toContain('First-pick distance blocked');
    expect(rendered).toContain('Requested service address is too far from current customer location.');
    expect(rendered).toContain('Cau Giay, Ha Noi');
    expect(rendered).toContain('51.2 km');
    expect(rendered).toContain('20 Jun 2026, 17:00');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/bookings?view=blocked-create&gate=first-pick-distance',
        '/bookings?view=blocked-create&attemptId=attempt-1',
        '/audit-log?bucket=Booking&q=attempt-1',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-danger',
        'pill pill-neutral',
      ]),
    );
  });

  it('renders an empty state inside the gate evidence table', () => {
    const section = PartnerDetailBookingGateEvidenceSection({
      loadedAttempts: [],
      filteredAttempts: [],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No first-pick booking create gate attempt matched this date filter.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
  });

  it('prefers shared detail nodes over fallback gate evidence text', () => {
    const section = PartnerDetailBookingGateEvidenceSection({
      loadedAttempts: [],
      filteredAttempts: [
        {
          addressLabel: 'Cau Giay, Ha Noi',
          at: '2026-06-20T10:00:00.000Z',
          auditHref: '/audit-log?bucket=Booking&q=attempt-1',
          bookingMonitorHref: '/bookings?view=blocked-create&attemptId=attempt-1',
          detail: 'Fallback GPS evidence date',
          detailNode: <span>Shared GPS evidence date marker</span>,
          distanceLabel: '51.2 km',
          gate: 'first-pick-distance',
          gateLabel: 'DISTANCE',
          id: 'attempt-1',
          reasonLabel: 'First-pick distance blocked',
          tone: 'pill-danger',
        },
      ],
    });
    const rendered = normalizeSpaces(textContent(section));
    const source = readFileSync('app/partners/[id]/partner-detail-booking-gate-evidence-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(rendered).toContain('Shared GPS evidence date marker');
    expect(rendered).not.toContain('Fallback GPS evidence date');
    expect(source).toContain('readonly detailNode?: ReactNode;');
    expect(source).toContain('attempt.detailNode ?? attempt.detail');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={currentLocationRecordedAt} />');
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
