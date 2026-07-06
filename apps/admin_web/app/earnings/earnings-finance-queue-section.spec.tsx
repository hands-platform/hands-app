import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EarningsFinanceQueueSection } from './earnings-finance-queue-section';

describe('EarningsFinanceQueueSection', () => {
  it('renders finance queue signals and payout link', () => {
    const section = EarningsFinanceQueueSection({
      signals: [
        {
          action: 'Create Partner payout batch after review.',
          className: 'ops-task-pending',
          detail: 'Two Partners have ready earnings.',
          pillClass: 'pill-info',
          status: '2 ready',
          title: 'Payout ready',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Finance queue');
    expect(rendered).toContain('Payout ready');
    expect(rendered).toContain('Create Partner payout batch after review.');
    expect(hrefsIn(section)).toContain('/payouts');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
      ]),
    );
  });

  it('renders stable heading when no signals are provided', () => {
    const section = EarningsFinanceQueueSection({ signals: [] });

    expect(textContent(section)).toContain('Finance queue');
  });

  it('does not duplicate the base pill class for finance queue badges', () => {
    const section = EarningsFinanceQueueSection({
      signals: [
        {
          action: 'Approve after review.',
          className: 'ops-task-pending',
          detail: 'One batch is waiting.',
          pillClass: 'pill pill-info',
          status: 'Waiting',
          title: 'Approval',
        },
      ],
    });

    expect(classNamesIn(section)).toContain('pill pill-info');
    expect(classNamesIn(section)).not.toContain('pill pill pill-info');
  });

  it('keeps finance queue task cards on the shared Vuexy task surface', () => {
    const source = readFileSync(join(process.cwd(), 'app/earnings/earnings-finance-queue-section.tsx'), 'utf8');

    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('<div className="ops-task-grid"');
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
