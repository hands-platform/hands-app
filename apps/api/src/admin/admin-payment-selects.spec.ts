import {
  adminEarningDetailSelect,
  adminEarningSummarySelect,
  adminPaymentCallbackAttemptListSelect,
  adminPaymentSummarySelect,
  adminRecentPlatformFeeLogsSelect,
  adminRefundListSelect,
  adminRefundSummarySelect,
} from './admin-payment-selects';

describe('admin payment selects', () => {
  it('keeps payment summaries refund-aware but bounded', () => {
    expect(adminPaymentSummarySelect.refunds).toMatchObject({
      take: 5,
      select: adminRefundSummarySelect,
    });
  });

  it('keeps refund and callback list rows connected to user/provider context', () => {
    expect(adminRefundListSelect.booking.select).toMatchObject({
      customerProfile: { select: { id: true, user: expect.any(Object) } },
      selectedProvider: expect.any(Object),
    });
    expect(adminPaymentCallbackAttemptListSelect.payment.select.booking.select).toMatchObject({
      customerProfile: { select: { id: true, user: expect.any(Object) } },
      selectedProvider: expect.any(Object),
    });
  });

  it('uses bounded recent financial log selectors for earning summaries and details', () => {
    expect(adminRecentPlatformFeeLogsSelect(2)).toMatchObject({
      take: 2,
      orderBy: { createdAt: 'desc' },
    });
    expect(adminEarningSummarySelect.platformFeeLogs).toMatchObject({ take: 3 });
    expect(adminEarningDetailSelect.platformFeeLogs).toMatchObject({ take: 5 });
  });
});
