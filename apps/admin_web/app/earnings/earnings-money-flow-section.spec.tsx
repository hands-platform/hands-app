import { EarningsMoneyFlowSection } from './earnings-money-flow-section';

describe('EarningsMoneyFlowSection', () => {
  it('renders money flow cards and finance checks', () => {
    const section = EarningsMoneyFlowSection({
      cards: [
        {
          amount: 1500000,
          detail: 'Customer charge represented by earning rows.',
          label: 'Gross',
        },
      ],
      checks: [
        {
          action: 'Review cash fee settlement before payout.',
          className: 'ops-task-blocked',
          detail: 'Cash bookings are creating Partner wallet debt.',
          pillClass: 'pill-danger',
          status: '1 blocked',
          title: 'Cash debt',
        },
      ],
      currency: 'VND',
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Money flow command center');
    expect(rendered).toContain('1.500.000 VND');
    expect(rendered).toContain('Cash debt');
    expect(rendered).toContain('Review cash fee settlement before payout.');
    expect(hrefsIn(section)).toContain('/bookings');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
      ]),
    );
  });

  it('renders without checks when no finance checks are provided', () => {
    const section = EarningsMoneyFlowSection({
      cards: [],
      checks: [],
      currency: 'VND',
    });

    expect(textContent(section)).toContain('Money flow command center');
  });

  it('does not duplicate the base pill class for finance check badges', () => {
    const section = EarningsMoneyFlowSection({
      cards: [],
      checks: [
        {
          action: 'Review exception.',
          className: 'ops-task-blocked',
          detail: 'Manual review required.',
          pillClass: 'pill pill-danger',
          status: 'Blocked',
          title: 'Exception',
        },
      ],
      currency: 'VND',
    });

    expect(classNamesIn(section)).toContain('pill pill-danger');
    expect(classNamesIn(section)).not.toContain('pill pill pill-danger');
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
