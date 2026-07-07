import { shortId } from './admin-format';

const terminalChatStatuses = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);

export type BookingChatLifecycleInput = {
  status?: string | null;
  chatRoom?: { id?: string | null } | null;
};

export type BookingChatLifecycle = {
  status: string;
  tone: 'pill-neutral' | 'pill-info' | 'pill-success';
  customerState: string;
  customerDetail: string;
  partnerState: string;
  partnerDetail: string;
  adminState: string;
  adminDetail: string;
  roomLabel: string;
};

export function bookingChatLifecycle(
  booking: BookingChatLifecycleInput,
  messageCount: number,
): BookingChatLifecycle {
  const roomLabel = booking.chatRoom ? shortId(booking.chatRoom.id) : 'No room yet';

  if (!booking.chatRoom) {
    return {
      status: 'Not created',
      tone: 'pill-neutral',
      customerState: 'Locked',
      customerDetail: 'Customer chat appears after final Partner handoff.',
      partnerState: 'Locked',
      partnerDetail: 'Partner chat appears after match/service start.',
      adminState: 'Waiting',
      adminDetail: 'No transcript exists yet.',
      roomLabel,
    };
  }

  if (terminalChatStatuses.has(booking.status ?? '')) {
    return {
      status: 'Retained for review',
      tone: 'pill-success',
      customerState: 'Hidden after closeout',
      customerDetail: 'Customer app can hide the active room when the service record is closed.',
      partnerState: 'Hidden after closeout',
      partnerDetail: 'Partner app can hide the active room after completion or closeout.',
      adminState: 'Archived',
      adminDetail: `${messageCount} message(s) kept for support, refund, and dispute review.`,
      roomLabel,
    };
  }

  return {
    status: 'Live',
    tone: 'pill-info',
    customerState: 'Visible',
    customerDetail: 'Customer can coordinate with the assigned Partner.',
    partnerState: 'Visible',
    partnerDetail: 'Partner can message the customer during handoff and service.',
    adminState: 'Live archive',
    adminDetail: `${messageCount} message(s) visible now and retained after closeout.`,
    roomLabel,
  };
}
