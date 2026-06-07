import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-test',
    status: 'OPEN_MATCHING',
    participants: [],
    ...input,
  } as AdminBookingDetail;
}

describe('booking final partner summary', () => {
  it('prefers the selected partner relation when it is included', () => {
    const summary = bookingFinalPartnerSummary(
      booking({
        selectedProviderId: 'partner-selected',
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Selected Partner',
        },
        participants: [
          {
            id: 'participant-selected',
            providerProfileId: 'partner-selected',
            status: 'SELECTED',
            providerProfile: {
              id: 'partner-selected',
              displayName: 'Participant Partner',
            },
          },
        ],
      }),
    );

    expect(summary).toMatchObject({
      id: 'partner-selected',
      label: 'Selected Partner',
      href: '/partners/partner-selected',
      selected: true,
    });
  });

  it('falls back to the selected participant relation when selectedProvider is omitted', () => {
    const summary = bookingFinalPartnerSummary(
      booking({
        selectedProviderId: 'partner-selected',
        participants: [
          {
            id: 'participant-selected',
            providerProfileId: 'partner-selected',
            status: 'SELECTED',
            providerProfile: {
              id: 'partner-selected',
              displayName: 'Selected Participant Partner',
            },
          },
        ],
      }),
    );

    expect(summary).toMatchObject({
      id: 'partner-selected',
      label: 'Selected Participant Partner',
      href: '/partners/partner-selected',
      selected: true,
    });
  });

  it('falls back to the selected partner id when no relation payload is present', () => {
    const summary = bookingFinalPartnerSummary(
      booking({
        selectedProviderId: 'partner-selected',
      }),
    );

    expect(summary).toMatchObject({
      id: 'partner-selected',
      label: 'Partner partner-',
      href: '/partners/partner-selected',
      selected: true,
    });
  });

  it('does not treat preferred partner fallback as customer final choice', () => {
    const summary = bookingFinalPartnerSummary(
      booking({
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Partner',
        },
      }),
    );

    expect(summary).toMatchObject({
      id: null,
      label: 'Not selected',
      href: '#participants',
      selected: false,
    });
  });
});
