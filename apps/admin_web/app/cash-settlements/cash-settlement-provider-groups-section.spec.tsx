import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CashSettlementProviderGroupsSection } from './cash-settlement-provider-groups-section';

describe('CashSettlementProviderGroupsSection', () => {
  it('uses the shared empty state atom when no Partner debt groups exist', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-provider-groups-section.tsx'),
      'utf8',
    );
    const section = CashSettlementProviderGroupsSection({ providers: [] });

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminSectionHeader');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('<p className="muted">No Partner has open cash settlement debt.</p>');
    expect(source).not.toContain('<div className="ops-section-header">');
    expect(textContent(section)).toContain('No Partner has open cash settlement debt.');
    expect(classNamesIn(section)).toContain('empty-state');
  });

  it('uses shared badge atoms for Partner debt group status chips', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-provider-groups-section.tsx'),
      'utf8',
    );
    const section = CashSettlementProviderGroupsSection({
      providers: [
        {
          companyCouponOffset: 0,
          currency: 'VND',
          debtAmount: 170000,
          oldestOpenLabel: '3 days open',
          oldestOpenMs: 259200000,
          platformFee: 150000,
          providerName: 'Partner One',
          providerProfileId: 'partner-1',
          rowCount: 2,
          settlementReference: 'CS-001',
          taxAmount: 20000,
        },
      ],
    });

    expect(source).toContain('StatusBadge');
    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('pillClass');
    expect(source).toContain('ActionMenu');
    expect(source).not.toContain('<span className="pill pill-danger">');
    expect(source).not.toContain('<span className="pill pill-warn">');
    expect(source).not.toContain('<span className="pill pill-info">');
    expect(source).not.toContain('<Link className="pill" href');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['pill pill-danger', 'pill pill-warn', 'pill pill-info']),
    );
  });

  it('uses shared money atoms for Partner debt group amounts', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-provider-groups-section.tsx'),
      'utf8',
    );

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
  });

  it('uses the shared Vuexy detail grid for Partner debt group cards', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-provider-groups-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminDetailGrid');
    expect(source).not.toContain('<div className="detail-grid admin-mt-16">');
  });

  it('keeps partner debt groups on the grouped Vuexy table-card shell', () => {
    const section = CashSettlementProviderGroupsSection({
      providers: [
        {
          companyCouponOffset: 0,
          currency: 'VND',
          debtAmount: 170000,
          oldestOpenLabel: '3 days open',
          oldestOpenMs: 259200000,
          platformFee: 150000,
          providerName: 'Partner One',
          providerProfileId: 'partner-1',
          rowCount: 2,
          settlementReference: 'CS-001',
          taxAmount: 20000,
        },
      ],
    });

    expect(classNamesIn(section)).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
    );
  });
});

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
