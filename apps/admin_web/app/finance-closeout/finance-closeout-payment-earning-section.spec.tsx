import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { FinanceCloseoutPaymentEarningSection } from './finance-closeout-payment-earning-section';

describe('FinanceCloseoutPaymentEarningSection', () => {
  it('uses shared money atoms for payment-to-earning amounts', () => {
    const source = readFileSync(
      new URL('./finance-closeout-payment-earning-section.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('MoneyText');
    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain('bodyClassName="service-trace-summary"');
  });

  it('uses the shared Vuexy text link atom for the earnings action', () => {
    const source = readFileSync(
      new URL('./finance-closeout-payment-earning-section.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders earning summary totals and the earnings link', () => {
    const section = FinanceCloseoutPaymentEarningSection({
      currency: 'VND',
      summary: {
        availableNetAmount: 200000,
        count: 3,
        currency: 'VND',
        grossAmount: 900000,
        netAmount: 650000,
        paidNetAmount: 100000,
        pendingNetAmount: 550000,
        platformFee: 180000,
        withholdingAmount: 70000,
      },
    });

    const rendered = textContent(section);
    const markup = renderToStaticMarkup(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      className: 'admin-mb-16',
      title: 'Payment-to-earning checks',
    });
    expect(section.props).not.toHaveProperty('bodyClassName', 'service-trace-summary');
    expect(rendered).toContain('Payment-to-earning checks');
    expect(markup).toContain('900.000 VND');
    expect(markup).toContain('3');
    expect(markup).toContain('earning record(s)');
    expect(markup).toContain('Pending Partner net');
    expect(hrefsIn(section)).toContain('/earnings');
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
