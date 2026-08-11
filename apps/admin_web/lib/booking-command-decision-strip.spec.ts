import {
  bookingCommandDecisionStrip,
  type BookingCommandDecisionStripInput,
} from './booking-command-decision-strip';

const baseInput: BookingCommandDecisionStripInput = {
  bookingStatus: 'OPEN_MATCHING',
  hasAddressSnapshot: true,
  addressLabel: 'District 1, Ho Chi Minh City',
  participantCount: 0,
  customerChoiceCandidateCount: 0,
  expiredCustomerChoiceCandidateCount: 0,
  marketplaceEligibleCount: 2,
  hasFinalPartner: false,
  hasChatRoom: false,
  messageCount: 0,
  paymentMethod: 'MOMO',
  paymentStatus: 'AUTHORIZED',
  cashDebtNeedsSettlement: false,
  closeoutOpenItemCount: 0,
  matchingDeadlineAt: '2026-08-05T12:10:00.000Z',
  matchingDeadlineExpired: false,
};

describe('bookingCommandDecisionStrip', () => {
  it('puts address confirmation first when the booking address snapshot is missing', () => {
    const strip = bookingCommandDecisionStrip({
      ...baseInput,
      hasAddressSnapshot: false,
      addressLabel: 'No confirmed service address',
    });

    expect(strip.status).toBe('Address check');
    expect(strip.primaryAction).toBe('Confirm service address');
    expect(strip.rows[0]).toMatchObject({
      lane: 'Address',
      state: 'Missing snapshot',
      href: '#customer',
      tone: 'pill-danger',
    });
  });

  it('prioritizes customer final choice when selectable marketplace participants exist', () => {
    const strip = bookingCommandDecisionStrip({
      ...baseInput,
      participantCount: 3,
      customerChoiceCandidateCount: 2,
    });

    expect(strip.primaryAction).toBe('Keep customer final choice visible');
    expect(strip.primaryHref).toBe('#participants');
    expect(strip.rows.find((row) => row.lane === 'Matching')).toMatchObject({
      state: 'Customer choice',
      detail:
        '2 customer-selectable Partner(s) / 3 actual participant row(s). Choice closes 5 Aug 2026, 19:10.',
    });
  });

  it('moves an accepted response out of customer choice after the API matching deadline', () => {
    const strip = bookingCommandDecisionStrip({
      ...baseInput,
      customerChoiceCandidateCount: 0,
      expiredCustomerChoiceCandidateCount: 1,
      matchingDeadlineExpired: true,
    });

    expect(strip.primaryAction).toBe('Review matching expiry impact');
    expect(strip.primaryHref).toBe('#matching-expiry');
    expect(strip.rows.find((row) => row.lane === 'Matching')).toMatchObject({
      state: 'Responses expired',
      tone: 'pill-warn',
    });
  });

  it('prioritizes chat repair for matched bookings without retained chat', () => {
    const strip = bookingCommandDecisionStrip({
      ...baseInput,
      bookingStatus: 'MATCHED',
      hasFinalPartner: true,
      hasChatRoom: false,
    });

    expect(strip.status).toBe('Handoff repair');
    expect(strip.primaryAction).toBe('Repair chat handoff');
    expect(strip.rows.find((row) => row.lane === 'Chat')).toMatchObject({
      state: 'Missing',
      href: '#chat-repair',
      tone: 'pill-danger',
    });
  });

  it('explains that Partner cash debt blocks final acceptance and service start', () => {
    const strip = bookingCommandDecisionStrip({
      ...baseInput,
      bookingStatus: 'COMPLETED',
      hasFinalPartner: true,
      hasChatRoom: true,
      messageCount: 4,
      cashDebtNeedsSettlement: true,
      paymentMethod: 'CASH',
      paymentStatus: 'CAPTURED',
    });

    expect(strip.primaryAction).toBe('Settle Partner cash fee debt');
    expect(strip.rows.find((row) => row.lane === 'Finance')).toMatchObject({
      state: 'Settlement required',
      detail:
        'Partner wallet debt blocks final acceptance, service start, and payout release until settled.',
      href: '#finance',
    });
  });

  it('falls back to monitoring when the booking has no immediate command issue', () => {
    const strip = bookingCommandDecisionStrip({
      ...baseInput,
      bookingStatus: 'COMPLETED',
      hasFinalPartner: true,
      hasChatRoom: true,
      messageCount: 3,
      paymentStatus: 'CAPTURED',
    });

    expect(strip.status).toBe('Monitoring');
    expect(strip.tone).toBe('pill-success');
    expect(strip.primaryAction).toBe('Continue normal monitoring');
  });

  it('prioritizes closeout review when factual closeout items remain open', () => {
    const strip = bookingCommandDecisionStrip({
      ...baseInput,
      bookingStatus: 'NO_SHOW',
      paymentStatus: 'AUTHORIZED',
      closeoutOpenItemCount: 3,
    });

    expect(strip.status).toBe('Closeout review');
    expect(strip.primaryAction).toBe('Review open closeout items');
    expect(strip.primaryDetail).toBe('3 closeout item(s) still need factual review.');
  });
});
