import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PayoutServiceEvidenceSection } from './payout-service-evidence-section';

describe('PayoutServiceEvidenceSection', () => {
  it('uses the shared Vuexy trace summary atom for service evidence totals', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-service-evidence-section.tsx'), 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary">');
  });

  it('renders service evidence totals and rows', () => {
    const section = PayoutServiceEvidenceSection({
      batchCount: 2,
      currency: 'VND',
      items: [
        {
          batchCount: 2,
          cashDebtAmount: 0,
          currency: 'VND',
          earningCount: 3,
          grossAmount: 1500000,
          groupKey: 'foot',
          key: 'service-1',
          label: 'Foot Massage / 90 min',
          netAmount: 1000000,
          platformFee: 350000,
          withholdingAmount: 150000,
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Payout service evidence');
    expect(rendered).toContain('Foot Massage / 90 min');
    expect(rendered).toContain('1.500.000 VND');
    expect(rendered).toContain('1.000.000 VND');
    expect(hrefsIn(section)).toContain('/services');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'table vuexy-data-table vuexy-booking-table admin-data-table',
      ]),
    );
  });

  it('renders an empty state when no service evidence is available', () => {
    const section = PayoutServiceEvidenceSection({
      batchCount: 0,
      currency: 'VND',
      items: [],
    });

    expect(textContent(section)).toContain('No payout batch has linked service evidence yet.');
  });

  it('uses the shared badge atom for cash debt evidence', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-service-evidence-section.tsx'), 'utf8');

    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<div className="participant-list admin-mb-12">');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain(
      "<span className={`pill ${item.cashDebtAmount ? 'pill-danger' : 'pill-success'}`}>",
    );
  });

  it('uses shared money atoms for payout service evidence amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-service-evidence-section.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain("<strong>{formatMoney(sumEvidence(items, 'grossAmount'), currency)}</strong>");
    expect(source).not.toContain("<strong>{formatMoney(sumEvidence(items, 'netAmount'), currency)}</strong>");
    expect(source).not.toContain("<strong>{formatMoney(sumEvidence(items, 'platformFee'), currency)}</strong>");
    expect(source).not.toContain("<strong>{formatMoney(sumEvidence(items, 'withholdingAmount'), currency)}</strong>");
    expect(source).not.toContain('<td>{formatMoney(item.grossAmount, item.currency)}</td>');
    expect(source).not.toContain('<td>{formatMoney(item.netAmount, item.currency)}</td>');
    expect(source).not.toContain('<td>{formatMoney(item.platformFee, item.currency)}</td>');
    expect(source).not.toContain('<td>{formatMoney(item.withholdingAmount, item.currency)}</td>');
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
