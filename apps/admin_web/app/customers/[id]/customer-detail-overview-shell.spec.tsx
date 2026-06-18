import {
  CustomerDetailOverviewShell,
  type CustomerDetailOverviewAction,
  type CustomerDetailOverviewFact,
  type CustomerDetailOverviewHighlight,
  type CustomerDetailOverviewNavItem,
} from './customer-detail-overview-shell';

describe('CustomerDetailOverviewShell', () => {
  it('renders overview facts, quick actions, and section navigation', () => {
    const section = CustomerDetailOverviewShell({
      actions: buildActions(),
      avatarStatus: 'online',
      facts: buildFacts(),
      highlights: buildHighlights(),
      name: 'Customer One',
      navigation: buildNavigation(),
      statusBadges: ['Active booking', 'Push ready', 'In app now'],
      subtitle: '+84900000000 / customer@example.com',
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('Active booking');
    expect(rendered).toContain('Captured spend');
    expect(rendered).toContain('Open latest booking');
    expect(rendered).toContain('Customer record navigation');
    expect(rendered).toContain('Operations digest');
    expect(rendered).toContain('Chat retention');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings/booking-1', '/payments?customer=customer-1', '#customer-activity']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'customer-detail-sidebar',
        'admin-person-avatar-shell',
        'admin-avatar-status-dot is-online',
        'card customer-detail-overview-card',
        'customer-detail-nav-list',
      ]),
    );
  });
});

function buildActions(): readonly CustomerDetailOverviewAction[] {
  return [
    { href: '/bookings/booking-1', label: 'Open latest booking' },
    { href: '/payments?customer=customer-1', label: 'Open payments' },
    { href: '/chat-archive?q=customer-1', label: 'Open chat archive' },
  ];
}

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

function buildNavigation(): readonly CustomerDetailOverviewNavItem[] {
  return [
    {
      href: '#customer-operations-digest',
      label: 'Operations digest',
      value: '6 lanes',
      detail: 'Single-screen customer operating state.',
    },
    {
      href: '#customer-activity',
      label: 'Activity timeline',
      value: '8 events',
      detail: 'Latest factual customer activity.',
    },
    {
      href: '#customer-chat-retention-ledger',
      label: 'Chat retention',
      value: '2 room(s)',
      detail: 'Customer and Partner chat evidence retained for admin review.',
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
