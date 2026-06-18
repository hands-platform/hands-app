import {
  BookingDispatchCandidateDecisionMatrixSection,
  BookingMarketplaceSupplySection,
} from './booking-policy-supply-sections';
import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';

type MarketplaceSupply = Parameters<typeof BookingMarketplaceSupplySection>[0]['marketplaceSupply'];

describe('booking policy supply sections', () => {
  it('renders marketplace Partner candidates with shared avatar person cells', () => {
    const marketplaceSupply = buildMarketplaceSupply();

    const candidateSection = BookingDispatchCandidateDecisionMatrixSection({ marketplaceSupply });
    const supplySection = BookingMarketplaceSupplySection({ marketplaceSupply });

    expect(normalizedText(candidateSection)).toContain('Partner Ready');
    expect(normalizedText(supplySection)).toContain('Partner Busy');
    expect(hrefsIn(candidateSection)).toEqual(expect.arrayContaining(['/partners/partner-ready']));
    expect(hrefsIn(supplySection)).toEqual(
      expect.arrayContaining(['/partners/partner-ready', '/partners/partner-busy']),
    );
    expect(classNamesIn(candidateSection)).toEqual(
      expect.arrayContaining(['vuexy-booking-person', 'admin-avatar-status-dot is-online']),
    );
    expect(classNamesIn(supplySection)).toEqual(
      expect.arrayContaining([
        'vuexy-booking-person',
        'admin-avatar-status-dot is-online',
        'admin-avatar-status-dot is-working',
      ]),
    );
  });
});

function buildMarketplaceSupply(): MarketplaceSupply {
  return {
    candidateCommand: {
      action: 'Open supply',
      detail: 'Two Partners can be inspected for this booking pin.',
      href: '/partners?review=marketplace-ready',
      status: 'Supply ready',
      title: 'Usable supply',
      tone: 'pill-success',
    },
    decisionDetail: 'Eligible Partners are available.',
    decisionStatus: 'Ready',
    decisionTitle: 'Marketplace can proceed',
    decisionTone: 'pill-success',
    eligibleCount: 1,
    excludedGroups: [
      {
        count: 0,
        detail: 'No location freshness blocker.',
        href: '/partners?review=location',
        label: 'Location freshness',
        samples: [],
      },
    ],
    metrics: [
      {
        helper: 'Partners inside the booking address radius.',
        label: 'Eligible',
        value: '1',
      },
    ],
    rows: [
      {
        detail: 'Inside service area and radius.',
        distance: '1 km',
        eligible: true,
        id: 'partner-ready',
        locationAge: 'fresh',
        name: 'Partner Ready',
        role: 'Marketplace',
        status: 'ONLINE_AVAILABLE',
      },
      {
        detail: 'Already working on another booking.',
        distance: '3 km',
        eligible: false,
        id: 'partner-busy',
        locationAge: 'fresh',
        name: 'Partner Busy',
        role: 'Marketplace',
        status: 'ONLINE_BUSY',
      },
    ],
    topCandidates: [
      {
        distance: '1 km',
        id: 'partner-ready',
        locationAge: 'fresh',
        name: 'Partner Ready',
      },
    ],
  };
}
