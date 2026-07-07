import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RefundCommandBoardSection,
  type RefundCommandItem,
} from './refund-command-board-section';

describe('RefundCommandBoardSection', () => {
  it('renders command cards with refund previews and warning status', () => {
    const section = RefundCommandBoardSection({
      items: buildItems(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Refund command board');
    expect(rendered).toContain('Keep customer refunds, payment ledger state');
    expect(rendered).toContain('2 refund record(s)');
    expect(rendered).toContain('Customer refund requests');
    expect(rendered).toContain('Needs operator');
    expect(rendered).toContain('REQUESTED');
    expect(rendered).toContain('2 case(s)');
    expect(rendered).toContain('refund-1 / Customer One / 200.000 VND');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/refunds?review=requested']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'pill pill-warn',
        'signal signal-warn',
      ]),
    );
  });

  it('renders a clear status when all command lanes are clear', () => {
    const section = RefundCommandBoardSection({
      items: [
        {
          detail: 'No open refund cases.',
          href: '/refunds',
          operatorAction: 'Keep monitoring.',
          refunds: [],
          status: 'Clear',
          title: 'Quiet refunds',
          tone: 'ok',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 refund record(s)');
    expect(rendered).toContain('Quiet refunds');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success', 'signal signal-ok']));
  });

  it('uses shared badge atoms for command board status labels', () => {
    const source = readFileSync(join(process.cwd(), 'app/refunds/refund-command-board-section.tsx'), 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('<Link className="ops-task-card"');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<div className="ops-task-grid"');
    expect(source).not.toContain('<span className="pill">{item.status}</span>');
    expect(source).not.toContain('<span className="pill">{item.refunds.length} case(s)</span>');
  });

  it('uses the shared money atom for command preview amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/refunds/refund-command-board-section.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('readonly amountLabel: string;');
    expect(source).not.toContain('{refund.amountLabel}');
  });
});

function buildItems(): RefundCommandItem[] {
  return [
    {
      detail: 'Guests are waiting for a clear refund decision and customer-facing update.',
      href: '/refunds?review=requested',
      operatorAction: 'Confirm eligibility, payment method, and customer message.',
      refunds: [
        { amount: 200000, currency: 'VND', customerLabel: 'Customer One', id: 'refund-1' },
        { amount: 150000, currency: 'VND', customerLabel: 'Customer Two', id: 'refund-2' },
      ],
      status: 'REQUESTED',
      title: 'Customer refund requests',
      tone: 'warn',
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
