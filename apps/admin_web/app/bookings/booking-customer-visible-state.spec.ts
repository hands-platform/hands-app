import type { AdminBooking } from '../../lib/admin-api';
import { bookingCustomerVisibleStateLabel } from './booking-customer-visible-state';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('bookingCustomerVisibleStateLabel', () => {
  it('builds final Partner customer copy from booking data and visible state facts', () => {
    expect(
      bookingCustomerVisibleStateLabel(
        booking({
          preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
          status: 'MATCHED',
        }),
        {
          customerSelectablePartnerCount: 0,
          hasChatRoom: true,
          marketplacePartnerCount: 0,
          preferredAwaitingDecision: false,
          selectedPartnerLabel: 'Selected Partner',
        },
      ),
    ).toBe('Customer screen: final Partner Selected Partner with chat ready');
  });

  it('keeps first-pick and marketplace visibility copy based on local facts', () => {
    expect(
      bookingCustomerVisibleStateLabel(
        booking({
          preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
          status: 'OPEN_MATCHING',
        }),
        {
          customerSelectablePartnerCount: 0,
          hasChatRoom: false,
          marketplacePartnerCount: 2,
          preferredAwaitingDecision: true,
          selectedPartnerLabel: null,
        },
      ),
    ).toBe('Customer screen: first-pick wait plus 2 marketplace option(s)');
  });

  it('uses the booking status for closed and fallback copy', () => {
    expect(
      bookingCustomerVisibleStateLabel(
        booking({
          status: 'COMPLETED',
        }),
        {
          customerSelectablePartnerCount: 0,
          hasChatRoom: false,
          marketplacePartnerCount: 0,
          preferredAwaitingDecision: false,
          selectedPartnerLabel: null,
        },
      ),
    ).toBe('Customer screen: closed as COMPLETED');
  });
});
