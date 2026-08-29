import { readFileSync } from 'node:fs';

import {
  CustomerDetailBehaviorContext,
  CustomerDetailOverviewShell,
  type CustomerDetailOverviewFact,
  type CustomerDetailPartnerRail,
} from './customer-detail-overview-shell';

describe('CustomerDetailOverviewShell', () => {
  it('uses the shared Vuexy badge atom for status badges', () => {
    const source = readFileSync('app/customers/[id]/customer-detail-overview-shell.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminProfileOverviewCard');
    expect(source).toContain("import { AdminCard } from '../../../components/admin-surface';");
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).not.toContain('<AdminCard className="customer-detail-overview-card">');
    expect(source).not.toContain('<section className="customer-detail-usage-summary">');
    expect(source).not.toContain('<section className="customer-detail-partner-rail"');
    expect(source).not.toContain('<div className="customer-detail-highlight-grid">');
    expect(source).not.toContain('<div className="customer-detail-usage-summary-grid">');
    expect(source).not.toContain('AdminSummaryCardGrid');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<span className="pill pill-info" key={badge}>');
    expect(source).not.toContain('<p className="customer-detail-partner-empty">{rail.emptyMessage}</p>');
  });

  it('scopes customer overview typography CSS to local content blocks', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.customer-detail-identity-copy h3');
    expect(css).toContain('.customer-detail-identity-copy p');
    expect(css).toContain('.customer-detail-fact-list span');
    expect(css).not.toContain('.customer-detail-overview-card h2');
    expect(css).not.toContain('.customer-detail-overview-card p');
    expect(css).not.toContain('.customer-detail-overview-card span,');
    expect(css).not.toContain('.customer-detail-overview-card small,');
    expect(css).not.toContain('.customer-detail-overview-card small');
  });

  it('keeps shared date atoms for profile facts and Partner activity copy', () => {
    const source = readFileSync('app/customers/[id]/customer-detail-overview-shell.tsx', 'utf8');
    const pageSource = readFileSync('app/customers/[id]/page.tsx', 'utf8');

    expect(source).toContain('readonly helper: ReactNode;');
    expect(pageSource).toContain('<DateTimeText value={favorite.createdAt} />');
    expect(pageSource).toContain('<DateTimeText value={view.lastViewedAt} />');
    expect(pageSource).toContain('<DateTimeText value={bookingLatestActivityAt(booking)} />');
    expect(pageSource).not.toContain('Usage and region summary');
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

  it('renders a focused profile and contact card without summary cards', () => {
    const section = CustomerDetailOverviewShell({
      avatarStatus: 'online',
      facts: buildFacts(),
      name: 'Customer One',
      statusBadges: ['Active booking', 'Push ready', 'In app now'],
      subtitle: '+84900000000 / customer@example.com',
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('Active booking');
    expect(rendered).toContain('Profile and contact');
    expect(rendered).toContain('Customer ID');
    expect(rendered).not.toContain('Usage and region summary');
    expect(rendered).not.toContain('Favorite Partners');
    expect(rendered).not.toContain('Customer record navigation');
    expect(rendered).not.toContain('Open latest booking');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-person-avatar-shell',
        'admin-avatar-status-dot is-online',
        'card admin-card admin-profile-overview-card customer-detail-overview-card',
        'vuexy-booking-avatar customer-detail-avatar',
      ]),
    );
  });

  it('renders Partner relationship rails separately from the profile card', () => {
    const section = CustomerDetailBehaviorContext({ partnerRails: buildPartnerRails() });
    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Favorite Partners');
    expect(rendered).toContain('Smoke Partner');
    expect(rendered).toContain('1/3');
    expect(rendered).toContain('No viewed Partner profile data is loaded for this customer yet.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'customer-detail-partner-rail-grid',
        'card admin-card customer-detail-partner-rail',
        'empty-state customer-detail-partner-empty',
        'vuexy-booking-avatar is-partner',
      ]),
    );
  });

  it('keeps profile contact and saved addresses inside the shared profile overview card', () => {
    const section = CustomerDetailOverviewShell({
      avatarStatus: 'online',
      contactRows: [
        { id: 'address-1', label: 'Selected service address', value: 'District 1, Ho Chi Minh City' },
      ],
      facts: buildFacts(),
      name: 'Customer One',
      statusBadges: ['Push ready'],
      subtitle: '+84900000000 / customer@example.com',
    });
    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('Profile and contact');
    expect(rendered).toContain('Saved addresses');
    expect(rendered).toContain('Selected service address');
    expect(rendered).toContain('District 1, Ho Chi Minh City');
    expect(classNamesIn(section)).toContain(
      'card admin-card admin-profile-overview-card customer-detail-overview-card',
    );
    expect(classNamesIn(section)).not.toContain('admin-summary-card-grid customer-detail-highlight-grid');
  });
});

function buildFacts(): readonly CustomerDetailOverviewFact[] {
  return [
    { label: 'Customer ID', value: 'customer-1', helper: 'Stable admin customer profile id.' },
    { label: 'Phone', value: '+84900000000', helper: 'customer@example.com' },
  ];
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
