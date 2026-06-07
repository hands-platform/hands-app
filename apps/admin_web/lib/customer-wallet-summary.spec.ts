import { customerWalletSummary } from './customer-wallet-summary';

describe('customerWalletSummary', () => {
  it('summarizes customer payment facts without creating a negative customer wallet', () => {
    const summary = customerWalletSummary([
      {
        payment: {
          status: 'CAPTURED',
          method: 'MOMO',
          amount: 300000,
          refunds: [{ id: 'refund-1', amount: 350000, status: 'PENDING' }],
        },
        refunds: [{ id: 'refund-2', amount: 50000, status: 'REQUESTED' }],
      },
      {
        payment: {
          status: 'CAPTURED',
          method: 'CASH',
          amount: 450000,
        },
      },
    ]);

    expect(summary.capturedSpend).toBe(750000);
    expect(summary.refundAmount).toBe(400000);
    expect(summary.cashBookingAmount).toBe(450000);
    expect(summary.customerBalance).toBe(0);
    expect(summary.partnerCashFeeDebtAmount).toBe(0);
    expect(summary.operatorNote).toContain('Customers never carry partner cash-fee debt');
  });

  it('counts authorized and pending payment exposure separately from captured spend', () => {
    const summary = customerWalletSummary([
      {
        payment: {
          status: 'AUTHORIZED',
          method: 'VNPAY',
          amount: 690000,
        },
      },
      {
        payment: {
          status: 'PENDING',
          method: 'MOMO',
          amount: 300000,
        },
      },
    ]);

    expect(summary.capturedSpend).toBe(0);
    expect(summary.pendingPaymentAmount).toBe(990000);
    expect(summary.customerBalance).toBe(0);
  });
});
