import { bookingOperatorActionMatrix } from './booking-operator-action-matrix';

const baseInput = {
  bookingStatus: 'OPEN_MATCHING',
  paymentStatus: 'NONE',
  hasPayment: false,
  paymentIsTerminal: false,
  paymentProviderRef: null,
  paymentAmountLabel: '0 VND',
  paymentMethod: null,
  cashDebtNeedsSettlement: false,
  cashDebtAmountLabel: '0 VND',
  closeoutAvailable: false,
  closeoutLabel: 'Not ready',
  expireAvailable: true,
  expiresAtLabel: '07 Jun 2026 10:10',
  noShowAvailable: true,
  refundRowCount: 0,
  noteLineCount: 0,
};

describe('bookingOperatorActionMatrix', () => {
  it('returns the operator actions in a stable operations order', () => {
    const actions = bookingOperatorActionMatrix(baseInput);

    expect(actions.map((action) => action.action)).toEqual([
      'Payment sync',
      'Capture payment',
      'Release or refund',
      'Settle cash fee debt',
      'Reconcile completed booking',
      'Expire matching',
      'Mark no-show',
      'Add operator note',
    ]);
  });

  it('opens payment sync only when a non-terminal provider reference exists', () => {
    const [paymentSync] = bookingOperatorActionMatrix({
      ...baseInput,
      paymentStatus: 'AUTHORIZED',
      hasPayment: true,
      paymentProviderRef: 'momo-123',
    });

    expect(paymentSync).toMatchObject({
      available: true,
      status: 'Available',
      tone: 'pill-info',
      evidence: 'AUTHORIZED / provider ref momo-123',
    });
  });

  it('opens capture only for authorized non-terminal payments', () => {
    const capture = bookingOperatorActionMatrix({
      ...baseInput,
      bookingStatus: 'COMPLETED',
      paymentStatus: 'AUTHORIZED',
      hasPayment: true,
      paymentAmountLabel: '450.000 VND',
    })[1];

    expect(capture).toMatchObject({
      available: true,
      status: 'Available',
      tone: 'pill-warn',
      evidence: 'COMPLETED / 450.000 VND authorized',
    });
  });

  it('shows marketplace and payout block evidence for active cash fee debt', () => {
    const cashDebt = bookingOperatorActionMatrix({
      ...baseInput,
      paymentMethod: 'CASH',
      cashDebtNeedsSettlement: true,
      cashDebtAmountLabel: '120.000 VND',
    })[3];

    expect(cashDebt).toMatchObject({
      available: true,
      status: 'Available',
      tone: 'pill-danger',
      evidence: '120.000 VND keeps marketplace participation and payout release blocked.',
    });
  });

  it('shows refund count, expiry timer, no-show availability, and retained note count', () => {
    const actions = bookingOperatorActionMatrix({
      ...baseInput,
      hasPayment: true,
      refundRowCount: 2,
      noteLineCount: 3,
    });

    expect(actions[2].evidence).toBe('2 refund row(s) already recorded.');
    expect(actions[5]).toMatchObject({
      available: true,
      evidence: 'Open matching can be expired. Timer 07 Jun 2026 10:10.',
    });
    expect(actions[6]).toMatchObject({
      available: true,
      evidence: 'Use after communication and service movement are reviewed.',
    });
    expect(actions[7]).toMatchObject({
      available: true,
      evidence: '3 note line(s) currently retained.',
    });
  });
});
