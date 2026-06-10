import {
  NotificationFilterBoardSection,
  type NotificationFilterLink,
} from './notification-filter-board-section';

describe('NotificationFilterBoardSection', () => {
  it('renders active queue, booking trace, and quick filter links', () => {
    const section = NotificationFilterBoardSection({
      activeBookingLabel: 'book-1234',
      activeFilterDescription: 'delivery attempts that returned a push provider failure.',
      activeFilterLabel: 'Failed sends',
      activeReview: 'failed',
      filteredCount: 2,
      links: buildLinks(),
      totalCount: 10,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Notification operation filters');
    expect(rendered).toContain('Active queue: Failed sends');
    expect(rendered).toContain('delivery attempts that returned a push provider failure.');
    expect(rendered).toContain('Active booking trace: book-1234');
    expect(rendered).toContain('Showing 2 of 10');
    expect(rendered).toContain('Clear filter');
    expect(rendered).toContain('Booking book-1234');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/notifications', '/notifications?review=failed']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-warn']));
  });

  it('renders an unfiltered state without clear filter affordance', () => {
    const section = NotificationFilterBoardSection({
      activeBookingLabel: null,
      activeFilterDescription: null,
      activeFilterLabel: null,
      activeReview: '',
      filteredCount: 10,
      links: buildLinks(),
      totalCount: 10,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Showing 10 of 10');
    expect(rendered).not.toContain('Clear filter');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success']));
  });
});

function buildLinks(): NotificationFilterLink[] {
  return [
    { href: '/notifications', label: 'All notifications', review: '' },
    { href: '/notifications?review=failed', label: 'Failed sends', review: 'failed' },
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
