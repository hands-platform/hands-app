export type BookingChatRepairNeedsOpsInput = {
  status: string;
  hasChatRoom: boolean;
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

export function bookingChatRepairNeedsOps(input: BookingChatRepairNeedsOpsInput): boolean {
  return chatRequiredStatuses.has(input.status) && !input.hasChatRoom;
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
      helper: 'Chat opens after customer final partner selection.',
    };
  }

  if (!input.hasSelectedPartner) {
    return {
      canSubmit: false,
      status: 'Final partner missing',
      tone: 'pill-warn',
      helper: 'Repair is locked until the customer final partner selection is recorded.',
    };
  }

  return {
    canSubmit: true,
    status: 'Repair available',
    tone: 'pill-danger',
    helper: 'Final partner is recorded, but the retained chat room is missing.',
  };
}
