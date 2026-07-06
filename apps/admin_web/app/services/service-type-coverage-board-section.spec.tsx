import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ServiceTypeCoverageRow } from '../../lib/service-type-coverage-rows';
import { ServiceTypeCoverageBoardSection } from './service-type-coverage-board-section';

describe('ServiceTypeCoverageBoardSection', () => {
  it('uses shared Vuexy badge atoms for service type coverage labels', () => {
    const source = readFileSync('app/services/service-type-coverage-board-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain("<span className={summary.blockedCount ? 'pill pill-danger' : 'pill pill-success'}>");
    expect(source).not.toContain("<span className={summary.warningCount ? 'pill pill-warn' : 'pill pill-success'}>");
    expect(source).not.toContain('<span className="pill pill-info">{summary.readyCount} ready</span>');
    expect(source).not.toContain("<span className={`pill ${row.missingDurations.length ? 'pill-warn' : 'pill-success'}`}>");
    expect(source).not.toContain("<span className={`pill ${row.missingBasePayoutCount ? 'pill-danger' : 'pill-success'}`}>");
    expect(source).not.toContain("<span className={`pill ${row.hiddenPartnerPriceCount ? 'pill-warn' : 'pill-success'}`}>");
    expect(source).not.toContain('<span className={`pill ${row.tone}`}>{row.statusLabel}</span>');
  });

  it('uses shared money atoms for service type coverage amounts', () => {
    const source = readFileSync('app/services/service-type-coverage-board-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('renders coverage summary, visible rows, and hidden row copy', () => {
    const section = ServiceTypeCoverageBoardSection({
      hiddenRowCount: 3,
      rows: [
        coverageRowFixture({ key: 'foot', label: 'Foot Massage', tone: 'pill-danger' }),
        coverageRowFixture({ key: 'thai', label: 'Thai Massage', tone: 'pill-success' }),
      ],
      summary: {
        blockedCount: 1,
        currency: 'VND',
        hiddenPartnerPriceCount: 2,
        missingBasePayoutCount: 1,
        missingDurationCount: 2,
        netCompanyFee: 250000,
        readyCount: 1,
        warningCount: 0,
      },
      visibleRows: [coverageRowFixture({ key: 'foot', label: 'Foot Massage', tone: 'pill-danger' })],
    });

    const rendered = JSON.stringify(section);
    const markup = renderToStaticMarkup(section);

    expect(section.type.name).toBe('AdminTableSection');
    expect(section.props).toMatchObject({
      className: 'admin-mb-16',
      scrollable: true,
      title: 'Service type coverage board',
    });
    expect(rendered).toContain('Service type coverage board');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('blocked');
    expect(markup).toContain('250.000 VND');
    expect(rendered).toContain('Showing first');
  });

  it('renders an empty state when no service type matches the search', () => {
    const section = ServiceTypeCoverageBoardSection({
      hiddenRowCount: 0,
      rows: [],
      summary: {
        blockedCount: 0,
        currency: 'VND',
        hiddenPartnerPriceCount: 0,
        missingBasePayoutCount: 0,
        missingDurationCount: 0,
        netCompanyFee: 0,
        readyCount: 0,
        warningCount: 0,
      },
      visibleRows: [],
    });

    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('No service type matches the current catalog search.');
    expect(markup).toContain('class="empty-state');
  });
});

function coverageRowFixture({
  key,
  label,
  tone,
}: {
  readonly key: string;
  readonly label: string;
  readonly tone: ServiceTypeCoverageRow['tone'];
}): ServiceTypeCoverageRow {
  return {
    activeDurationLabels: '60, 90 min',
    activeOptionCount: 2,
    belowMinimumCount: 1,
    currency: 'VND',
    customerMinimumTotal: 900000,
    hiddenPartnerPriceCount: 2,
    inactivePartnerPriceCount: 0,
    key,
    label,
    lowCommissionCount: 0,
    missingBasePayoutCount: tone === 'pill-danger' ? 1 : 0,
    missingDurations: tone === 'pill-danger' ? [120] : [],
    missingPayoutPriceCount: 1,
    netCompanyFee: 250000,
    nextAction: 'Add payout coverage before opening this service type.',
    partnerPayoutTotal: 650000,
    payoutRuleCount: 1,
    statusLabel: tone === 'pill-danger' ? 'Blocked' : 'Ready',
    tone,
    visiblePartnerPriceCount: 4,
  };
}
