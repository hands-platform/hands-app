import {
  CustomerDetailOverviewShell,
  type CustomerDetailOverviewFact,
  type CustomerDetailOverviewHighlight,
  type CustomerDetailPartnerRail,
} from './customer-detail-overview-shell';

describe('CustomerDetailOverviewShell', () => {
  it('renders a focused one-card customer overview', () => {
    const section = CustomerDetailOverviewShell({
      avatarStatus: 'online',
      facts: buildFacts(),
      highlights: buildHighlights(),
      name: 'Customer One',
      partnerRails: buildPartnerRails(),
      statusBadges: ['Active booking', 'Push ready', 'In app now'],
      subtitle: '+84900000000 / customer@example.com',
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('Active booking');
    expect(rendered).toContain('Captured spend');
    expect(rendered).toContain('Favorite Partners');
    expect(rendered).toContain('Smoke Partner');
    expect(rendered).toContain('No viewed Partner profile data is loaded for this customer yet.');
    expect(rendered).not.toContain('Customer record navigation');
    expect(rendered).not.toContain('Open latest booking');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-person-avatar-shell',
        'admin-avatar-status-dot is-online',
        'card customer-detail-overview-card',
        'vuexy-booking-avatar customer-detail-avatar',
        'customer-detail-partner-rail-grid',
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
