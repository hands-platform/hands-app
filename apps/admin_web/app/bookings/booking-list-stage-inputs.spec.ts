import type { AdminBooking } from '../../lib/admin-api';
import { bookingListStage, bookingListStageInput } from './booking-list-stage-inputs';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'OPEN_MATCHING',
    ...overrides,
  } as AdminBooking;
}

describe('booking list stage inputs', () => {
  it('maps open matching booking facts into stage input', () => {
    expect(
      bookingListStageInput(
        booking({
          expiresAt: '2026-06-07T09:45:00.000Z',
          metadata: {
            backupNotificationTraces: [{ notifiedCount: 2 }],
          } as AdminBooking['metadata'],
        }),
        nowMs,
        { marketplaceCount: 3, selectableCount: 1 },
      ),
    ).toMatchObject({
      bookingId: 'booking-1',
      hasChatRoom: false,
      isHandoffStatus: false,
      isTerminalStatus: false,
      marketplaceAlertNotifiedCount: 2,
      marketplaceCount: 3,
      responseWindowExpired: true,
      selectableCount: 1,
      selectedPartnerPresent: false,
      status: 'OPEN_MATCHING',
    });
  });

  it('maps matched chat and provider state into handoff input', () => {
    expect(
      bookingListStageInput(
        booking({
          status: 'MATCHED',
          chatRoom: { id: 'chat-1', messages: [] } as AdminBooking['chatRoom'],
          selectedProvider: {
            id: 'provider-1',
            displayName: 'Selected Partner',
          } as AdminBooking['selectedProvider'],
        }),
        nowMs,
        { marketplaceCount: 0, selectableCount: 0 },
      ),
    ).toMatchObject({
      hasChatRoom: true,
      isHandoffStatus: true,
      selectedPartnerPresent: true,
      status: 'MATCHED',
    });
  });

  it('keeps the stage output wired to extracted inputs', () => {
    expect(
      bookingListStage(
        booking({
          expiresAt: '2026-06-07T09:45:00.000Z',
        }),
        nowMs,
        { marketplaceCount: 0, selectableCount: 0 },
      ),
    ).toMatchObject({
      key: 'first-pick',
      label: 'Preferred pending',
      tone: 'danger',
    });
  });
});
