import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
      rangeLabel: 'Last 30 days',
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Payout money flow');
    expect(rendered).toContain('Last 30 days');
    expect(rendered).toContain('1.200.000 VND');
    expect(rendered).toContain('Transfer reference');
    expect(rendered).toContain('Attach transfer reference before marking paid.');
    expect(hrefsIn(section)).toContain('/bookings');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
      ]),
    );
  });

  it('renders an empty state when there are no money flow checks', () => {
    const section = PayoutMoneyFlowSection({
      cards: [
        {
          amount: 120000,
          detail: 'Gross represented in visible payout batches.',
          label: 'Gross represented',
        },
      ],
      checks: [],
      currency: 'VND',
    });

    expect(textContent(section)).toContain('No payout money flow check is visible for this range.');
    expect(textContent(section)).toContain('Selected range');
    expect(textContent(section)).not.toContain('Current view');
    expect(classNamesIn(section)).toContain('empty-state');
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

  it('keeps payout money flow task cards on the shared Vuexy task surface', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-money-flow-section.tsx'), 'utf8');

    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('AdminTraceSummary');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('<div className="service-trace-summary">');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<div className="participant-list admin-mb-12">');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('<div className="ops-task-grid');
  });

  it('uses shared money atoms for payout money flow card amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-money-flow-section.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('<strong>{formatMoney(card.amount, currency)}</strong>');
  });

  it('allows money flow check details to render shared money atoms', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-money-flow-section.tsx'), 'utf8');

    expect(source).toContain('ReactNode');
    expect(source).toContain('readonly detail: ReactNode');
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
