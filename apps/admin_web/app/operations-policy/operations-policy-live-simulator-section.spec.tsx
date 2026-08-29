import type { AdminMatchingPreview } from '../../lib/admin-api';
import { OperationsPolicyLiveSimulatorSection } from './operations-policy-live-simulator-section';
import { classNamesIn, hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

function preview(
  status: AdminMatchingPreview['status'],
  overrides: Partial<AdminMatchingPreview> = {},
): AdminMatchingPreview {
  return {
    candidates: [],
    checkedAt: '2026-08-14T03:00:00.000Z',
    evidence: {
      newestAt: '2026-08-14T02:55:00.000Z',
      oldestAt: '2026-08-14T02:30:00.000Z',
      returnedCandidates: 0,
      totalEvaluated: 12,
      truncated: false,
    },
    primaryBlocker: null,
    reference: {
      bookingId: 'booking-1',
      bookingStatus: 'OPEN_MATCHING',
      kind: 'BOOKING',
      label: 'Booking booking-1',
      lat: 10.7769,
      lng: 106.7009,
      observedAt: '2026-08-14T02:50:00.000Z',
      serviceId: 'service-1',
    },
    safety: { dryRun: true, mutationsPerformed: false },
    stages: [
      {
        actionHref: null,
        actionLabel: null,
        code: 'evaluated',
        excludedCount: 0,
        label: 'Evaluated',
        passedCount: 12,
      },
    ],
    status,
    ...overrides,
  };
}

describe('OperationsPolicyLiveSimulatorSection', () => {
  it('renders production-ready evidence without overstating simulation behavior', () => {
    const section = OperationsPolicyLiveSimulatorSection({
      preview: preview('READY_WITH_PRODUCTION_EVIDENCE', {
        candidates: [
          {
            blockerCodes: [],
            distanceMeters: 950,
            locationUpdatedAt: '2026-08-14T02:55:00.000Z',
            name: 'Partner One',
            partnerId: 'provider-1',
            stage: 'INVITABLE',
          },
        ],
      }),
      refreshHref: '/operations-policy?details=matching&matching=simulation',
    });
    const rendered = normalizedTextContent(section);

    expect(classNamesIn(section)).toContain(
      'card admin-section operations-policy-matching-preview admin-mb-16',
    );
    expect(rendered).toContain('Current dispatch preview');
    expect(rendered).toContain('Ready with production evidence');
    expect(rendered).toContain('Candidate preview');
    expect(rendered).toContain('Dry run only');
    expect(rendered).not.toContain('Live policy simulator');
    expect(rendered).toContain('Read-only, no-write preview');
    expect(hrefsIn(section)).toContain('/partners/provider-1');
  });

  it('warns when a production result is based on a small Partner sample', () => {
    const rendered = normalizedTextContent(OperationsPolicyLiveSimulatorSection({
      preview: preview('READY_WITH_PRODUCTION_EVIDENCE', {
        evidence: {
          newestAt: '2026-08-14T02:55:00.000Z',
          oldestAt: '2026-08-14T02:30:00.000Z',
          returnedCandidates: 1,
          totalEvaluated: 6,
          truncated: false,
        },
      }),
      refreshHref: '/operations-policy?details=matching&matching=simulation',
    }));

    expect(rendered).toContain('Preview confidence is limited');
    expect(rendered).toContain('Small sample');
    expect(rendered).toContain('not a city-wide supply conclusion');
  });

  it('never presents Demo evidence as ready even when candidate data is supplied', () => {
    const section = OperationsPolicyLiveSimulatorSection({
      preview: preview('DEMO_PREVIEW_ONLY', {
        candidates: [
          {
            blockerCodes: [],
            distanceMeters: 100,
            locationUpdatedAt: '2026-08-14T02:55:00.000Z',
            name: 'Demo Partner',
            partnerId: 'demo-partner',
            stage: 'INVITABLE',
          },
        ],
        reference: {
          bookingId: null,
          bookingStatus: null,
          kind: 'DEMO',
          label: 'Renamed demo location',
          lat: 10.7769,
          lng: 106.7009,
          observedAt: null,
          serviceId: null,
        },
      }),
      refreshHref: '/operations-policy?details=matching&matching=simulation',
    });
    const rendered = normalizedTextContent(section);

    expect(rendered).toContain('Demo preview only');
    expect(rendered).toContain('Demo evidence cannot authorize dispatch');
    expect(rendered).toContain('Not production evidence');
    expect(rendered).toContain('Not evaluated');
    expect(rendered).not.toContain('Ready with production evidence');
    expect(rendered).not.toContain('Candidate preview');
  });

  it('labels demo and incomplete Supply evidence as inconclusive', () => {
    const demo = normalizedTextContent(OperationsPolicyLiveSimulatorSection({
      compact: true,
      preview: preview('DEMO_PREVIEW_ONLY', {
        reference: {
          bookingId: null,
          bookingStatus: null,
          kind: 'DEMO',
          label: 'Ho Chi Minh City demo reference',
          lat: 10.7769,
          lng: 106.7009,
          observedAt: null,
          serviceId: null,
        },
      }),
      refreshHref: '/operations-policy?details=matching&matching=supply',
      variant: 'supply',
    }));
    const incomplete = normalizedTextContent(OperationsPolicyLiveSimulatorSection({
      compact: true,
      preview: preview('INCOMPLETE_EVIDENCE'),
      refreshHref: '/operations-policy?details=matching&matching=supply',
      variant: 'supply',
    }));

    expect(demo).toContain('Inconclusive · demo reference');
    expect(demo).not.toContain('Blocked · no eligible Partner supply');
    expect(incomplete).toContain('Inconclusive · incomplete evidence');
  });

  it('shows the first production blocker and its exact recovery action', () => {
    const section = OperationsPolicyLiveSimulatorSection({
      preview: preview('BLOCKED_NO_ELIGIBLE_SUPPLY', {
        primaryBlocker: {
          actionHref: '/partner-controls?details=controls&review=location',
          actionLabel: 'Review Partner locations',
          code: 'fresh-location',
          detail: '5 Partner records were excluded at this production gate.',
          title: 'Fresh dispatch location blocks dispatch',
        },
      }),
      refreshHref: '/operations-policy?details=matching&matching=simulation',
    });
    const rendered = normalizedTextContent(section);

    expect(rendered).toContain('Blocked · no eligible Partner supply');
    expect(rendered).toContain('Primary blocker');
    expect(rendered).toContain('Fresh dispatch location blocks dispatch');
    expect(hrefsIn(section)).toContain('/partner-controls?details=controls&review=location');
  });

  it('keeps the blocker conclusion but hides booking and Partner links without detail permissions', () => {
    const section = OperationsPolicyLiveSimulatorSection({
      canOpenBookingEvidence: false,
      canOpenPartnerEvidence: false,
      preview: preview('BLOCKED_NO_ELIGIBLE_SUPPLY', {
        primaryBlocker: {
          actionHref: '/partner-controls?details=controls&review=location',
          actionLabel: 'Review Partner locations',
          code: 'fresh-location',
          detail: '5 Partner records were excluded at this production gate.',
          title: 'Fresh dispatch location blocks dispatch',
        },
      }),
      refreshHref: '/operations-policy?details=matching&matching=simulation',
    });
    const rendered = normalizedTextContent(section);

    expect(rendered).toContain('Fresh dispatch location blocks dispatch');
    expect(rendered).not.toContain('Review Partner locations');
    expect(hrefsIn(section)).not.toContain('/partner-controls?details=controls&review=location');
  });

  it('shows only the top three non-zero stage blockers in compact Supply view', () => {
    const rendered = normalizedTextContent(OperationsPolicyLiveSimulatorSection({
      compact: true,
      preview: preview('BLOCKED_NO_ELIGIBLE_SUPPLY', {
        stages: [
          { actionHref: null, actionLabel: null, code: 'evaluated', excludedCount: 0, label: 'Evaluated', passedCount: 50 },
          { actionHref: null, actionLabel: null, code: 'online', excludedCount: 10, label: 'Online', passedCount: 40 },
          { actionHref: null, actionLabel: null, code: 'account', excludedCount: 0, label: 'Account', passedCount: 40 },
          { actionHref: null, actionLabel: null, code: 'identity', excludedCount: 8, label: 'Identity', passedCount: 32 },
          { actionHref: null, actionLabel: null, code: 'service', excludedCount: 7, label: 'Service', passedCount: 25 },
          { actionHref: null, actionLabel: null, code: 'location', excludedCount: 6, label: 'Location', passedCount: 19 },
        ],
      }),
      refreshHref: '/operations-policy?details=matching&matching=supply',
      variant: 'supply',
    }));

    expect(rendered).toContain('Top matching blockers');
    expect(rendered).toContain('Top 3');
    expect(rendered).toContain('Online 10');
    expect(rendered).toContain('Identity 8');
    expect(rendered).toContain('Service 7');
    expect(rendered).not.toContain('Account 0');
    expect(rendered).not.toContain('Location 6');
    expect(rendered).toContain('do not combine them into a total supply count');
  });

  it('does not claim global no-supply for incomplete evidence', () => {
    const rendered = normalizedTextContent(
      OperationsPolicyLiveSimulatorSection({
        preview: preview('INCOMPLETE_EVIDENCE', {
          evidence: {
            newestAt: null,
            oldestAt: null,
            returnedCandidates: 0,
            totalEvaluated: 30,
            truncated: true,
          },
        }),
        refreshHref: '/operations-policy?details=matching&matching=simulation',
      }),
    );

    expect(rendered).toContain('Evidence incomplete');
    expect(rendered).toContain('Incomplete');
    expect(rendered).toContain('No global supply conclusion is shown');
    expect(rendered).not.toContain('Blocked · no eligible Partner supply');
  });

  it('renders API failure separately from an empty candidate result', () => {
    const rendered = normalizedTextContent(
      OperationsPolicyLiveSimulatorSection({
        preview: null,
        refreshHref: '/operations-policy?details=matching&matching=simulation',
        unavailable: true,
      }),
    );

    expect(rendered).toContain('Production evidence unavailable');
    expect(rendered).not.toContain('Blocked · no eligible Partner supply');
  });
});
