import { readFileSync } from 'node:fs';
import { PartnerDetailServicePricingSection } from './partner-detail-service-pricing-section';

describe('PartnerDetailServicePricingSection', () => {
  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-service-pricing-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<strong>No service pricing found</strong>');
  });

  it('uses shared Vuexy status badges for service duration, payout, and visibility chips', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-service-pricing-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('<StatusBadge');
    expect(source).toContain("import type { ReactNode } from 'react';");
    expect(source).toContain('readonly priceLine: ReactNode;');
    expect(pageSource).toContain('Customer <MoneyText amount={row.customerPrice} />');
    expect(pageSource).toContain('<MoneyText amount={row.basePrice} />');
    expect(pageSource).toContain('partner payout <MoneyText amount={row.providerPayoutAmount} />');
    expect(source).not.toContain('<span className="pill pill-info">{row.durationLabel}</span>');
    expect(source).not.toContain('<span className="pill pill-info">{row.payoutRuleLabel}</span>');
    expect(source).not.toContain("<span className={`pill ${row.bookable ? 'pill-success' : 'pill-warn'}`}>");
  });

  it('renders service price readiness in a Vuexy table', () => {
    const section = PartnerDetailServicePricingSection({
      readyCount: 1,
      rows: [
        {
          bookable: true,
          durationLabel: '60 min',
          id: 'service-1',
          issue: 'Ready for customer booking.',
          name: 'Relaxing massage',
          payoutRuleLabel: '1 payout rule(s)',
          priceLine: 'Customer 400,000 VND / admin minimum 300,000 VND / partner payout 280,000 VND',
        },
        {
          bookable: false,
          durationLabel: '90 min',
          id: 'service-2',
          issue: 'Missing payout rule.',
          name: 'Deep tissue massage',
          payoutRuleLabel: '0 payout rule(s)',
          priceLine: 'Customer 600,000 VND / admin minimum 500,000 VND',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Service price readiness');
    expect(rendered).toContain('1/2 bookable');
    expect(rendered).toContain('Customer visibility');
    expect(rendered).toContain('1 customer-visible option(s)');
    expect(rendered).toContain('1 hidden option(s).');
    expect(rendered).toContain('Approval gate');
    expect(rendered).toContain('Approval clear');
    expect(rendered).toContain('Next fix');
    expect(rendered).toContain('Deep tissue massage: Missing payout rule.');
    expect(rendered).toContain('Use the row issue before approving this Partner.');
    expect(rendered).toContain('Relaxing massage');
    expect(rendered).toContain('CUSTOMER VISIBLE');
    expect(rendered).toContain('Deep tissue massage');
    expect(rendered).toContain('HIDDEN');
    expect(rendered).toContain('Missing payout rule.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-success',
        'pill pill-warn',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 2 of 2 entries');
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

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
