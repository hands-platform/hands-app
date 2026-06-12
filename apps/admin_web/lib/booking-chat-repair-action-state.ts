import {
  bookingCheckFlag,
  compactBookingCheckFlags,
  type BookingCheckLevelFlag,
} from './booking-check-level';

export type BookingChatRepairNeedsOpsInput = {
  status: string;
  hasChatRoom: boolean;
};

export type BookingChatQuietNeedsOpsInput = {
  status: string;
  hasChatRoom: boolean;
  messageCount: number;
};

export type BookingChatRepairActionStateInput = BookingChatRepairNeedsOpsInput & {
  chatRoomShortId?: string | null;
  hasSelectedPartner: boolean;
};

export type BookingChatRepairActionState = {
  canSubmit: boolean;
  status: string;
  tone: 'pill-danger' | 'pill-neutral' | 'pill-success' | 'pill-warn';
  helper: string;
};

const chatRequiredStatuses = new Set([
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
  'COMPLETED',
]);

const activeChatStatuses = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);

export function bookingChatRepairNeedsOps(input: BookingChatRepairNeedsOpsInput): boolean {
  return chatRequiredStatuses.has(input.status) && !input.hasChatRoom;
}

export function bookingChatQuietNeedsOps(input: BookingChatQuietNeedsOpsInput): boolean {
  return input.hasChatRoom && input.messageCount === 0 && activeChatStatuses.has(input.status);
}

export function bookingChatCheckFlagsFromFacts(
  input: BookingChatQuietNeedsOpsInput,
): BookingCheckLevelFlag[] {
  return compactBookingCheckFlags([
    bookingCheckFlag(bookingChatQuietNeedsOps(input), 'low', 'Chat quiet'),
  ]);
}

export function bookingChatRepairActionState(
  input: BookingChatRepairActionStateInput,
): BookingChatRepairActionState {
  if (input.hasChatRoom) {
    return {
      canSubmit: false,
      status: 'Chat ready',
      tone: 'pill-success',
      helper: `Room ${input.chatRoomShortId ?? 'unknown'} is retained for admin evidence.`,
    };
  }

  if (!bookingChatRepairNeedsOps(input)) {
    return {
      canSubmit: false,
      status: 'Not required',
      tone: 'pill-neutral',
      helper: 'Chat opens after first-pick match or customer final selection.',
    };
  }

  if (!input.hasSelectedPartner) {
    return {
      canSubmit: false,
      status: 'Final partner missing',
      tone: 'pill-warn',
      helper: 'Repair is locked until first-pick match or customer final selection is recorded.',
    };
  }

  return {
    canSubmit: true,
    status: 'Repair available',
    tone: 'pill-danger',
    helper: 'Final partner is recorded, but the retained chat room is missing.',
  };
}
