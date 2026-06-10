import { NotificationChannelPolicySection } from './notification-channel-policy-section';

describe('NotificationChannelPolicySection', () => {
  it('renders partner alert routing policy and channel counts', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 7,
      oneSignalDeliveries: 2,
      partnerAlertCount: 5,
      policyLabel: 'In-app first',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner alert routing policy');
    expect(rendered).toContain('Current decision: In-app first');
    expect(rendered).toContain('Partner booking alerts');
    expect(rendered).toContain('5');
    expect(rendered).toContain('In-app route');
    expect(rendered).toContain('7');
    expect(rendered).toContain('OneSignal route');
    expect(rendered).toContain('2');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/operations-policy']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-warn']));
  });

  it('uses a neutral OneSignal badge when no OS push deliveries exist', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 3,
      oneSignalDeliveries: 0,
      partnerAlertCount: 3,
      policyLabel: 'In-app only',
    });

    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-neutral']));
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
