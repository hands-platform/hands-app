import { bookingMatchingCheckFlagsFromFacts } from './booking-matching-check-flags';

describe('bookingMatchingCheckFlagsFromFacts', () => {
  it('builds open matching flags in operator priority order', () => {
    expect(
      bookingMatchingCheckFlagsFromFacts({
        status: 'OPEN_MATCHING',
        matchingWindowExpired: true,
        firstPickPending: true,
        participantCount: 0,
      }),
    ).toEqual([
      { severity: 'high', title: 'Matching window expired' },
      { severity: 'medium', title: 'First-pick partner pending' },
      { severity: 'medium', title: 'No partner supply' },
    ]);
  });

  it('builds matched without chat flag only when chat is missing', () => {
    expect(
      bookingMatchingCheckFlagsFromFacts({
        status: 'MATCHED',
        matchingChatReady: false,
      }),
    ).toEqual([{ severity: 'high', title: 'Matched without chat' }]);

    expect(
      bookingMatchingCheckFlagsFromFacts({
        status: 'MATCHED',
        matchingChatReady: true,
      }),
    ).toEqual([]);
  });
});
