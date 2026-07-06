import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminServiceCatalogItem, AdminServicePayoutRule } from '../../lib/admin-api';
import type { ServicePricePolicyPreviewRow } from '../../lib/service-price-policy-preview-rows';
import { ServicePricePolicyPreviewSection } from './service-price-policy-preview-section';

describe('ServicePricePolicyPreviewSection', () => {
  it('uses shared Vuexy badge atoms for price policy status labels', () => {
    const source = readFileSync('app/services/service-price-policy-preview-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className="pill pill-danger">Missing base payout</span>');
    expect(source).not.toContain('<span className={`pill ${row.checkTone}`}>{row.checkLabel}</span>');
    expect(source).not.toContain('return <span className="pill pill-danger">No base rule</span>;');
    expect(source).not.toContain('<span className={`pill ${scenario.tone}`}>{scenario.status}</span>');
  });

  it('uses shared money atoms for price policy preview amounts', () => {
    const source = readFileSync('app/services/service-price-policy-preview-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain('<div className="service-trace-summary">');
  });

  it('renders policy summary, visible preview rows, and hidden row copy', () => {
    const section = ServicePricePolicyPreviewSection({
      hiddenRowCount: 2,
      rows: [previewRowFixture({ serviceName: 'Foot Massage' }), previewRowFixture({ serviceName: 'Thai Massage' })],
      summary: {
        balancedStepCommission: 600000,
        currency: 'VND',
        currentCommission: 300000,
        customerStepCommission: 500000,
        missingBaseRuleCount: 0,
        policyCheckCount: 1,
        providerStepCommission: 200000,
      },
      visibleRows: [previewRowFixture({ serviceName: 'Foot Massage' })],
    });

    const rendered = JSON.stringify(section);

    expect(section.type.name).toBe('AdminTableSection');
    expect(section.props).toMatchObject({
      className: 'admin-mb-16',
      scrollable: true,
      statusLabel: '1 policy check(s)',
      statusTone: 'warning',
      title: 'Price policy change preview',
    });
    expect(rendered).toContain('Price policy change preview');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('policy check(s)');
    expect(rendered).toContain('pill-warn');
    expect(rendered).toContain('Showing first');
  });

  it('renders an empty state when no active service option is available', () => {
    const section = ServicePricePolicyPreviewSection({
      hiddenRowCount: 0,
      rows: [],
      summary: {
        balancedStepCommission: 0,
        currency: 'VND',
        currentCommission: 0,
        customerStepCommission: 0,
        missingBaseRuleCount: 0,
        policyCheckCount: 0,
        providerStepCommission: 0,
      },
      visibleRows: [],
    });

    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('No active service option is available for price policy preview.');
    expect(markup).toContain('class="empty-state');
  });
});

function previewRowFixture({ serviceName }: { readonly serviceName: string }): ServicePricePolicyPreviewRow {
  const service = serviceFixture(serviceName);
  const baseRule = payoutRuleFixture(service.id);

  return {
    balancedStepScenario: {
      currency: 'VND',
      customerPrice: 500000,
      finance: financeFixture(150000),
      label: 'Customer and Partner + step',
      providerPayoutAmount: 350000,
      status: 'Positive',
      tone: 'pill-success',
    },
    baseRule,
    checkLabel: 'Positive preview',
    checkTone: 'pill-success',
    currency: 'VND',
    currentFinance: financeFixture(100000),
    customerStepScenario: {
      currency: 'VND',
      customerPrice: 500000,
      finance: financeFixture(200000),
      label: 'Customer price + step',
      providerPayoutAmount: 300000,
      status: 'Positive',
      tone: 'pill-success',
    },
    nextAction: 'These one-step scenarios keep a positive projected company commission.',
    priceStep: 100000,
    providerStepScenario: {
      currency: 'VND',
      customerPrice: 400000,
      finance: financeFixture(0),
      label: 'Partner payout + step',
      providerPayoutAmount: 400000,
      status: 'Check margin',
      tone: 'pill-warn',
    },
    service,
  };
}

function serviceFixture(name: string): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice: 400000,
    displayOrder: 0,
    durationMin: 60,
    id: `${name}-service`,
    name,
    priceStep: 100000,
  };
}

function payoutRuleFixture(serviceId: string): AdminServicePayoutRule {
  return {
    active: true,
    currency: 'VND',
    customerPrice: 400000,
    id: `${serviceId}-rule`,
    otherCostAmount: 0,
    providerPayoutAmount: 300000,
    serviceId,
    vatBps: 0,
  };
}

function financeFixture(actualCompanyCommission: number) {
  return {
    actualCompanyCommission,
    fee: actualCompanyCommission,
    taxRuleLabel: null,
    vatAmount: 0,
    withholdingAmount: 0,
  };
}
