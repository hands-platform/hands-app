import { PartnerDetailServicePricingSection } from './partner-detail-service-pricing-section';

describe('PartnerDetailServicePricingSection', () => {
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
    expect(rendered).toContain('Relaxing massage');
    expect(rendered).toContain('CUSTOMER VISIBLE');
    expect(rendered).toContain('Deep tissue massage');
    expect(rendered).toContain('HIDDEN');
    expect(rendered).toContain('Missing payout rule.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-partner-detail-review-card',
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
