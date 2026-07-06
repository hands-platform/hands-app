import { readFileSync } from 'node:fs';

import {
  BookingAddressRadiusContractSection,
  BookingAppliedPolicySection,
  BookingCustomerWaitPanelSection,
  BookingDispatchCandidateDecisionMatrixSection,
  BookingMarketplaceSupplySection,
  BookingStageSnapshotSection,
} from './booking-policy-supply-sections';
import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';

type MarketplaceSupply = Parameters<typeof BookingMarketplaceSupplySection>[0]['marketplaceSupply'];

describe('booking policy supply sections', () => {
  it('uses shared Vuexy admin card surfaces for supply panels', () => {
    const source = readFileSync('app/bookings/[id]/booking-policy-supply-sections.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).toContain('AdminTaskGrid');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(source).toContain('AdminNoteCard');
    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<div className={`ops-task-note');
    expect(source).not.toContain('<div className="ops-task-grid admin-mt-14">');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-14">');
    expect(source).not.toContain('<AdminCard className="ops-task-note booking-supply-panel">');
    expect(source).not.toContain('className="card admin-card ops-task-note booking-supply-panel"');
    expect(source).not.toContain('<strong>No usable marketplace participant</strong>');
  });

  it('uses shared Vuexy task cards for policy decision and supply cards', () => {
    const source = readFileSync('app/bookings/[id]/booking-policy-supply-sections.tsx', 'utf8');

    expect(source).toContain('AdminTaskCard');
    expect(source).not.toContain('className={`ops-task-card ${decision.className}`');
    expect(source).not.toContain('className={`ops-task-card ${card.className}`');
  });

  it('uses the shared Vuexy stage item atom for policy supply row surfaces', () => {
    const source = readFileSync('app/bookings/[id]/booking-policy-supply-sections.tsx', 'utf8');

    expect(source).toContain('AdminStageItem');
    expect(source).not.toContain('className="setup-stage-item"');
  });

  it('uses shared Vuexy badge atoms instead of raw policy supply pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-policy-supply-sections.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('actions={<span className={`pill ${stageSnapshot.pillClass}`}>{stageSnapshot.stage}</span>}');
    expect(source).not.toContain('actions={<span className={`pill ${customerWaitPanel.signalTone}`}>{customerWaitPanel.signalStatus}</span>}');
    expect(source).not.toContain('<span className={`pill ${policySnapshot.decisionTone}`}>{policySnapshot.decisionStatus}</span>');
    expect(source).not.toContain('<span className={`pill ${decision.pillClass}`}>{decision.status}</span>');
    expect(source).not.toContain('actions={<span className={`pill ${addressRadiusContract.tone}`}>{addressRadiusContract.status}</span>}');
    expect(source).not.toContain('<span className={`pill ${marketplaceSupply.candidateCommand.tone}`}>');
    expect(source).not.toContain("<span className={`pill ${marketplaceSupply.eligibleCount ? 'pill-success' : 'pill-warn'}`}>");
    expect(source).not.toContain('<span className={`pill ${marketplaceSupply.decisionTone}`}>{marketplaceSupply.decisionStatus}</span>');
    expect(source).not.toContain("<span className={`pill ${row.eligible ? 'pill-success' : 'pill-warn'}`}>");
    expect(source).not.toContain('<span className={`pill ${badge.tone}`} key={badge.label} title={showDetailTitle ? badge.detail : undefined}>');
    expect(source).not.toContain('<span className={`pill ${card.pillClass}`}>{card.status}</span>');
  });

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
    expect(classNamesIn(candidateSection)).not.toContain('card');
    expect(
      classNamesIn(candidateSection).filter(
        (className) => className === 'card admin-card ops-task-note booking-supply-panel',
      ),
    ).toHaveLength(2);
  });

  it('renders booking policy and supply panels with the shared Vuexy admin section surface', () => {
    const marketplaceSupply = buildMarketplaceSupply();
    const sections = [
      BookingStageSnapshotSection({
        stageSnapshot: {
          actionHref: '#booking-ops',
          actionLabel: 'Open command',
          badges: [{ label: 'Ready', tone: 'pill-success' }],
          detail: 'No blocker is active.',
          headline: 'Continue normal monitoring',
          metrics: [{ helper: 'Booking is active.', label: 'Stage', value: 'Open' }],
          noteClassName: 'ops-task-success',
          pillClass: 'pill-info',
          stage: 'Open',
        },
      }),
      BookingCustomerWaitPanelSection({
        customerWaitPanel: {
          badges: [{ detail: 'Customer is waiting.', label: 'Waiting', tone: 'pill-warn' }],
          cards: [
            {
              action: 'Review matching.',
              className: 'ops-task-warning',
              detail: 'Customer needs a Partner.',
              pillClass: 'pill-warn',
              status: 'Review',
              title: 'Matching',
            },
          ],
          detail: 'Matching evidence is available.',
          headline: 'Customer is waiting',
          nextActionHref: '#marketplace-supply',
          nextActionLabel: 'Open supply',
          signalStatus: 'Waiting',
          signalTone: 'pill-warn',
        },
      }),
      BookingAppliedPolicySection({
        policySnapshot: {
          decisionCards: [
            {
              className: 'ops-task-success',
              helper: 'Saved on booking open and aligned with current policy.',
              key: 'timeout',
              label: 'Timeout',
              pillClass: 'pill-success',
              status: 'Aligned',
              value: '15 min',
            },
          ],
          decisionDetail: 'Policy is aligned.',
          decisionStatus: 'Aligned',
          decisionTitle: 'Use saved policy',
          decisionTone: 'pill-success',
          metrics: [{ helper: 'Saved policy aligned.', label: 'Policy', value: 'Current' }],
        },
      }),
      BookingAddressRadiusContractSection({
        addressRadiusContract: {
          cards: [
            {
              action: 'Use booking address.',
              className: 'ops-task-success',
              detail: 'Address snapshot retained.',
              pillClass: 'pill-success',
              status: 'Ready',
              title: 'Address',
            },
          ],
          metrics: [{ helper: 'Radius contract retained.', label: 'Radius', value: '10 km' }],
          status: 'Ready',
          tone: 'pill-success',
        },
      }),
      BookingDispatchCandidateDecisionMatrixSection({ marketplaceSupply }),
      BookingMarketplaceSupplySection({ marketplaceSupply }),
    ];

    const classNames = sections.flatMap(classNamesIn);

    expect(normalizedText(sections)).toContain('Booking stage snapshot');
    expect(normalizedText(sections)).toContain('Booking address radius contract');
    expect(classNames.filter((className) => className === 'card admin-section admin-mb-16')).toHaveLength(6);
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
