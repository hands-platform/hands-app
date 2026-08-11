import {
  adminEarningDetailSelect,
  adminEarningSummarySelect,
  adminPaymentCallbackAttemptSummarySelect,
  adminPaymentCallbackAttemptListSelect,
  adminPaymentEvidenceSelect,
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
    expect(adminPaymentSummarySelect).not.toHaveProperty('rawMeta');
    expect(adminPaymentEvidenceSelect).toHaveProperty('rawMeta', true);
  });

  it('keeps refund and callback list rows connected to user/provider context', () => {
    expect(adminRefundSummarySelect).toMatchObject({
      currency: true,
      metadata: true,
    });
    expect(adminRefundListSelect.booking.select).toMatchObject({
      customerProfile: { select: { id: true, user: expect.any(Object) } },
      selectedProvider: expect.any(Object),
    });
    expect(adminRefundListSelect.payment.select.callbackAttempts).toMatchObject({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        createdAt: true,
        errorCode: true,
        errorMessage: true,
        gatewayTransactionId: true,
        outcome: true,
        providerStatus: true,
        signatureVerified: true,
      },
    });
    expect(adminPaymentCallbackAttemptListSelect.payment.select.booking.select).toMatchObject({
      customerProfile: { select: { id: true, user: expect.any(Object) } },
      selectedProvider: expect.any(Object),
    });
  });

  it('keeps payment callback raw payloads out of summary and list queries', () => {
    expect(adminPaymentCallbackAttemptSummarySelect).not.toHaveProperty('rawPayload');
    expect(adminPaymentCallbackAttemptListSelect).not.toHaveProperty('rawPayload');
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
