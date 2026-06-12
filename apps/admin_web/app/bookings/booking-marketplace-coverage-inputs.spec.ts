import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMarketplaceCoverageInput,
  bookingMarketplaceCoverageInputFromBooking,
} from './booking-marketplace-coverage-inputs';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('bookingMarketplaceCoverageInput', () => {
  it('builds coverage row inputs from booking data and marketplace facts', () => {
    const nowMs = Date.parse('2026-06-12T10:00:00.000Z');
    const item = booking({
      createdAt: '2026-06-12T09:40:00.000Z',
      earning: {
        currency: 'VND',
        netAmount: 100000,
        status: 'PENDING',
      } as AdminBooking['earning'],
      id: 'booking-1',
      metadata: {
        backupNotificationTraces: [
          {
            createdAt: '2026-06-12T09:50:00.000Z',
            notifiedCount: 2,
            stage: 'retry',
          },
        ],
      },
      participants: [
        { id: 'participant-selected', status: 'SELECTED' },
        { id: 'participant-joined', status: 'JOINED' },
      ],
      preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
      selectedProvider: { id: 'selected', displayName: 'Selected Partner' } as AdminBooking['selectedProvider'],
      status: 'OPEN_MATCHING',
    });

    expect(
      bookingMarketplaceCoverageInput(item, nowMs, {
        backupSelected: true,
        firstPickPending: false,
        hasFinalPartner: true,
        marketplaceParticipantCount: 1,
        matchingWindowExpired: false,
        preferredProviderState: null,
        selectableCount: 1,
        selectedPartnerLabel: 'Selected Partner',
      }),
    ).toEqual({
      booking: item,
      chatRepairNeeded: false,
      firstPickLabel: 'Marketplace selected',
      firstPickTone: 'pill-success',
      marketplaceParticipantCount: 1,
      nextActionLabel: 'Customer final choice',
      nextActionTone: 'pill-warn',
      participantCount: 2,
      selectableCount: 1,
      selectedPartnerLabel: 'Selected Partner',
      sortTimestamp: Date.parse('2026-06-12T09:40:00.000Z'),
      status: 'OPEN_MATCHING',
      traceBatchCount: 1,
      traceLastAge: '10m ago',
      traceLastStage: 'retry',
      traceTotalNotified: 2,
      walletLabel: 'Wallet 100.000 VND',
      walletTone: 'pill-info',
    });
  });

  it('builds coverage row input from booking selection and marketplace counts', () => {
    const nowMs = Date.parse('2026-06-12T10:00:00.000Z');
    const item = booking({
      createdAt: '2026-06-12T09:40:00.000Z',
      id: 'booking-2',
      matchingEvidence: {
        chatReady: true,
      } as AdminBooking['matchingEvidence'],
      selectedProvider: {
        id: 'selected',
        displayName: 'Selected Partner',
      } as AdminBooking['selectedProvider'],
      status: 'MATCHED',
    });

    expect(
      bookingMarketplaceCoverageInputFromBooking(item, nowMs, {
        marketplaceParticipantCount: 2,
        selectableCount: 0,
      }),
    ).toMatchObject({
      marketplaceParticipantCount: 2,
      nextActionLabel: 'Monitor handoff',
      nextActionTone: 'pill-success',
      selectableCount: 0,
      selectedPartnerLabel: 'Selected Partner',
      sortTimestamp: Date.parse('2026-06-12T09:40:00.000Z'),
      status: 'MATCHED',
    });
  });
});
