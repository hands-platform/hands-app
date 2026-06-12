import {
  bookingParticipantJoinedLabel,
  bookingParticipantRespondedLabel,
  bookingParticipantTimestamp,
} from './booking-participant-time-labels';

describe('booking participant time labels', () => {
  it('formats joined and responded labels from participant timestamps', () => {
    const nowMs = Date.parse('2026-06-12T10:15:00.000Z');
    const participant = {
      joinedAt: '2026-06-12T10:00:00.000Z',
      respondedAt: '2026-06-12T10:05:00.000Z',
    };

    expect(bookingParticipantJoinedLabel(participant, nowMs)).toBe('12 Jun 2026, 17:00 / 15m ago');
    expect(bookingParticipantRespondedLabel(participant)).toBe('Responded 12 Jun 2026, 17:05');
    expect(bookingParticipantTimestamp(participant)).toBe(Date.parse('2026-06-12T10:05:00.000Z'));
  });

  it('uses fallback labels and zero timestamp when participant times are missing or invalid', () => {
    expect(bookingParticipantJoinedLabel({}, Date.now())).toBe('Participation time not saved');
    expect(bookingParticipantRespondedLabel({})).toBe('No response time saved');
    expect(bookingParticipantTimestamp({ joinedAt: 'bad-date' })).toBe(0);
  });
});
