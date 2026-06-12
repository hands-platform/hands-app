import {
  NotificationDeliveryOpsQueueSection,
  type NotificationDeliveryOpsQueueItem,
} from './notification-delivery-ops-queue-section';

describe('NotificationDeliveryOpsQueueSection', () => {
  it('renders delivery issue cards when blockers exist', () => {
    const section = NotificationDeliveryOpsQueueSection({
      items: buildItems(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Delivery operations queue');
    expect(rendered).toContain('1 issue(s)');
    expect(rendered).toContain('Failed sends');
    expect(rendered).toContain('Push provider returned an error');
    expect(rendered).toContain('Open queue');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/notifications?review=failed']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['ops-task-card', 'pill pill-warn']));
  });

  it('renders a clean state when no delivery blockers exist', () => {
    const section = NotificationDeliveryOpsQueueSection({ items: [] });

    const rendered = textContent(section);

    expect(rendered).toContain('No delivery blockers');
    expect(rendered).toContain('Delivery path is clean');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['ops-task-card', 'pill pill-success']));
  });
});

function buildItems(): NotificationDeliveryOpsQueueItem[] {
  return [
    {
      count: 2,
      detail: 'Push provider returned an error. Check failure reason, token freshness, and credentials.',
      href: '/notifications?review=failed',
      key: 'failed',
      label: 'Failed sends',
      tone: 'pill-warn',
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
