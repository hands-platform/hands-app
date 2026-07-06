import { readFileSync } from 'node:fs';

import type { AdminServiceCatalogItem, AdminServicePayoutRule } from '../../lib/admin-api';
import type { ServicePayoutLedgerRow } from '../../lib/service-payout-ledger-rows';
import { ServicePayoutLedgerSection } from './service-payout-ledger-section';

describe('ServicePayoutLedgerSection', () => {
  it('uses shared Vuexy badge atoms for ledger status labels', () => {
    const source = readFileSync('app/services/service-payout-ledger-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${row.commissionTone}`}>');
    expect(source).not.toContain("<span className={`pill ${row.hiddenProviders ? 'pill-warn' : 'pill-success'}`}>");
    expect(source).not.toContain('<span className={`pill ${row.actionTone}`}>{row.action}</span>');
  });

  it('uses shared money atoms for payout ledger amounts', () => {
    const source = readFileSync('app/services/service-payout-ledger-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
  });

  it('renders active option count, visible rows, and hidden row copy', () => {
    const section = ServicePayoutLedgerSection({
      activeServiceCount: 3,
      hiddenRowCount: 2,
      rows: [ledgerRowFixture({ serviceName: 'Foot Massage' }), ledgerRowFixture({ serviceName: 'Thai Massage' })],
      visibleRows: [ledgerRowFixture({ serviceName: 'Foot Massage' })],
    });

    const rendered = JSON.stringify(section);

    expect(section.type.name).toBe('AdminTableSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'admin-table-section-body',
      className: 'admin-mb-16',
      scrollable: true,
      statusLabel: '3 active option(s)',
      statusTone: 'info',
      title: 'Service payout ledger',
    });
    expect(rendered).toContain('Service payout ledger');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('active option(s)');
    expect(rendered).toContain('Showing first');
  });

  it('renders missing base rule rows without assuming business authority', () => {
    const section = ServicePayoutLedgerSection({
      activeServiceCount: 1,
      hiddenRowCount: 0,
      rows: [ledgerRowFixture({ baseRule: null, serviceName: 'Missing Rule' })],
      visibleRows: [ledgerRowFixture({ baseRule: null, serviceName: 'Missing Rule' })],
    });

    expect(JSON.stringify(section)).toContain('Missing rule');
  });
});

function ledgerRowFixture({
  baseRule = payoutRuleFixture('service-1'),
  serviceName,
}: {
  readonly baseRule?: AdminServicePayoutRule | null;
  readonly serviceName: string;
}): ServicePayoutLedgerRow {
  return {
    action: baseRule ? 'Ready' : 'Add payout rule',
    actionTone: baseRule ? 'pill-success' : 'pill-danger',
    baseRule,
    commissionTone: baseRule ? 'pill-success' : 'pill-danger',
    currency: 'VND',
    finance: {
      actualCompanyCommission: baseRule ? 100000 : 0,
      fee: baseRule ? 120000 : 0,
      taxRuleLabel: null,
      vatAmount: baseRule ? 10000 : 0,
      withholdingAmount: baseRule ? 10000 : 0,
    },
    hiddenProviders: 1,
    service: serviceFixture(serviceName),
    totalProviderRows: 3,
    visibleProviders: 2,
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
    serviceGroupKey: 'massage',
  };
}

function payoutRuleFixture(serviceId: string): AdminServicePayoutRule {
  return {
    active: true,
    currency: 'VND',
    customerPrice: 400000,
    id: `${serviceId}-rule`,
    otherCostAmount: 0,
    providerPayoutAmount: 280000,
    serviceId,
    vatBps: 0,
  };
}
