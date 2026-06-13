import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorSelectionCopy,
  bookingMonitorSelectionLabelForBooking,
  bookingMonitorSelectionPathLabelForBooking,
} from './booking-monitor-selection-model';

describe('booking monitor selection model', () => {
  it('builds selection copy directly from booking facts', () => {
    const booking = {
      preferredProvider: { id: 'preferred-1' },
      preferredProviderId: 'preferred-1',
      status: 'OPEN_MATCHING',
      participants: [
        {
          providerProfile: { id: 'marketplace-1' },
          status: 'JOINED',
        },
      ],
    } as AdminBooking;

    expect(bookingMonitorSelectionCopy(booking)).toEqual({
      label: 'First-pick partner pending',
      pathLabel: 'Direct request first, with marketplace partners already waiting',
      toneClass: 'pill-warn',
    });
    expect(bookingMonitorSelectionLabelForBooking(booking)).toBe('First-pick partner pending');
    expect(bookingMonitorSelectionPathLabelForBooking(booking)).toBe(
      'Direct request first, with marketplace partners already waiting',
    );
  });

  it('uses final selection copy when matching evidence records the final path', () => {
    expect(
      bookingMonitorSelectionCopy(
        {
          id: 'matched-marketplace',
          matchingEvidence: {
            finalSelection: 'CUSTOMER_SELECTED_PARTNER',
          },
          preferredProvider: { id: 'preferred-1' },
          status: 'MATCHED',
        } as unknown as AdminBooking,
      ).label,
    ).toBe('Customer selected final Partner');
  });
});
