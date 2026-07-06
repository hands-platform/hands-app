import { readFileSync } from 'node:fs';

import {
  CustomerDetailOverviewShell,
  type CustomerDetailOverviewFact,
  type CustomerDetailOverviewHighlight,
  type CustomerDetailPartnerRail,
  type CustomerDetailUsageSummary,
} from './customer-detail-overview-shell';

describe('CustomerDetailOverviewShell', () => {
  it('uses the shared Vuexy badge atom for status badges', () => {
    const source = readFileSync('app/customers/[id]/customer-detail-overview-shell.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminProfileOverviewCard');
    expect(source).toContain('AdminSummaryCardGrid');
    expect(source).not.toContain('<AdminCard className="customer-detail-overview-card">');
    expect(source).not.toContain('<div className="customer-detail-highlight-grid">');
    expect(source).not.toContain('<div className="customer-detail-usage-summary-grid">');
    expect(source).not.toContain('<span className="pill pill-info" key={badge}>');
    expect(source).not.toContain('<p className="customer-detail-partner-empty">{rail.emptyMessage}</p>');
  });

  it('accepts shared date atoms for usage summary helper copy', () => {
    const source = readFileSync('app/customers/[id]/customer-detail-overview-shell.tsx', 'utf8');
    const pageSource = readFileSync('app/customers/[id]/page.tsx', 'utf8');

    expect(source).toContain('readonly helper: ReactNode;');
    expect(pageSource).toContain('<DateTimeText value={latestSession.lastSeenAt} />');
    expect(pageSource).toContain('<DateTimeText value={primaryRegion.latestAt} />');
    expect(pageSource).toContain('<DateTimeText value={region.latestAt} />');
    expect(pageSource).not.toContain('`Latest ${formatDate(latestSession.lastSeenAt)} /');
    expect(pageSource).not.toContain('latest ${formatDate(primaryRegion.latestAt)}');
    expect(pageSource).not.toContain('helper: `Latest ${formatDate(region.latestAt)}`');
  });

  it('renders customer overview date fact values through the shared date atom', () => {
    const source = readFileSync('app/customers/[id]/customer-detail-overview-shell.tsx', 'utf8');
    const section = CustomerDetailOverviewShell({
      avatarStatus: 'online',
      facts: [
        {
          label: 'Sign-up Date',
          value: 'Unknown',
          valueDateTimeFallback: 'Unknown',
          valueDateTimeValue: '2026-07-01T00:00:00.000Z',
          helper: 'Stored account timestamp.',
        },
      ],
      highlights: buildHighlights(),
      name: 'Customer One',
      statusBadges: ['Active booking'],
      subtitle: '+84900000000 / customer@example.com',
    });

    expect(source).toContain("from '../../../components/date-time-text'");
    expect(source).toContain('readonly valueDateTimeFallback?: string;');
    expect(source).toContain('readonly valueDateTimeValue?: string | null;');
    expect(source).toContain('customerDetailOverviewFactValue(fact)');
    expect(classNamesIn(section)).toContain('date-time-text');
  });

  it('renders a focused one-card customer overview', () => {
    const section = CustomerDetailOverviewShell({
      avatarStatus: 'online',
      facts: buildFacts(),
      highlights: buildHighlights(),
      name: 'Customer One',
      partnerRails: buildPartnerRails(),
      statusBadges: ['Active booking', 'Push ready', 'In app now'],
      subtitle: '+84900000000 / customer@example.com',
      usageSummary: buildUsageSummary(),
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('Active booking');
    expect(rendered).toContain('Captured spend');
    expect(rendered).toContain('Favorite Partners');
    expect(rendered).toContain('Smoke Partner');
    expect(rendered).toContain('Usage and region summary');
    expect(rendered).toContain('Primary booking region');
    expect(rendered).toContain('District 1, Ho Chi Minh City');
    expect(rendered).toContain('No live GPS polling');
    expect(rendered).toContain('1/3');
    expect(rendered).toContain('No viewed Partner profile data is loaded for this customer yet.');
    expect(rendered).not.toContain('Customer record navigation');
    expect(rendered).not.toContain('Open latest booking');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-person-avatar-shell',
        'admin-avatar-status-dot is-online',
        'card admin-card admin-profile-overview-card customer-detail-overview-card',
        'admin-summary-card-grid customer-detail-highlight-grid',
        'card admin-card admin-summary-card',
        'vuexy-booking-avatar customer-detail-avatar',
        'customer-detail-usage-summary',
        'admin-summary-card-grid customer-detail-usage-summary-grid',
        'customer-detail-usage-region-list',
        'customer-detail-partner-rail-grid',
        'empty-state customer-detail-partner-empty',
        'vuexy-booking-avatar is-partner',
      ]),
    );
  });
});

function buildFacts(): readonly CustomerDetailOverviewFact[] {
  return [
    { label: 'Customer ID', value: 'customer-1', helper: 'Stable admin customer profile id.' },
    { label: 'Phone', value: '+84900000000', helper: 'customer@example.com' },
  ];
}

function buildHighlights(): readonly CustomerDetailOverviewHighlight[] {
  return [
    { label: 'Bookings', value: '5', helper: '2 active / 1 completed' },
    { label: 'Captured spend', value: '1,200,000', helper: '0 refund row(s)' },
  ];
}

function buildUsageSummary(): CustomerDetailUsageSummary {
  return {
    title: 'Usage and region summary',
    helper: 'Built from stored sessions, service addresses, and Partner links. No live GPS polling.',
    items: [
      { label: 'App sessions', value: '3', helper: 'Latest 13 Jun 2026, 03:02' },
      { label: 'Primary booking region', value: 'District 1, Ho Chi Minh City', helper: '2 booking row(s)' },
    ],
    regionRows: [
      {
        label: 'District 1, Ho Chi Minh City',
        value: '2',
        helper: 'Service address snapshots',
      },
    ],
  };
}

function buildPartnerRails(): readonly CustomerDetailPartnerRail[] {
  return [
    {
      title: 'Viewed Partners',
      helper: 'Partner profiles this customer opened in the app.',
      emptyMessage: 'No viewed Partner profile data is loaded for this customer yet.',
      partners: [],
    },
    {
      title: 'Favorite Partners',
      helper: 'Partners the customer saved for direct requests.',
      emptyMessage: 'No favorite Partner data is loaded for this customer yet.',
      totalCount: 3,
      partners: [
        {
          helper: 'Latest completed Jun 12, 2026',
          href: '/partners/provider-1',
          id: 'provider-1',
          label: 'Smoke Partner',
          status: 'working',
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
