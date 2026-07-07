export type BookingChatListStateInput = {
  readonly hasChatRoom: boolean;
  readonly messageCount: number;
  readonly status: string;
};

export type BookingChatListState = {
  readonly detail: string;
  readonly label: 'Chat ready' | 'Chat missing' | 'Chat record ready' | 'Chat pending';
  readonly tone: 'pill-success' | 'pill-danger' | 'pill-info' | 'pill-neutral';
};

const chatRequiredStatuses = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'IN_SERVICE'] as const;

export function bookingChatListStateFromFacts(
  input: BookingChatListStateInput,
): BookingChatListState {
  if (input.hasChatRoom) {
    return {
      label: 'Chat ready',
      detail: `${input.messageCount} message(s) retained for admin review.`,
      tone: 'pill-success',
    };
  }

  if (chatRequiredStatuses.some((status) => status === input.status)) {
    return {
      label: 'Chat missing',
      detail: 'Customer and Partner are matched, but no chat room is linked yet.',
      tone: 'pill-danger',
    };
  }

  if (input.status === 'COMPLETED') {
    return {
      label: 'Chat record ready',
      detail: 'Service is completed. Admin should keep any linked chat record available.',
      tone: 'pill-info',
    };
  }

  return {
    label: 'Chat pending',
    detail: 'Chat opens after the customer locks a final Partner.',
    tone: 'pill-neutral',
  };
}
