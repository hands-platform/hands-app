import { readFileSync } from 'node:fs';
import { PartnerDetailAppActivitySection } from './partner-detail-app-activity-section';

const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

describe('PartnerDetailAppActivitySection', () => {
  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-app-activity-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<strong>No activity matched this date filter</strong>');
  });

  it('uses the shared Vuexy badge atom for activity type', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-app-activity-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('<span className="pill pill-info">{record.type}</span>');
    expect(source).not.toContain('readonly atLabel: string;');
    expect(source).not.toContain('{record.atLabel}');
    expect(pageSource).not.toContain('atLabel: formatDate(record.at)');
  });

  it('renders recent app activity as a Vuexy table', () => {
    const section = PartnerDetailAppActivitySection({
      summary: [
        {
          helper: 'Latest app session.',
          label: 'Last login',
          value: '20 Jun 2026, 10:00',
        },
      ],
      rows: [
        {
          at: '2026-06-20T10:10:00.000Z',
          detail: 'Partner refreshed working location before receiving new requests.',
          key: 'location-1',
          title: 'Location updated',
          type: 'LOCATION',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Recent app and operations activity');
    expect(rendered).toContain('1 event(s)');
    expect(rendered).toContain('Last login');
    expect(rendered).toContain('20 Jun 2026, 10:00');
    expect(rendered).toContain('Type');
    expect(rendered).toContain('Activity');
    expect(rendered).toContain('Timeline');
    expect(rendered).toContain('LOCATION');
    expect(rendered).toContain('Location updated');
    expect(rendered).toContain('Partner refreshed working location before receiving new requests.');
    expect(rendered).toContain('20 Jun 2026, 17:10');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-info',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('renders the empty activity state inside the table', () => {
    const section = PartnerDetailAppActivitySection({
      summary: [],
      rows: [],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('0 event(s)');
    expect(rendered).toContain('No activity matched this date filter');
    expect(rendered).toContain('Clear the date filter or choose a wider range');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
    expect(rendered).toContain('Showing 0 entries');
  });

  it('prefers shared detail nodes over fallback activity detail text', () => {
    const rowsWithDetailNode = [
      {
        at: '2026-06-20T10:10:00.000Z',
        detail: 'Fallback money string',
        detailNode: <span>Shared money atom marker</span>,
        key: 'earning-1',
        title: 'Earning recorded',
        type: 'EARNING',
      },
    ] as unknown as Parameters<typeof PartnerDetailAppActivitySection>[0]['rows'];
    const section = PartnerDetailAppActivitySection({
      summary: [],
      rows: rowsWithDetailNode,
    });
    const rendered = normalizeSpaces(textContent(section));
    const source = readFileSync('app/partners/[id]/partner-detail-app-activity-section.tsx', 'utf8');

    expect(rendered).toContain('Shared money atom marker');
    expect(rendered).not.toContain('Fallback money string');
    expect(source).toContain('detailNode?: ReactNode;');
    expect(source).toContain('{record.detailNode ?? record.detail}');
  });

  it('keeps sanction detail timestamps on shared DateTimeText nodes from the detail page', () => {
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={sanction.liftedAt} />');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={sanction.expiresAt} />');
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
