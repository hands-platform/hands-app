import { bookingChatReady, type BookingChatEvidenceInput } from './booking-chat-evidence';

function booking(input: BookingChatEvidenceInput): BookingChatEvidenceInput {
  return input;
}

describe('booking chat evidence', () => {
  it('falls back to the loaded chat room when API matching evidence is absent', () => {
    expect(bookingChatReady(booking({ chatRoom: { id: 'room-1' } }))).toBe(true);
    expect(bookingChatReady(booking({ chatRoom: null }))).toBe(false);
  });

  it('prefers API matching evidence over local chat room inference', () => {
    expect(
      bookingChatReady(
        booking({
          chatRoom: null,
          matchingEvidence: {
            stage: 'OPEN_MARKETPLACE_ACTIVE',
            firstPickStatus: 'PENDING',
            finalSelection: 'FIRST_PICK_PENDING',
            marketplaceParticipantCount: 0,
            selectableParticipantCount: 0,
            matchedAt: null,
            matchSource: null,
            chatReady: true,
          },
        }),
      ),
    ).toBe(true);
    expect(
      bookingChatReady(
        booking({
          chatRoom: { id: 'room-1' },
          matchingEvidence: {
            stage: 'MATCHED',
            firstPickStatus: 'ACCEPTED',
            finalSelection: 'FIRST_PICK_ACCEPTED',
            marketplaceParticipantCount: 1,
            selectableParticipantCount: 0,
            matchedAt: '2026-06-10T09:00:00.000Z',
            matchSource: 'FIRST_PICK_ACCEPTED_FIRST',
            chatReady: false,
          },
        }),
      ),
    ).toBe(false);
  });
});
