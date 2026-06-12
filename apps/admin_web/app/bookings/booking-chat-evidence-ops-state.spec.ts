import {
  bookingChatEvidenceNeedsOpsFromReaders,
  bookingDecisionEvidenceMissingFromReaders,
  type BookingChatEvidenceNeedsOpsReaders,
  type BookingDecisionEvidenceMissingReaders,
} from './booking-chat-evidence-ops-state';

function chatReaders(
  overrides: Partial<BookingChatEvidenceNeedsOpsReaders> = {},
): BookingChatEvidenceNeedsOpsReaders {
  return {
    chatQuietNeedsOps: jest.fn(() => false),
    chatReady: true,
    chatRepairNeedsOps: jest.fn(() => false),
    decisionEvidenceMissing: jest.fn(() => false),
    manualDecisionNeedsOps: jest.fn(() => false),
    refundReviewNeedsOps: jest.fn(() => false),
    ...overrides,
  };
}

function decisionReaders(
  overrides: Partial<BookingDecisionEvidenceMissingReaders> = {},
): BookingDecisionEvidenceMissingReaders {
  return {
    chatRepairNeedsOps: jest.fn(() => false),
    hasAlertTrace: jest.fn(() => false),
    hasChatMessage: jest.fn(() => false),
    hasProviderLocation: jest.fn(() => false),
    manualDecisionNeedsOps: jest.fn(() => false),
    ...overrides,
  };
}

describe('bookingChatEvidenceNeedsOpsFromReaders', () => {
  it('short-circuits on chat repair evidence', () => {
    const readers = chatReaders({
      chatRepairNeedsOps: jest.fn(() => true),
      decisionEvidenceMissing: jest.fn(() => true),
    });

    expect(bookingChatEvidenceNeedsOpsFromReaders(readers)).toBe(true);
    expect(readers.decisionEvidenceMissing).not.toHaveBeenCalled();
  });

  it('requires chat readiness for manual and refund review evidence', () => {
    expect(
      bookingChatEvidenceNeedsOpsFromReaders(
        chatReaders({ chatReady: true, manualDecisionNeedsOps: () => true }),
      ),
    ).toBe(true);
    expect(
      bookingChatEvidenceNeedsOpsFromReaders(
        chatReaders({ chatReady: true, refundReviewNeedsOps: () => true }),
      ),
    ).toBe(true);
    expect(
      bookingChatEvidenceNeedsOpsFromReaders(
        chatReaders({
          chatReady: false,
          manualDecisionNeedsOps: () => true,
          refundReviewNeedsOps: () => true,
        }),
      ),
    ).toBe(false);
  });
});

describe('bookingDecisionEvidenceMissingFromReaders', () => {
  it('returns false without reading evidence when no decision or chat repair is needed', () => {
    const readers = decisionReaders();

    expect(bookingDecisionEvidenceMissingFromReaders(readers)).toBe(false);
    expect(readers.hasChatMessage).not.toHaveBeenCalled();
    expect(readers.hasProviderLocation).not.toHaveBeenCalled();
    expect(readers.hasAlertTrace).not.toHaveBeenCalled();
  });

  it('returns true when a decision needs ops and no evidence exists', () => {
    expect(
      bookingDecisionEvidenceMissingFromReaders(
        decisionReaders({ manualDecisionNeedsOps: () => true }),
      ),
    ).toBe(true);
  });

  it('returns false when chat, location, or alert evidence exists', () => {
    expect(
      bookingDecisionEvidenceMissingFromReaders(
        decisionReaders({
          manualDecisionNeedsOps: () => true,
          hasChatMessage: () => true,
        }),
      ),
    ).toBe(false);
    expect(
      bookingDecisionEvidenceMissingFromReaders(
        decisionReaders({
          chatRepairNeedsOps: () => true,
          hasProviderLocation: () => true,
        }),
      ),
    ).toBe(false);
    expect(
      bookingDecisionEvidenceMissingFromReaders(
        decisionReaders({
          chatRepairNeedsOps: () => true,
          hasAlertTrace: () => true,
        }),
      ),
    ).toBe(false);
  });
});
