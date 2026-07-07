import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingParticipantLedger } from './booking-participant-ledger';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-test',
    status: 'OPEN_MATCHING',
    participants: [],
    ...input,
  } as AdminBookingDetail;
}

const marketplaceSupply = {
  radiusMeters: 10_000,
  eligibleCount: 3,
};

const notificationTrace = {
  backupBatches: [{ id: 'batch-1' }],
};

describe('booking participant ledger', () => {
  it('keeps actual participant evidence while separating customer-selectable Partners', () => {
    const ledger = bookingParticipantLedger(
      booking({
        preferredProviderId: 'partner-first',
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Partner',
        },
        selectedProviderId: 'partner-selected',
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Selected Partner',
        },
        participants: [
          {
            id: 'participant-first',
            providerProfileId: 'partner-first',
            status: 'JOINED',
            joinedAt: '2026-06-07T01:00:00.000Z',
            providerProfile: {
              id: 'partner-first',
              displayName: 'First Partner',
            },
          },
          {
            id: 'participant-marketplace',
            providerProfileId: 'partner-marketplace',
            status: 'JOINED',
            joinedAt: '2026-06-07T01:01:00.000Z',
            providerProfile: {
              id: 'partner-marketplace',
              displayName: 'Marketplace Partner',
            },
          },
          {
            id: 'participant-rejected',
            providerProfileId: 'partner-rejected',
            status: 'REJECTED',
            joinedAt: '2026-06-07T01:02:00.000Z',
            respondedAt: '2026-06-07T01:03:00.000Z',
            providerProfile: {
              id: 'partner-rejected',
              displayName: 'Rejected Partner',
            },
          },
          {
            id: 'participant-selected',
            providerProfileId: 'partner-selected',
            status: 'SELECTED',
            joinedAt: '2026-06-07T01:04:00.000Z',
            respondedAt: '2026-06-07T01:05:00.000Z',
            providerProfile: {
              id: 'partner-selected',
              displayName: 'Selected Partner',
            },
          },
        ],
      }),
      marketplaceSupply,
      notificationTrace,
    );

    expect(ledger.status).toBe('Final choice recorded');
    expect(ledger.rows).toHaveLength(4);
    expect(ledger.cards.find((card) => card.label === 'Marketplace participants')?.helper).toBe(
      '2 customer-selectable / 1 evidence-only / 1 rejected row(s).',
    );

    expect(ledger.rows.find((row) => row.id === 'participant-selected')).toMatchObject({
      avatarStatus: 'working',
      role: 'Final Partner',
      choiceState: 'Customer final choice',
      eligibilityLabel: 'Final selected by customer',
      timingJoinedAtValue: '2026-06-07T01:04:00.000Z',
      timingRespondedAtValue: '2026-06-07T01:05:00.000Z',
    });
    expect(ledger.lifecycleRows.find((row) => row.stage === '3. Customer final choice')).toMatchObject({
      evidence: 'Selected Partner is saved as the selected Partner.',
    });
    expect(ledger.rows.find((row) => row.id === 'participant-selected')?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Source', value: 'Final Partner', tone: 'pill-success' }),
        expect.objectContaining({ label: 'Decision', value: 'SELECTED', tone: 'pill-success' }),
        expect.objectContaining({
          label: 'Customer choice',
          value: 'Customer final choice',
          tone: 'pill-success',
        }),
        expect.objectContaining({ label: 'Chat handoff', value: 'Chat missing', tone: 'pill-danger' }),
      ]),
    );
    expect(ledger.rows.find((row) => row.id === 'participant-marketplace')).toMatchObject({
      avatarStatus: 'matching',
      role: 'Marketplace',
      choiceState: 'Customer-selectable',
      eligibilityLabel: 'Customer-selectable',
    });
    expect(ledger.rows.find((row) => row.id === 'participant-marketplace')?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Source', value: 'Marketplace', tone: 'pill-neutral' }),
        expect.objectContaining({ label: 'Customer choice', value: 'Customer-selectable', tone: 'pill-info' }),
        expect.objectContaining({ label: 'Chat handoff', value: 'Not final Partner', tone: 'pill-neutral' }),
      ]),
    );
    expect(ledger.rows.find((row) => row.id === 'participant-first')).toMatchObject({
      avatarStatus: 'matching',
      role: 'First-pick',
      choiceState: 'Evidence-only',
      eligibilityLabel: 'Not customer-selectable yet',
    });
    expect(ledger.rows.find((row) => row.id === 'participant-rejected')).toMatchObject({
      avatarStatus: 'offline',
      choiceState: 'Evidence-only',
      evidenceLabel: 'Declined response row',
      eligibilityLabel: 'Not customer-selectable',
    });
  });

  it('does not imply automatic assignment when the customer has not selected a final Partner', () => {
    const ledger = bookingParticipantLedger(
      booking({
        preferredProviderId: 'partner-first',
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Partner',
        },
        participants: [
          {
            id: 'participant-first',
            providerProfileId: 'partner-first',
            status: 'JOINED',
            providerProfile: {
              id: 'partner-first',
              displayName: 'First Partner',
            },
          },
          {
            id: 'participant-marketplace',
            providerProfileId: 'partner-marketplace',
            status: 'JOINED',
            providerProfile: {
              id: 'partner-marketplace',
              displayName: 'Marketplace Partner',
            },
          },
        ],
      }),
      marketplaceSupply,
      notificationTrace,
    );

    expect(ledger.status).toBe('Customer choice pending');
    expect(ledger.selectionTrace.find((row) => row.label === '4. Final match')).toMatchObject({
      status: 'Pending',
      value: 'No final Partner yet',
      helper: 'Customer final choice is required unless first-pick already matched first.',
    });
    expect(ledger.lifecycleRows.find((row) => row.stage === '3. Customer final choice')).toMatchObject({
      status: 'Waiting customer',
      evidence: '1 customer-selectable Partner(s) available.',
    });
  });

  it('describes chat opening after either first-pick match or customer final selection', () => {
    const ledger = bookingParticipantLedger(
      booking({
        preferredProviderId: 'partner-first',
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Partner',
        },
        participants: [],
      }),
      marketplaceSupply,
      notificationTrace,
    );

    expect(ledger.cards.find((card) => card.label === 'Chat record')).toMatchObject({
      value: 'Not opened',
      helper: 'Chat opens after first-pick match or customer final selection and service handoff.',
    });
  });

  it('keeps a legacy accepted first-pick Partner customer-selectable as fallback evidence', () => {
    const ledger = bookingParticipantLedger(
      booking({
        preferredProviderId: 'partner-first',
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Partner',
        },
        participants: [
          {
            id: 'participant-first',
            providerProfileId: 'partner-first',
            status: 'ACCEPTED',
            joinedAt: '2026-06-07T01:00:00.000Z',
            respondedAt: '2026-06-07T01:02:00.000Z',
            providerProfile: {
              id: 'partner-first',
              displayName: 'First Partner',
            },
          },
        ],
      }),
      marketplaceSupply,
      notificationTrace,
    );

    expect(ledger.status).toBe('Customer choice pending');
    expect(ledger.cards.find((card) => card.label === 'Customer final choice')).toMatchObject({
      value: 'Not selected',
      helper: 'Customer final choice is required unless first-pick already matched first.',
    });
    expect(ledger.rows.find((row) => row.id === 'participant-first')).toMatchObject({
      role: 'First-pick',
      choiceState: 'Customer-selectable',
      eligibilityLabel: 'Customer-selectable',
      operatorStatus: 'Customer-selectable first-pick option',
    });
    expect(ledger.selectionTrace.find((row) => row.label === '4. Final match')).toMatchObject({
      status: 'Pending',
      value: 'No final Partner yet',
    });
  });

  it('treats selectedProviderId as final choice even when the selected Partner relation is omitted', () => {
    const ledger = bookingParticipantLedger(
      booking({
        selectedProviderId: 'partner-selected',
        participants: [
          {
            id: 'participant-selected',
            providerProfileId: 'partner-selected',
            status: 'SELECTED',
            providerProfile: {
              id: 'partner-selected',
              displayName: 'Selected Partner',
            },
          },
        ],
      }),
      marketplaceSupply,
      notificationTrace,
    );

    expect(ledger.status).toBe('Final choice recorded');
    expect(ledger.cards.find((card) => card.label === 'Customer final choice')).toMatchObject({
      value: 'Selected Partner',
      helper: 'SELECTED participant row retained.',
      href: '/partners/partner-selected',
    });
    expect(ledger.selectionTrace.find((row) => row.label === '4. Final match')).toMatchObject({
      status: 'Customer selected',
      value: 'Selected Partner',
    });
  });

  it('flags missing retained chat after a final Partner is selected', () => {
    const ledger = bookingParticipantLedger(
      booking({
        status: 'MATCHED',
        selectedProviderId: 'partner-selected',
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Selected Partner',
        },
        participants: [
          {
            id: 'participant-selected',
            providerProfileId: 'partner-selected',
            status: 'SELECTED',
            providerProfile: {
              id: 'partner-selected',
              displayName: 'Selected Partner',
            },
          },
        ],
        chatRoom: null,
      }),
      marketplaceSupply,
      notificationTrace,
    );

    expect(ledger.cards.find((card) => card.label === 'Chat record')).toMatchObject({
      value: 'Missing',
      helper: 'Matched bookings should create a retained chat record for operations evidence.',
    });
    expect(ledger.lifecycleRows.find((row) => row.stage === '4. Chat and service handoff')).toMatchObject({
      status: 'Chat missing',
      tone: 'pill-danger',
    });
  });
});
