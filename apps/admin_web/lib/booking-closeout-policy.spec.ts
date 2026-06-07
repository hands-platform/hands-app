import {
  canCloseoutCompletedBooking,
  completedCloseoutLabel,
  completedCloseoutTone,
  type BookingCloseoutPolicyInput,
} from './booking-closeout-policy';

describe('booking closeout policy helpers', () => {
  it('keeps closeout unavailable before booking completion', () => {
    const booking: BookingCloseoutPolicyInput = { status: 'MATCHED' };

    expect(canCloseoutCompletedBooking(booking)).toBe(false);
    expect(completedCloseoutLabel(booking)).toBe('Closeout available after completion');
    expect(completedCloseoutTone(booking)).toBe('pill-neutral');
  });

  it('requires reconciliation when a completed booking has no captured payment', () => {
    const booking: BookingCloseoutPolicyInput = {
      status: 'COMPLETED',
      payment: { status: 'AUTHORIZED' },
    };

    expect(canCloseoutCompletedBooking(booking)).toBe(true);
    expect(completedCloseoutLabel(booking)).toBe('Completed closeout needs reconciliation');
    expect(completedCloseoutTone(booking)).toBe('pill-warn');
  });

  it('requires reconciliation when finance logs are missing after captured payment', () => {
    const booking: BookingCloseoutPolicyInput = {
      status: 'COMPLETED',
      payment: { status: 'CAPTURED' },
      earning: {
        taxLogs: [],
        platformFeeLogs: [{ id: 'fee-log' }],
        walletLedgerEntries: [{ id: 'wallet-log' }],
      },
    };

    expect(canCloseoutCompletedBooking(booking)).toBe(true);
    expect(completedCloseoutTone(booking)).toBe('pill-warn');
  });

  it('marks completed closeout healthy when payment, tax, fee, and wallet logs exist', () => {
    const booking: BookingCloseoutPolicyInput = {
      status: 'COMPLETED',
      payment: { status: 'CAPTURED' },
      earning: {
        taxLogs: [{ id: 'tax-log' }],
        platformFeeLogs: [{ id: 'fee-log' }],
        walletLedgerEntries: [{ id: 'wallet-log' }],
      },
    };

    expect(canCloseoutCompletedBooking(booking)).toBe(false);
    expect(completedCloseoutLabel(booking)).toBe('Completed closeout healthy');
    expect(completedCloseoutTone(booking)).toBe('pill-success');
  });
});
