import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CashSettlementPriorityBoardSection,
  type CashSettlementPriorityBoardRow,
} from './cash-settlement-priority-board-section';

describe('CashSettlementPriorityBoardSection', () => {
  it('uses the shared finance table shell instead of wiring table classes directly', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-priority-board-section.tsx'),
      'utf8',
    );

    expect(source).toContain('FinanceDataTable');
    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('<a className="text-link"');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('AdminDataTable');
    expect(source).not.toContain('className="vuexy-booking-table"');
  });

  it('uses the shared empty state atom for empty priority rows', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-priority-board-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<p className="muted admin-mt-12">');
  });

  it('uses the shared money atom for visible cash priority amounts', () => {
    const sectionSource = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-priority-board-section.tsx'),
      'utf8',
    );
    const modelSource = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-page-priority.ts'),
      'utf8',
    );

    expect(sectionSource).toContain('MoneyText');
    expect(sectionSource).not.toContain('debtAmountLabel: string');
    expect(modelSource).not.toContain('formatMoney(');
  });

  it('renders priority rows with booking links and evidence requirements', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-priority-board-section.tsx'),
      'utf8',
    );
    const section = CashSettlementPriorityBoardSection({
      rows: [buildRow()],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('High debt');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('500.000 VND');
    expect(rendered).toContain('Confirm bank deposit reference');
    expect(hrefsIn(section)).toContain('/bookings/booking-1');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll admin-mt-12',
        'table vuexy-data-table vuexy-booking-table',
        'pill pill-danger',
      ]),
    );
  });

  it('renders empty state when there are no priority rows', () => {
    const section = CashSettlementPriorityBoardSection({ rows: [] });

    expect(textContent(section)).toContain('No settlement priority rows are waiting for finance action.');
    expect(classNamesIn(section)).toContain('empty-state admin-mt-12');
  });
});

function buildRow(): CashSettlementPriorityBoardRow {
  return {
    ageLabel: '26h open',
    bookingHref: '/bookings/booking-1',
    bookingLabel: 'bookin',
    currency: 'VND',
    debtAmount: 500_000,
    pillClass: 'pill-danger',
    priority: 'High debt',
    providerName: 'Partner One',
    providerPhone: '+84900000000',
    reason: 'Cash fee debt is high.',
    requiredEvidence: ['Confirm bank deposit reference', 'Check booking payment method'],
    unlockResult: ['Final acceptance can reopen', 'Payout release can continue'],
  };
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
