import { PartnerDetailCommandSnapshotSection } from './partner-detail-command-snapshot-section';
import { readFileSync } from 'node:fs';

describe('PartnerDetailCommandSnapshotSection', () => {
  it('uses the shared Vuexy trace summary atom for command snapshot links', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-command-snapshot-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary partner-detail-summary-rail-grid">');
  });

  it('builds the command snapshot on the shared Vuexy AdminSection surface', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-command-snapshot-section.tsx', 'utf8');

    expect(source).toContain("import { AdminSection } from '../../../components/admin-surface';");
    expect(source).toContain('<AdminSection');
    expect(source).toContain('className="partner-detail-section-band admin-mb-16"');
    expect(source).toContain('bodyClassName="partner-detail-section-band-body"');
    expect(source).toContain('headerClassName="partner-detail-section-band-header"');
    expect(source).not.toContain('<section className="partner-detail-section-band admin-mb-16"');
  });

  it('renders command snapshot fact groups with links', () => {
    const section = PartnerDetailCommandSnapshotSection({
      items: [
        {
          helper: '4 completed bookings in this filter.',
          href: '#booking-chat-records',
          label: 'Completed work',
          value: '4',
        },
        {
          helper: 'Latest retained chat and staff records.',
          href: '#app-activity',
          label: 'Timeline',
          value: '12',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner command summary');
    expect(rendered).toContain('Filter-aware facts for this partner');
    expect(rendered).toContain('2 fact groups');
    expect(rendered).toContain('Completed work');
    expect(rendered).toContain('4 completed bookings in this filter.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#booking-chat-records', '#app-activity']));
  });

  it('renders a zero count when no command facts are available', () => {
    const section = PartnerDetailCommandSnapshotSection({ items: [] });

    expect(normalizedText(section)).toContain('0 fact groups');
  });

  it('uses a shared badge atom for the command fact count', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-command-snapshot-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{items.length} fact groups</span>');
  });

  it('prefers shared helper nodes over fallback command helper text', () => {
    const section = PartnerDetailCommandSnapshotSection({
      items: [
        {
          helper: 'Fallback command helper date',
          helperNode: <span>Shared command helper date marker</span>,
          href: '#app-activity',
          label: 'Latest event',
          value: 'Location updated',
        },
      ],
    });
    const rendered = normalizedText(section);
    const source = readFileSync('app/partners/[id]/partner-detail-command-snapshot-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(rendered).toContain('Shared command helper date marker');
    expect(rendered).not.toContain('Fallback command helper date');
    expect(source).toContain('readonly helperNode?: ReactNode;');
    expect(source).toContain('item.helperNode ?? item.helper');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={latestEvent.at} />');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={bookingLatestActivityAt(latestCompletedBooking)} />');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={latestAccessAt} />');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={latestStaffRecord.at} />');
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

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
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
