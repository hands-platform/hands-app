import { PartnerDetailDailyActivityDigestSection } from './partner-detail-daily-activity-digest-section';
import { readFileSync } from 'node:fs';

const sectionSource = readFileSync(
  new URL('./partner-detail-daily-activity-digest-section.tsx', import.meta.url),
  'utf8',
);

describe('PartnerDetailDailyActivityDigestSection', () => {
  it('uses the partner detail Vuexy table panel atom for the daily digest shell', () => {
    expect(sectionSource).toContain('PartnerDetailVuexyTablePanel');
    expect(sectionSource).not.toContain('AdminFilterPanel');
    expect(sectionSource).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy date time atom for activity timestamps', () => {
    expect(sectionSource).toContain('DateTimeText');
    expect(sectionSource).not.toContain('readonly formatDate: (value: string) => string;');
    expect(sectionSource).not.toContain('{formatDate(record.at)}');
    expect(sectionSource).not.toContain("day.latestAt ? formatDate(day.latestAt) : 'No date'");
  });

  it('renders date-grouped activity digest days with formatted highlight dates', () => {
    const section = PartnerDetailDailyActivityDigestSection({
      days: [
        {
          highlights: [
            {
              at: '2026-06-01T10:00:00.000Z',
              detail: 'Partner joined the open marketplace request.',
              id: 'event-1',
              title: 'Marketplace joined',
              type: 'BOOKING',
            },
          ],
          key: '2026-06-01',
          label: 'Jun 1',
          latestAt: '2026-06-01T10:00:00.000Z',
          total: 2,
          typeCounts: [
            { count: 1, type: 'BOOKING' },
            { count: 1, type: 'CHAT' },
          ],
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner daily activity digest');
    expect(rendered).toContain('Date-grouped factual partner operations records');
    expect(rendered).toContain('1 day(s)');
    expect(rendered).toContain('Day');
    expect(rendered).toContain('Events');
    expect(rendered).toContain('Highlights');
    expect(rendered).toContain('Latest');
    expect(rendered).toContain('Jun 1');
    expect(rendered).toContain('2 event(s)');
    expect(rendered).toContain('BOOKING 1 / CHAT 1');
    expect(rendered).toContain('Marketplace joined');
    expect(rendered).toContain('Partner joined the open marketplace request.');
    expect(rendered).toContain('BOOKING / 1 Jun 2026, 17:00');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'partner-daily-highlight-list',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('prefers shared detail nodes over fallback activity detail strings', () => {
    const section = PartnerDetailDailyActivityDigestSection({
      days: [
        {
          highlights: [
            {
              at: '2026-06-01T10:00:00.000Z',
              detail: 'Fallback detail string',
              detailNode: <span>Shared detail atom marker</span>,
              id: 'event-1',
              title: 'Marketplace joined',
              type: 'BOOKING',
            },
          ],
          key: '2026-06-01',
          label: 'Jun 1',
          latestAt: '2026-06-01T10:00:00.000Z',
          total: 1,
          typeCounts: [{ count: 1, type: 'BOOKING' }],
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Shared detail atom marker');
    expect(rendered).not.toContain('Fallback detail string');
    expect(sectionSource).toContain('readonly detailNode?: ReactNode;');
    expect(sectionSource).toContain('{record.detailNode ?? record.detail}');
  });

  it('renders an empty state when no daily digest rows match the filters', () => {
    const section = PartnerDetailDailyActivityDigestSection({
      days: [],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 day(s)');
    expect(rendered).toContain('No partner daily activity matched this filter');
    expect(rendered).toContain('Clear the date filter or choose a wider range.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
    expect(rendered).toContain('Showing 0 entries');
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).not.toContain('<div className="empty-state">');
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
