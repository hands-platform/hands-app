import { ParticipantStatus, ProviderStatus } from '@prisma/client';
import {
  bookingFirstPickRejectedUpdateData,
  bookingMatchedUpdateData,
  bookingParticipantCompoundKey,
  bookingParticipantJoinUpsert,
  bookingParticipantResponseRoute,
  bookingParticipantResponseUnavailableMessage,
  bookingSelectedParticipantUpdate,
  preferredProviderInitialParticipantCreate,
} from './bookings.participants';

describe('booking participant helpers', () => {
  it('builds the Prisma compound key for a booking participant', () => {
    expect(bookingParticipantCompoundKey('booking-1', 'partner-1')).toEqual({
      bookingId_providerProfileId: {
        bookingId: 'booking-1',
        providerProfileId: 'partner-1',
      },
    });
  });

  it('builds the selected participant update payload', () => {
    const respondedAt = new Date('2026-06-11T00:00:00.000Z');

    expect(bookingSelectedParticipantUpdate('booking-1', 'partner-1', respondedAt)).toEqual({
      update: {
        where: {
          bookingId_providerProfileId: {
            bookingId: 'booking-1',
            providerProfileId: 'partner-1',
          },
        },
        data: {
          status: ParticipantStatus.SELECTED,
          respondedAt,
        },
      },
      updateMany: {
        where: {
          providerProfileId: { not: 'partner-1' },
          status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] },
        },
        data: { status: ParticipantStatus.EXPIRED, respondedAt },
      },
    });
  });

  it('builds participant join upsert data with provider status evidence', () => {
    const respondedAt = new Date('2026-06-11T00:30:00.000Z');

    expect(
      bookingParticipantJoinUpsert({
        bookingId: 'booking-1',
        providerProfileId: 'partner-1',
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        distanceMeters: 1200,
        respondedAt,
      }),
    ).toEqual({
      where: {
        bookingId_providerProfileId: {
          bookingId: 'booking-1',
          providerProfileId: 'partner-1',
        },
      },
      update: {
        status: ParticipantStatus.JOINED,
        respondedAt,
        distanceMeters: 1200,
      },
      create: {
        providerProfileId: 'partner-1',
        status: ParticipantStatus.JOINED,
        distanceMeters: 1200,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
      },
    });
  });

  it('builds initial preferred provider participant create data', () => {
    expect(
      preferredProviderInitialParticipantCreate({
        providerProfileId: 'partner-1',
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        distanceMeters: null,
      }),
    ).toEqual({
      create: {
        providerProfileId: 'partner-1',
        status: ParticipantStatus.JOINED,
        distanceMeters: null,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
      },
    });
  });

  it('builds matched booking update data with selected participant state', () => {
    const matchedAt = new Date('2026-06-11T01:00:00.000Z');
    const respondedAt = new Date('2026-06-11T01:00:01.000Z');

    expect(
      bookingMatchedUpdateData({
        bookingId: 'booking-1',
        providerProfileId: 'partner-1',
        matchSource: 'CUSTOMER_SELECTED_PARTNER',
        matchedAt,
        respondedAt,
      }),
    ).toEqual({
      status: 'IN_SERVICE',
      selectedProviderId: 'partner-1',
      matchedAt,
      matchSource: 'CUSTOMER_SELECTED_PARTNER',
      participants: {
        update: {
          where: {
            bookingId_providerProfileId: {
              bookingId: 'booking-1',
              providerProfileId: 'partner-1',
            },
          },
          data: {
            status: ParticipantStatus.SELECTED,
            respondedAt,
          },
        },
        updateMany: {
          where: {
            providerProfileId: { not: 'partner-1' },
            status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] },
          },
          data: { status: ParticipantStatus.EXPIRED, respondedAt },
        },
      },
      chatRoom: { upsert: { create: {}, update: {} } },
    });
  });

  it('builds first-pick rejection update data that closes matching and other participants', () => {
    const respondedAt = new Date('2026-06-11T02:00:00.000Z');

    expect(
      bookingFirstPickRejectedUpdateData({
        bookingId: 'booking-1',
        providerProfileId: 'partner-1',
        respondedAt,
      }),
    ).toEqual({
      status: 'CANCELLED',
      selectedProviderId: null,
      closedAt: respondedAt,
      closedByRole: 'PROVIDER',
      closedReason: 'preferred_provider_rejected',
      participants: {
        update: {
          where: {
            bookingId_providerProfileId: {
              bookingId: 'booking-1',
              providerProfileId: 'partner-1',
            },
          },
          data: {
            status: ParticipantStatus.REJECTED,
            respondedAt,
          },
        },
        updateMany: {
          where: {
            providerProfileId: { not: 'partner-1' },
            status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] },
          },
          data: { status: ParticipantStatus.EXPIRED, respondedAt },
        },
      },
    });
  });

  it('keeps provider response unavailable messages role-specific', () => {
    expect(bookingParticipantResponseUnavailableMessage('partner-1', 'partner-1')).toBe(
      'Preferred partner invitation is not available for this booking',
    );
    expect(bookingParticipantResponseUnavailableMessage('first-pick', 'marketplace-partner')).toBe(
      'Partner must participate in this marketplace booking before responding',
    );
    expect(bookingParticipantResponseUnavailableMessage(null, 'marketplace-partner')).toBe(
      'Partner must participate in this marketplace booking before responding',
    );
  });

  it('routes first-pick accepted and rejected responses before marketplace handling', () => {
    expect(bookingParticipantResponseRoute('partner-1', 'partner-1', ParticipantStatus.ACCEPTED)).toBe(
      'first-pick-accepted',
    );
    expect(bookingParticipantResponseRoute('partner-1', 'partner-1', ParticipantStatus.REJECTED)).toBe(
      'first-pick-rejected',
    );
    expect(bookingParticipantResponseRoute('first-pick', 'marketplace-partner', ParticipantStatus.ACCEPTED)).toBe(
      'marketplace',
    );
    expect(bookingParticipantResponseRoute('partner-1', 'partner-1', ParticipantStatus.JOINED)).toBe(
      'marketplace',
    );
  });
});
