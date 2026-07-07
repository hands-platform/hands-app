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
      pin: 'Confirmed service address saved',
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
      pin: 'Confirmed service address saved',
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
      pin: 'Stored booking location saved',
      tone: 'pill-warn',
    });
  });

  it('does not echo raw coordinate labels in any snapshot state text', () => {
    const state = bookingAddressSnapshotStateFromFacts({
      ...baseInput,
      hasAddressSnapshot: true,
      snapshotAddressText: '12 Nguyen Hue, District 1',
      snapshotPinLabel: '10.7769, 106.7009',
    });

    expect(JSON.stringify(state)).not.toMatch(/\d{1,3}\.\d{2,},\s*\d{1,3}\.\d{2,}/);
  });

  it('returns missing state when neither snapshot nor legacy address is available', () => {
    expect(bookingAddressSnapshotStateFromFacts(baseInput)).toEqual({
      label: 'Address missing',
      detail: 'No confirmed service address record is attached.',
      pin: 'Ask customer support to confirm the service address before dispatch.',
      tone: 'pill-danger',
    });
  });
});
