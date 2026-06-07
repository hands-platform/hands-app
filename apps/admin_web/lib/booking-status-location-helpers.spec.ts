import {
  bookingLocationTrail,
  isPreferredAwaitingDecision,
} from './booking-status-location-helpers';

describe('booking status location helpers', () => {
  it('treats a preferred partner with no participant status as awaiting decision', () => {
    expect(isPreferredAwaitingDecision({ hasPreferredPartner: true, preferredParticipantStatus: null })).toBe(
      true,
    );
  });

  it('stops waiting when the preferred participant accepted, selected, or rejected', () => {
    for (const preferredParticipantStatus of ['ACCEPTED', 'SELECTED', 'REJECTED']) {
      expect(
        isPreferredAwaitingDecision({
          hasPreferredPartner: true,
          preferredParticipantStatus,
        }),
      ).toBe(false);
    }
  });

  it('keeps waiting for an undecided preferred participant', () => {
    expect(
      isPreferredAwaitingDecision({
        hasPreferredPartner: true,
        preferredParticipantStatus: 'JOINED',
      }),
    ).toBe(true);
  });

  it('returns explicit booking snapshots before falling back to latest provider location', () => {
    const explicitSnapshot = { id: 'snapshot-1' };
    const latestPartnerSnapshot = { id: 'snapshot-2' };

    expect(bookingLocationTrail([explicitSnapshot], latestPartnerSnapshot)).toEqual([
      explicitSnapshot,
    ]);
  });

  it('falls back to the latest provider location when explicit snapshots are missing', () => {
    const latestPartnerSnapshot = { id: 'snapshot-2' };

    expect(bookingLocationTrail([], latestPartnerSnapshot)).toEqual([latestPartnerSnapshot]);
  });

  it('returns an empty trail when neither explicit snapshots nor latest location exist', () => {
    expect(bookingLocationTrail([], null)).toEqual([]);
  });
});
