import {
  bookingAddressSnapshotStateFromFacts,
  type BookingAddressSnapshotStateInput,
} from './booking-address-snapshot-state';

const baseInput: BookingAddressSnapshotStateInput = {
  hasAddressSnapshot: false,
  legacyAddressText: null,
  legacyPinLabel: null,
  snapshotAddressText: null,
  snapshotPinLabel: null,
};

describe('bookingAddressSnapshotStateFromFacts', () => {
  it('returns locked address state when the booking has an address snapshot with text', () => {
    expect(
      bookingAddressSnapshotStateFromFacts({
        ...baseInput,
        hasAddressSnapshot: true,
        snapshotAddressText: '12 Nguyen Hue, District 1',
        snapshotPinLabel: '10.776, 106.700',
      }),
    ).toEqual({
      label: 'Address locked',
      detail: '12 Nguyen Hue, District 1',
      pin: 'Pin 10.776, 106.700',
      tone: 'pill-success',
    });
  });

  it('returns pin locked state when the snapshot has no readable address text', () => {
    expect(
      bookingAddressSnapshotStateFromFacts({
        ...baseInput,
        hasAddressSnapshot: true,
        snapshotPinLabel: '10.776, 106.700',
      }),
    ).toEqual({
      label: 'Pin locked',
      detail: 'Customer confirmed this map pin without a text address.',
      pin: 'Pin 10.776, 106.700',
      tone: 'pill-success',
    });
  });

  it('keeps a success state when snapshot coordinates are not readable', () => {
    expect(
      bookingAddressSnapshotStateFromFacts({
        ...baseInput,
        hasAddressSnapshot: true,
      }),
    ).toMatchObject({
      label: 'Pin locked',
      pin: 'Pin saved without readable coordinates',
      tone: 'pill-success',
    });
  });

  it('returns legacy fallback state when there is no immutable snapshot', () => {
    expect(
      bookingAddressSnapshotStateFromFacts({
        ...baseInput,
        legacyAddressText: 'Legacy customer address',
        legacyPinLabel: '10.770, 106.690',
      }),
    ).toEqual({
      label: 'Stored address fallback',
      detail: 'Legacy customer address',
      pin: 'Pin 10.770, 106.690',
      tone: 'pill-warn',
    });
  });

  it('returns missing state when neither snapshot nor legacy address is available', () => {
    expect(bookingAddressSnapshotStateFromFacts(baseInput)).toEqual({
      label: 'Address missing',
      detail: 'No immutable booking address snapshot is attached.',
      pin: 'Ask customer support to confirm the service address before dispatch.',
      tone: 'pill-danger',
    });
  });
});
