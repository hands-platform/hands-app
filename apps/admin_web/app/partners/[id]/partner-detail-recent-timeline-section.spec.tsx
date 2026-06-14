import { PartnerDetailRecentTimelineSection } from './partner-detail-recent-timeline-section';

describe('PartnerDetailRecentTimelineSection', () => {
  it('renders recent partner timeline records with links and formatted dates', () => {
    const section = PartnerDetailRecentTimelineSection({
      formatDate: (value) => `formatted ${value}`,
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
    expect(rendered).toContain('BOOKING');
    expect(rendered).toContain('First-pick accepted');
    expect(rendered).toContain('Partner accepted a first-pick request.');
    expect(rendered).toContain('formatted 2026-06-01T10:00:00.000Z');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#app-activity', '#booking-chat-records']));
  });

  it('renders an empty state when no records match the filters', () => {
    const section = PartnerDetailRecentTimelineSection({
      formatDate: (value) => value,
      records: [],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No partner event matched this filter');
    expect(rendered).toContain('Clear the date filter or choose a wider period.');
  });

  it('normalizes internal provider wording in timeline titles and details', () => {
    const section = PartnerDetailRecentTimelineSection({
      formatDate: (value) => value,
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

    expect(rendered).toContain('partner.supabase_role_sync.skipped');
    expect(rendered).toContain('partnerProfileId');
    expect(rendered).not.toContain('provider.');
    expect(rendered).not.toContain('providerProfileId');
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
