import {
  PartnerDetailBookingJourneySection,
  type PartnerBookingJourneyRow,
} from './partner-detail-booking-journey-section';
import { readFileSync } from 'node:fs';

const sectionSource = readFileSync(new URL('./partner-detail-booking-journey-section.tsx', import.meta.url), 'utf8');

describe('PartnerDetailBookingJourneySection', () => {
  it('uses the shared Vuexy badge atom for journey steps', () => {
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).toContain('DateTimeText');
    expect(sectionSource).toContain('readonly value: ReactNode;');
    expect(sectionSource).not.toContain('PillClassBadge');
    expect(sectionSource).not.toContain('<span className={`pill ${step.tone}`}');
    expect(sectionSource).not.toContain('formatLatestAt');
  });

  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    expect(sectionSource).toContain('AdminTextLink');
    expect(sectionSource).not.toContain('className="text-link"');
  });

  it('keeps response timestamps on the shared DateTimeText atom from the detail page', () => {
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(pageSource).toContain('{participant.status} <DateTimeText fallback="Missing" value={participant.respondedAt} />');
    expect(pageSource).not.toContain('`${participant.status} ${formatDate(participant.respondedAt)}`');
  });

  it('renders booking journey rows with booking, step, and related links', () => {
    const section = PartnerDetailBookingJourneySection({
      description: 'Booking-by-booking factual journey.',
      emptyDetail: 'Use a wider date range.',
      emptyTitle: 'No partner booking journey matched this filter',
      id: 'partner-booking-journey',
      rows: buildRows(),
      title: 'Partner booking journey',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner booking journey');
    expect(rendered).toContain('Booking-by-booking factual journey.');
    expect(rendered).toContain('1 journey row(s)');
    expect(rendered).toContain('Relation');
    expect(rendered).toContain('Booking');
    expect(rendered).toContain('Detail');
    expect(rendered).toContain('Steps');
    expect(rendered).toContain('Latest');
    expect(rendered).toContain('Action');
    expect(rendered).toContain('Selected');
    expect(rendered).toContain('BK-1001 / Deep tissue');
    expect(rendered).toContain('First-pick : Customer selected');
    expect(rendered).toContain('Money : earning READY');
    expect(rendered).toContain('9 Jun 2026, 09:00');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings/BK-1001', '/chat-archive?q=BK-1001']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-success',
        'pill pill-info',
        'text-link',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('renders an empty state when no journey rows match', () => {
    const section = PartnerDetailBookingJourneySection({
      description: 'Booking-by-booking factual journey.',
      emptyDetail: 'Use a wider date range.',
      emptyTitle: 'No partner booking journey matched this filter',
      id: 'partner-booking-journey',
      rows: [],
      title: 'Partner booking journey',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('0 journey row(s)');
    expect(rendered).toContain('No partner booking journey matched this filter');
    expect(rendered).toContain('Use a wider date range.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
    expect(rendered).toContain('Showing 0 entries');
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).not.toContain('<div className="empty-state">');
  });

  it('prefers shared detail nodes over fallback booking journey detail text', () => {
    const rowsWithDetailNode = [
      {
        ...buildRows()[0],
        detail: 'Fallback money journey detail',
        detailNode: <span>Shared money journey marker</span>,
      },
    ] as unknown as PartnerBookingJourneyRow[];
    const section = PartnerDetailBookingJourneySection({
      description: 'Booking-by-booking factual journey.',
      emptyDetail: 'Use a wider date range.',
      emptyTitle: 'No partner booking journey matched this filter',
      id: 'partner-booking-journey',
      rows: rowsWithDetailNode,
      title: 'Partner booking journey',
    });
    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Shared money journey marker');
    expect(rendered).not.toContain('Fallback money journey detail');
    expect(sectionSource).toContain('readonly detailNode?: ReactNode;');
    expect(sectionSource).toContain('{row.detailNode ?? row.detail}');
  });
});

function buildRows(): PartnerBookingJourneyRow[] {
  return [
    {
      detail: 'Customer final selection and retained chat evidence.',
      heading: 'BK-1001 / Deep tissue',
      id: 'BK-1001',
      latestAt: '2026-06-09T02:00:00.000Z',
      links: [
        {
          href: '/chat-archive?q=BK-1001',
          label: 'Chat archive',
        },
      ],
      relation: 'Selected',
      steps: [
        {
          label: 'First-pick',
          tone: 'pill-success',
          value: 'Customer selected',
        },
        {
          label: 'Money',
          tone: 'pill-info',
          value: 'earning READY',
        },
      ],
    },
  ];
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
