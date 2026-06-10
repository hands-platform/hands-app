import type { ServiceTypeCoverageRow } from '../../lib/service-type-coverage-rows';
import { ServiceTypeCoverageBoardSection } from './service-type-coverage-board-section';

describe('ServiceTypeCoverageBoardSection', () => {
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

    expect(section.type).toBe('section');
    expect(rendered).toContain('Service type coverage board');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('blocked');
    expect(rendered).toContain('250.000 VND');
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

    expect(JSON.stringify(section)).toContain('No service type matches the current catalog search.');
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
