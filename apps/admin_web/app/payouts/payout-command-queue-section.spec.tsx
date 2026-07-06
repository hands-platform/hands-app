import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PayoutCommandQueueSection } from './payout-command-queue-section';

describe('PayoutCommandQueueSection', () => {
  it('renders command signals with finance queue copy and earnings link', () => {
    const section = PayoutCommandQueueSection({
      signals: [
        {
          action: 'Review failed bank transfer evidence.',
          className: 'ops-task-pending',
          detail: 'Failed payout batches need transfer failure evidence before retry.',
          pillClass: 'pill-warn',
          status: '1 FAILED',
          title: 'Failed transfer review',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Payout command queue');
    expect(rendered).toContain('Failed transfer review');
    expect(rendered).toContain('1 FAILED');
    expect(rendered).toContain('Review failed bank transfer evidence.');
    expect(hrefsIn(section)).toContain('/earnings');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
      ]),
    );
  });

  it('renders an empty state when there are no payout command signals', () => {
    const section = PayoutCommandQueueSection({ signals: [] });

    expect(textContent(section)).toContain('No payout command signal is visible for this range.');
    expect(classNamesIn(section)).toContain('empty-state');
  });

  it('does not duplicate the base pill class for command signal badges', () => {
    const section = PayoutCommandQueueSection({
      signals: [
        {
          action: 'Review transfer evidence.',
          className: 'ops-task-pending',
          detail: 'Transfer needs finance review.',
          pillClass: 'pill pill-warn',
          status: 'Review',
          title: 'Transfer review',
        },
      ],
    });

    expect(classNamesIn(section)).toContain('pill pill-warn');
    expect(classNamesIn(section)).not.toContain('pill pill pill-warn');
  });

  it('keeps payout command task cards on the shared Vuexy task surface', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-command-queue-section.tsx'), 'utf8');

    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`ops-task-card');
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
