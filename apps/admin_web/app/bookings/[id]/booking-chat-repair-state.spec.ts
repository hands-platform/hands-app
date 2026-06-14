import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  bookingChatRepairActionState,
  bookingChatRepairNeedsOps,
} from './booking-chat-repair-state';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-test',
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

describe('booking chat repair state', () => {
  it('requires repair for matched bookings with a selected Partner but no retained chat', () => {
    const item = booking({
      selectedProviderId: 'partner-selected',
      selectedProvider: { id: 'partner-selected', displayName: 'Selected Partner' },
      status: 'MATCHED',
    });

    expect(bookingChatRepairNeedsOps(item)).toBe(true);
    expect(bookingChatRepairActionState(item)).toMatchObject({
      canSubmit: true,
      status: 'Repair available',
      tone: 'pill-danger',
    });
  });

  it('uses matching evidence chat readiness before falling back to the chat room', () => {
    const item = booking({
      chatRoom: { id: 'chat-room-1' },
      matchingEvidence: { chatReady: false } as AdminBookingDetail['matchingEvidence'],
      selectedProviderId: 'partner-selected',
      status: 'MATCHED',
    });

    expect(bookingChatRepairNeedsOps(item)).toBe(true);
    expect(bookingChatRepairActionState(item)).toMatchObject({
      canSubmit: true,
      status: 'Repair available',
    });
  });

  it('reports ready state when retained chat evidence is available', () => {
    const item = booking({
      chatRoom: { id: 'chat-room-123456' },
      status: 'MATCHED',
    });

    expect(bookingChatRepairNeedsOps(item)).toBe(false);
    expect(bookingChatRepairActionState(item)).toMatchObject({
      canSubmit: false,
      status: 'Chat ready',
      tone: 'pill-success',
    });
  });
});
