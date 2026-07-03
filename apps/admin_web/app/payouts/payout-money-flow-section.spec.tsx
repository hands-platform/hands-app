import { PayoutMoneyFlowSection } from './payout-money-flow-section';

describe('PayoutMoneyFlowSection', () => {
  it('renders money flow cards, checks, and booking trace link', () => {
    const section = PayoutMoneyFlowSection({
      cards: [
        {
          amount: 1200000,
          detail: 'Gross represented in visible payout batches.',
          label: 'Gross represented',
        },
      ],
      checks: [
        {
          action: 'Attach transfer reference before marking paid.',
          className: 'ops-task-pending',
          detail: 'One batch is missing a bank transfer reference.',
          pillClass: 'pill-warn',
          status: '1 CHECK',
          title: 'Transfer reference',
        },
      ],
      currency: 'VND',
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Payout money flow');
    expect(rendered).toContain('1.200.000 VND');
    expect(rendered).toContain('Transfer reference');
    expect(rendered).toContain('Attach transfer reference before marking paid.');
    expect(hrefsIn(section)).toContain('/bookings');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
      ]),
    );
  });

  it('renders an empty state when there are no money flow checks', () => {
    const section = PayoutMoneyFlowSection({
      cards: [],
      checks: [],
      currency: 'VND',
    });

    expect(textContent(section)).toContain('No payout money flow check is visible for this range.');
  });

  it('does not duplicate the base pill class for money flow check badges', () => {
    const section = PayoutMoneyFlowSection({
      cards: [],
      checks: [
        {
          action: 'Attach reference.',
          className: 'ops-task-pending',
          detail: 'Reference is missing.',
          pillClass: 'pill pill-warn',
          status: 'Review',
          title: 'Transfer reference',
        },
      ],
      currency: 'VND',
    });

    expect(classNamesIn(section)).toContain('pill pill-warn');
    expect(classNamesIn(section)).not.toContain('pill pill pill-warn');
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
