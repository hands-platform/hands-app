import {
  bookingManualDecisionReadiness,
  type BookingManualDecisionReadinessInput,
} from './booking-manual-decision-readiness';

const baseInput: BookingManualDecisionReadinessInput = {
  bookingStatus: 'MATCHED',
  closureStatus: 'Open',
  canMarkNoShow: true,
  decisionEvidenceReady: false,
  evidenceSummary: 'no chat messages / no partner pin / no alert rows / no operator notes',
  paymentExists: true,
  paymentStatus: 'AUTHORIZED',
  paymentMethod: 'MOMO',
  refundRowCount: 0,
  refundEvidence: 'No refund evidence.',
  cashFeeDebtNeedsSettlement: false,
  cashDebtEvidenceLabel: 'MOMO / AUTHORIZED',
  closeoutStatus: '2 item(s)',
  closeoutTone: 'pill-warn',
  closeoutHelper: 'Payment and tax rows should be checked.',
  closeoutOpenItemLabels: ['Payment', 'Tax'],
};

describe('bookingManualDecisionReadiness', () => {
  it('asks for factual evidence before customer-facing outcome changes', () => {
    const rows = bookingManualDecisionReadiness(baseInput);

    expect(rows[0]).toMatchObject({
      lane: 'Customer cancellation or closure',
      status: 'Needs note',
      tone: 'pill-warn',
      evidence: baseInput.evidenceSummary,
    });
    expect(rows[1]).toMatchObject({
      lane: 'No-show decision',
      status: 'Needs evidence',
      tone: 'pill-warn',
    });
  });

  it('marks no-show state as a terminal admin outcome', () => {
    const rows = bookingManualDecisionReadiness({
      ...baseInput,
      bookingStatus: 'NO_SHOW',
      closureStatus: 'No-show confirmed',
      decisionEvidenceReady: true,
    });

    expect(rows[0]).toMatchObject({
      status: 'No-show confirmed',
      tone: 'pill-danger',
    });
    expect(rows[1]).toMatchObject({
      status: 'Marked no-show',
      tone: 'pill-danger',
    });
  });

  it('surfaces refund rows before payment outcome changes', () => {
    const rows = bookingManualDecisionReadiness({
      ...baseInput,
      refundRowCount: 2,
      refundEvidence: 'PENDING 120.000 VND, APPROVED 50.000 VND',
    });

    expect(rows[2]).toMatchObject({
      lane: 'Refund or payment release',
      status: '2 refund row(s)',
      tone: 'pill-warn',
    });
  });

  it('blocks cash fee debt until settlement is confirmed', () => {
    const rows = bookingManualDecisionReadiness({
      ...baseInput,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      cashFeeDebtNeedsSettlement: true,
      cashDebtEvidenceLabel: 'Debt 80.000 VND',
    });

    expect(rows[3]).toMatchObject({
      lane: 'Cash fee settlement',
      scope:
        'Cash bookings can create partner fee debt; debt blocks final acceptance, service start, and payout release until settled.',
      status: 'Settlement required',
      tone: 'pill-danger',
      evidence: 'Debt 80.000 VND',
      operatorUse:
        'If debt exists, confirm company fee deposit or admin offset before final acceptance, service start, or payout release resumes.',
    });
  });

  it('uses closeout readiness for completed work settlement checks', () => {
    const rows = bookingManualDecisionReadiness(baseInput);

    expect(rows[4]).toMatchObject({
      lane: 'Completed work closeout',
      status: '2 item(s)',
      tone: 'pill-warn',
      evidence: 'Payment, Tax',
    });
  });
});
