import { PaymentRefundStatusProcessor } from './payment-refund-status.processor';

describe('PaymentRefundStatusProcessor', () => {
  it('completes a provider-confirmed refund recovery job', async () => {
    const payments = {
      checkAndFinalizeRefund: vi.fn().mockResolvedValue({
        completed: true,
        paymentId: 'payment-1',
        refundId: 'refund-1',
      }),
    };
    const processor = new PaymentRefundStatusProcessor(payments as never);

    await expect(processor.process({ data: { refundId: 'refund-1' } } as never)).resolves.toEqual({
      completed: true,
      paymentId: 'payment-1',
      refundId: 'refund-1',
    });
  });

  it('keeps the BullMQ job retryable while the provider is still processing', async () => {
    const payments = {
      checkAndFinalizeRefund: vi.fn().mockResolvedValue({
        completed: false,
        paymentId: 'payment-1',
        refundId: 'refund-1',
      }),
    };
    const processor = new PaymentRefundStatusProcessor(payments as never);

    await expect(processor.process({ data: { refundId: 'refund-1' } } as never)).rejects.toThrow(
      'Refund refund-1 is still processing at the payment provider',
    );
  });
});
