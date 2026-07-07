export type BookingAddressSnapshotStateInput = {
  readonly hasAddressSnapshot: boolean;
  readonly legacyAddressText: string | null;
  readonly legacyPinLabel: string | null;
  readonly snapshotAddressText: string | null;
  readonly snapshotPinLabel: string | null;
};

export type BookingAddressSnapshotState = {
  readonly detail: string;
  readonly label: 'Address locked' | 'Pin locked' | 'Stored address fallback' | 'Address missing';
  readonly pin: string;
  readonly tone: 'pill-success' | 'pill-warn' | 'pill-danger';
};

export function bookingAddressSnapshotStateFromFacts(
  input: BookingAddressSnapshotStateInput,
): BookingAddressSnapshotState {
  if (input.hasAddressSnapshot) {
    return {
      label: input.snapshotAddressText ? 'Address locked' : 'Pin locked',
      detail: input.snapshotAddressText ?? 'Customer confirmed this map pin without a text address.',
      pin: input.snapshotPinLabel
        ? 'Confirmed service address saved'
        : 'Pin saved without readable coordinates',
      tone: 'pill-success',
    };
  }

  if (input.legacyAddressText) {
    return {
      label: 'Stored address fallback',
      detail: input.legacyAddressText,
      pin: input.legacyPinLabel ? 'Stored booking location saved' : 'No locked pin record',
      tone: 'pill-warn',
    };
  }

  return {
    label: 'Address missing',
    detail: 'No confirmed service address record is attached.',
    pin: 'Ask customer support to confirm the service address before dispatch.',
    tone: 'pill-danger',
  };
}
