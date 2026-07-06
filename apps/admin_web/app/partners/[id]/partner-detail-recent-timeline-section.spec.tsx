import { PartnerDetailRecentTimelineSection } from './partner-detail-recent-timeline-section';
import { readFileSync } from 'node:fs';

const sectionSource = readFileSync(new URL('./partner-detail-recent-timeline-section.tsx', import.meta.url), 'utf8');

describe('PartnerDetailRecentTimelineSection', () => {
  it('uses the partner detail Vuexy table panel atom for the recent timeline shell', () => {
    expect(sectionSource).toContain('PartnerDetailVuexyTablePanel');
    expect(sectionSource).not.toContain('AdminFilterPanel');
    expect(sectionSource).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy badge atom for timeline event type', () => {
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).toContain('DateTimeText');
    expect(sectionSource).not.toContain('<span className="pill pill-info">{record.type}</span>');
    expect(sectionSource).not.toContain('readonly formatDate: (value: string) => string;');
    expect(sectionSource).not.toContain('{formatDate(record.at)}');
  });

  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    expect(sectionSource).toContain('AdminTextLink');
    expect(sectionSource).not.toContain('className="text-link"');
  });

  it('renders recent partner timeline records with links and formatted dates', () => {
    const section = PartnerDetailRecentTimelineSection({
      records: [
        {
          at: '2026-06-01T10:00:00.000Z',
          detail: 'Partner accepted a first-pick request.',
          href: '#booking-chat-records',
          id: 'event-1',
          title: 'First-pick accepted',
          type: 'BOOKING',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner recent operations timeline');
    expect(rendered).toContain('Latest factual partner events');
    expect(rendered).toContain('Open full timeline');
    expect(rendered).toContain('Type');
    expect(rendered).toContain('Event');
    expect(rendered).toContain('Detail');
    expect(rendered).toContain('Latest');
    expect(rendered).toContain('BOOKING');
    expect(rendered).toContain('First-pick accepted');
    expect(rendered).toContain('Partner accepted a first-pick request.');
    expect(rendered).toContain('1 Jun 2026, 17:00');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#app-activity', '#booking-chat-records']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-info',
        'text-link',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('renders an empty state when no records match the filters', () => {
    const section = PartnerDetailRecentTimelineSection({
      records: [],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No partner event matched this filter');
    expect(rendered).toContain('Clear the date filter or choose a wider period.');
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

  it('normalizes internal provider wording in timeline titles and details', () => {
    const section = PartnerDetailRecentTimelineSection({
      records: [
        {
          at: '2026-06-01T10:00:00.000Z',
          detail: 'System / {"providerProfileId":"provider-1"}',
          href: '#app-activity',
          id: 'event-2',
          title: 'provider.supabase_role_sync.skipped',
          type: 'OPS',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner Supabase Role Sync Skipped');
    expect(rendered).toContain('partnerProfileId');
    expect(rendered).not.toContain('provider.supabase_role_sync.skipped');
    expect(rendered).not.toContain('provider.');
    expect(rendered).not.toContain('providerProfileId');
  });

  it('humanizes internal action slugs in timeline titles', () => {
    const section = PartnerDetailRecentTimelineSection({
      records: [
        {
          at: '2026-06-01T10:00:00.000Z',
          detail: 'Booking match accepted.',
          href: '#booking-chat-records',
          id: 'event-3',
          title: 'booking.matched.first_pick_accepted',
          type: 'BOOKING',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Booking Matched First Pick Accepted');
    expect(rendered).not.toContain('booking.matched.first_pick_accepted');
  });

  it('prefers shared detail nodes over fallback timeline detail text', () => {
    const recordsWithDetailNode = [
      {
        at: '2026-06-01T10:00:00.000Z',
        detail: 'Fallback money string',
        detailNode: <span>Shared money atom marker</span>,
        href: '#app-activity',
        id: 'event-4',
        title: 'Earning recorded',
        type: 'EARNING',
      },
    ] as unknown as Parameters<typeof PartnerDetailRecentTimelineSection>[0]['records'];
    const section = PartnerDetailRecentTimelineSection({ records: recordsWithDetailNode });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Shared money atom marker');
    expect(rendered).not.toContain('Fallback money string');
    expect(sectionSource).toContain('detailNode?: ReactNode;');
    expect(sectionSource).toContain('{record.detailNode ?? marketplaceDisplayText(record.detail)}');
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
