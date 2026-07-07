import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingMvpAuthorityContract } from './booking-mvp-authority-contract';
import type { bookingFinanceTrace } from './booking-finance-trace';
import type { bookingMarketplacePartnerSupply } from './booking-marketplace-supply';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-authority',
    status: 'OPEN_MATCHING',
    participants: [],
    ...input,
  } as AdminBookingDetail;
}

function marketplaceSupply(
  overrides: Partial<ReturnType<typeof bookingMarketplacePartnerSupply>> = {},
): ReturnType<typeof bookingMarketplacePartnerSupply> {
  return {
    eligibleCount: 0,
    rows: [],
    excludedGroups: [],
    metrics: [],
    policyPin: {
      lat: 10.7769,
      lng: 106.7009,
      label: 'Booking pin',
    },
    ...overrides,
  } as ReturnType<typeof bookingMarketplacePartnerSupply>;
}

function financeTrace(
  overrides: Partial<ReturnType<typeof bookingFinanceTrace>> = {},
): ReturnType<typeof bookingFinanceTrace> {
  return {
    walletLedger: 'Wallet clear',
    serviceOption: 'Service pending',
    ...overrides,
  } as ReturnType<typeof bookingFinanceTrace>;
}

describe('booking MVP authority contract', () => {
  it('uses operator-facing address and chat record labels', () => {
    const rows = bookingMvpAuthorityContract({
      booking: booking({
        addressSnapshot: {
          addressText: 'District 1 address',
          latitude: 10.7769,
          longitude: 106.7009,
        } as AdminBookingDetail['addressSnapshot'],
        chatRoom: { id: 'chat-room-retained' } as AdminBookingDetail['chatRoom'],
        status: 'MATCHED',
      }),
      operationalPolicies: [],
      marketplaceSupply: marketplaceSupply(),
      messageCount: 3,
      financeTrace: financeTrace(),
      walletDebt: false,
      terminal: false,
    });

    expect(rows.find((row) => row.contract === 'Confirmed service address')).toMatchObject({
      status: 'Address ready',
      scope: 'Required dispatch pin',
    });
    expect(rows.find((row) => row.contract === 'Chat lifecycle')).toMatchObject({
      status: 'Chat record ready',
      scope: 'Created after match, retained for Admin',
    });
    expect(JSON.stringify(rows)).not.toMatch(/\bBooking address snapshot\b|\bSnapshot ready\b|Chat archived|archive/i);
  });

  it('uses first-pick matching evidence as a valid final Partner connection', () => {
    const rows = bookingMvpAuthorityContract({
      booking: booking({
        status: 'MATCHED',
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Pick Partner',
        },
        matchingEvidence: {
          stage: 'MATCHED',
          finalSelection: 'FIRST_PICK_ACCEPTED',
          firstPickStatus: 'SELECTED',
          marketplaceParticipantCount: 0,
          selectableParticipantCount: 0,
          matchedAt: '2026-06-10T10:00:00.000Z',
          matchSource: 'FIRST_PICK_ACCEPTED_FIRST',
          chatReady: false,
        },
      }),
      operationalPolicies: [],
      marketplaceSupply: marketplaceSupply(),
      messageCount: 0,
      financeTrace: financeTrace(),
      walletDebt: false,
      terminal: false,
    });

    expect(rows.find((row) => row.contract === 'Final Partner connection')).toMatchObject({
      status: 'Final Partner selected',
      evidence: 'First Pick Partner',
      tone: 'pill-success',
    });
    expect(rows.find((row) => row.contract === 'First-pick window')?.operatorUse).toContain(
      'validly accepted first',
    );
  });

  it('uses matching evidence counts for customer-choice pending state', () => {
    const rows = bookingMvpAuthorityContract({
      booking: booking({
        status: 'OPEN_MATCHING',
        matchingEvidence: {
          stage: 'OPEN_MARKETPLACE_ACTIVE',
          finalSelection: 'CUSTOMER_SELECTION_AVAILABLE',
          firstPickStatus: 'JOINED',
          marketplaceParticipantCount: 2,
          selectableParticipantCount: 3,
          matchedAt: null,
          matchSource: null,
          chatReady: false,
        },
      }),
      operationalPolicies: [],
      marketplaceSupply: marketplaceSupply(),
      messageCount: 0,
      financeTrace: financeTrace(),
      walletDebt: false,
      terminal: false,
    });

    expect(rows.find((row) => row.contract === 'Final Partner connection')).toMatchObject({
      status: 'Customer choice pending',
      evidence: '3 customer-selectable Partner(s), 0 participant(s).',
      operatorUse:
        'Do not auto-assign; customer choice is required unless first-pick validly accepts first through the API.',
    });
  });
});
