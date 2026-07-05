import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { FinanceCloseoutCashDebtHandoffSection } from './finance-closeout-cash-debt-handoff-section';

describe('FinanceCloseoutCashDebtHandoffSection', () => {
  it('uses shared money atoms for cash debt handoff amounts', () => {
    const source = readFileSync(
      new URL('./finance-closeout-cash-debt-handoff-section.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
  });

  it('uses the shared Vuexy text link atom for the cash settlement action', () => {
    const source = readFileSync(
      new URL('./finance-closeout-cash-debt-handoff-section.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders wallet gate counts, debt amount, oldest open age, and settlement link', () => {
    const section = FinanceCloseoutCashDebtHandoffSection({
      cashDebtAmount: 450000,
      currency: 'VND',
      oldestOpenAt: '2026-06-09T10:00:00.000Z',
      providerCount: 2,
      rowCount: 5,
    });

    const rendered = textContent(section);
    const markup = renderToStaticMarkup(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'detail-grid admin-mt-16',
      className: 'admin-mb-16',
      title: 'Cash debt handoff',
    });
    expect(rendered).toContain('Cash debt handoff');
    expect(rendered).toContain('Wallet-gated Partners');
    expect(rendered).toContain('2');
    expect(rendered).toContain('5');
    expect(markup).toContain('450.000 VND');
    expect(hrefsIn(section)).toContain('/cash-settlements');
  });

  it('renders a dash when there is no oldest open cash row', () => {
    const section = FinanceCloseoutCashDebtHandoffSection({
      cashDebtAmount: 0,
      currency: 'VND',
      oldestOpenAt: null,
      providerCount: 0,
      rowCount: 0,
    });

    expect(textContent(section)).toContain('-');
  });
});

function textContent(value: unknown): string {
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
  return textContent([props?.title, props?.description, props?.statusLabel, props?.actions, props?.children]);
}

function hrefsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn([props?.actions, props?.children])];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
