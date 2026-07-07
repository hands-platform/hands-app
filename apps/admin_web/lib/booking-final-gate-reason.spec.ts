import {
  bookingFinalGateReason,
  bookingFinalGateReasonPresentation,
  type BookingFinalGateReasonInput,
} from './booking-final-gate-reason';

const baseInput: BookingFinalGateReasonInput = {
  cashDebt: false,
  walletLedgerLabel: 'Wallet clear',
  hasAddressSnapshot: true,
  bookingStatus: 'CREATED',
  hasPreferredPartner: false,
  preferredAwaitingDecision: false,
  customerChoiceCandidates: 0,
  marketplaceParticipants: 0,
  selected: false,
  hasChatRoom: false,
};

describe('bookingFinalGateReason', () => {
  it('blocks operations when Partner wallet debt is active', () => {
    const result = bookingFinalGateReason({
      ...baseInput,
      cashDebt: true,
      walletLedgerLabel: 'Wallet -120.000 VND',
    });

    expect(result).toMatchObject({
      title: 'Wallet debt gate',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    });
    expect(result.detail).toContain('final acceptance, service start, and payout release wait');
  });

  it('requires confirmed service address before radius-based dispatch evidence', () => {
    const result = bookingFinalGateReason({
      ...baseInput,
      hasAddressSnapshot: false,
    });

    expect(result).toMatchObject({
      title: 'Confirmed address gate',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    });
    expect(JSON.stringify(result)).not.toMatch(/snapshot|source of truth/i);
  });

  it('keeps first-pick visible while the preferred Partner response window is active', () => {
    const result = bookingFinalGateReason({
      ...baseInput,
      bookingStatus: 'OPEN_MATCHING',
      hasPreferredPartner: true,
      preferredAwaitingDecision: true,
    });

    expect(result).toMatchObject({
      title: 'First-pick window',
      className: 'ops-task-warning',
      pillClass: 'pill-warn',
    });
    expect(result.operatorRule).toContain('customer final choice');
  });

  it('holds open matching for customer final choice when candidates are selectable', () => {
    const result = bookingFinalGateReason({
      ...baseInput,
      bookingStatus: 'OPEN_MATCHING',
      customerChoiceCandidates: 3,
      marketplaceParticipants: 2,
    });

    expect(result).toMatchObject({
      title: 'Customer final choice',
      className: 'ops-task-warning',
      pillClass: 'pill-warn',
    });
    expect(result.detail).toContain('3 Partner(s)');
    expect(result.detail).toContain('2 marketplace participant(s)');
  });

  it('blocks matched bookings when chat handoff is missing', () => {
    const result = bookingFinalGateReason({
      ...baseInput,
      bookingStatus: 'MATCHED',
      selected: true,
      hasChatRoom: false,
    });

    expect(result).toMatchObject({
      title: 'Chat handoff gate',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    });
  });

  it('marks matched bookings with chat as locked to the final Partner', () => {
    const result = bookingFinalGateReason({
      ...baseInput,
      bookingStatus: 'MATCHED',
      selected: true,
      hasChatRoom: true,
    });

    expect(result).toMatchObject({
      title: 'Final Partner locked',
      className: 'ops-task-done',
      pillClass: 'pill-success',
    });
    expect(result.operatorRule).toBe('Use the retained booking record for operations follow-up.');
  });

  it('builds admin presentation links from final gate titles', () => {
    expect(
      bookingFinalGateReasonPresentation({
        bookingId: 'booking-1',
        reason: bookingFinalGateReason({ ...baseInput, cashDebt: true }),
      }),
    ).toMatchObject({
      label: 'Wallet debt gate',
      href: '/cash-settlements',
      tone: 'pill-danger',
    });

    expect(
      bookingFinalGateReasonPresentation({
        bookingId: 'booking-2',
        reason: bookingFinalGateReason({
          ...baseInput,
          bookingStatus: 'MATCHED',
          selected: true,
          hasChatRoom: true,
        }),
      }),
    ).toMatchObject({
      label: 'Final Partner locked',
      href: '/bookings/booking-2',
      tone: 'pill-success',
    });
  });
});
