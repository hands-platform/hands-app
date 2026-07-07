import {
  bookingActionEvidenceGate,
  type BookingActionEvidenceGateInput,
} from './booking-action-evidence-gate';

const baseInput: BookingActionEvidenceGateInput = {
  bookingStatus: 'COMPLETED',
  paymentExists: true,
  paymentStatus: 'AUTHORIZED',
  paymentProviderRef: 'momo_ref_123',
  paymentMethod: 'MOMO',
  paymentIsTerminal: false,
  hasChatArchive: true,
  hasDecisionEvidence: true,
  manualOutcomeEvidenceLabel: '3 chat message(s), location 07 Jun 2026 10:31',
  refundLedgerCount: 0,
  cashDebt: false,
  closeoutAvailable: true,
  closeoutStatus: 'Ready',
  closeoutTone: 'pill-success',
  closeoutOpenItemLabels: [],
  closeoutHelper: 'All evidence is reconciled.',
  completedCloseoutLabel: 'Completed closeout needs reconciliation',
  completedCloseoutTone: 'pill-warn',
  expireAvailable: false,
  hasAddressSnapshot: true,
  expiresAtLabel: '07 Jun 2026 10:45',
  expiresAtValue: '2026-06-07T03:45:00.000Z',
  noShowAvailable: false,
};

describe('bookingActionEvidenceGate', () => {
  it('builds the action lane order used by booking operations', () => {
    const result = bookingActionEvidenceGate(baseInput);

    expect(result.rows.map((row) => row.action)).toEqual([
      'Payment sync',
      'Payment capture',
      'Release or refund',
      'Cash fee settlement',
      'Completed closeout',
      'Expire matching',
      'No-show handling',
    ]);
  });

  it('marks payment capture as evidence ready only after completed work and retained chat', () => {
    const result = bookingActionEvidenceGate(baseInput);

    expect(result.rows[1]).toMatchObject({
      action: 'Payment capture',
      status: 'Evidence ready',
      evidence: 'COMPLETED / retained chat ready / Ready',
      className: 'ops-task-done',
      pillClass: 'pill-success',
    });
    expect(result.rows[2]).toMatchObject({
      action: 'Release or refund',
      status: 'Evidence ready',
      className: 'ops-task-done',
    });
  });

  it('keeps authorized payment actions in review when decision evidence is missing', () => {
    const result = bookingActionEvidenceGate({
      ...baseInput,
      bookingStatus: 'MATCHED',
      hasChatArchive: false,
      hasDecisionEvidence: false,
      manualOutcomeEvidenceLabel: '',
      closeoutAvailable: false,
    });

    expect(result.status).toBe('2 need evidence');
    expect(result.tone).toBe('pill-warn');
    expect(result.rows[1]).toMatchObject({
      status: 'Review first',
      evidence: 'MATCHED / retained chat missing / Ready',
      className: 'ops-task-warning',
    });
    expect(result.rows[2]).toMatchObject({
      status: 'Needs evidence',
      className: 'ops-task-warning',
    });
  });

  it('blocks cash fee settlement actions when partner wallet debt is active', () => {
    const result = bookingActionEvidenceGate({
      ...baseInput,
      paymentMethod: 'CASH',
      cashDebt: true,
    });

    expect(result.rows[3]).toMatchObject({
      action: 'Cash fee settlement',
      status: 'Evidence required',
      href: '/cash-settlements',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    });
    expect(result.rows[3].operatorRule).toContain('final acceptance, service start, and payout actions wait');
  });

  it('shows matching expiry needs address when open matching has no snapshot', () => {
    const result = bookingActionEvidenceGate({
      ...baseInput,
      bookingStatus: 'OPEN_MATCHING',
      paymentExists: false,
      paymentStatus: 'NONE',
      paymentProviderRef: null,
      paymentMethod: null,
      expireAvailable: true,
      hasAddressSnapshot: false,
      noShowAvailable: true,
    });

    expect(result.rows[5]).toMatchObject({
      action: 'Expire matching',
      evidence: '07 Jun 2026 10:45',
      evidenceDateTimePrefix: 'Confirmed address missing / expires ',
      evidenceDateTimeValue: '2026-06-07T03:45:00.000Z',
      status: 'Needs address',
      className: 'ops-task-warning',
      pillClass: 'pill-warn',
    });
  });

  it('keeps terminal payment rows locked for money outcome changes', () => {
    const result = bookingActionEvidenceGate({
      ...baseInput,
      paymentStatus: 'CAPTURED',
      paymentIsTerminal: true,
      paymentProviderRef: 'momo_ref_123',
    });

    expect(result.rows[0]).toMatchObject({
      status: 'Locked',
      className: 'ops-task-blocked',
    });
    expect(result.rows[2]).toMatchObject({
      status: 'Locked',
      evidence: 'CAPTURED payment cannot be released or refunded from this state.',
    });
  });
});
