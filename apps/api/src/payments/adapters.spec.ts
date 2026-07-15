import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CardPaymentAdapter, MomoPaymentAdapter, VnpayPaymentAdapter } from './adapters';

const operationInput = {
  amount: 300000,
  bookingId: 'booking-1',
  currency: 'VND',
  paymentId: 'payment-1',
  providerRef: 'booking-1',
};

describe('CardPaymentAdapter', () => {
  it('keeps card checkout local-only until a real card gateway is configured', async () => {
    const adapter = new CardPaymentAdapter();

    expect(adapter.mode).toBe('PLACEHOLDER');
    expect(
      adapter.initialAuthorization({
        amount: 300000,
        bookingId: 'booking-1',
        currency: 'VND',
        paymentId: 'payment-1',
      }),
    ).toEqual(
      expect.objectContaining({
        method: PaymentMethod.CARD,
        status: PaymentStatus.AUTHORIZED,
      }),
    );
    await expect(adapter.capture(operationInput)).resolves.toEqual({ status: PaymentStatus.CAPTURED });
    await expect(
      adapter.refund({ ...operationInput, refundId: 'refund-1' }),
    ).resolves.toEqual({
      providerFinalized: true,
      status: PaymentStatus.REFUNDED,
    });
  });
});

describe('MomoPaymentAdapter', () => {
  it('stays in placeholder mode unless the explicit gateway flag is enabled', async () => {
    const client = momoClient();
    const adapter = new MomoPaymentAdapter(client as never, config('false') as never);

    expect(adapter.mode).toBe('PLACEHOLDER');
    await expect(adapter.capture(operationInput)).resolves.toEqual({ status: PaymentStatus.CAPTURED });
    expect(client.confirmPayment).not.toHaveBeenCalled();
  });

  it('delegates the full payment lifecycle to the real client when explicitly enabled', async () => {
    const client = momoClient();
    const adapter = new MomoPaymentAdapter(client as never, config('true') as never);

    expect(adapter.mode).toBe('GATEWAY');
    expect(
      adapter.initialAuthorization({
        amount: 300000,
        bookingId: 'booking-1',
        currency: 'VND',
        paymentId: 'payment-1',
      }),
    ).toEqual({
      method: PaymentMethod.MOMO,
      providerRef: 'booking-1',
      rawMeta: { authorizationState: 'PENDING', provider: PaymentMethod.MOMO },
      status: PaymentStatus.PENDING,
    });

    await adapter.authorize({
      amount: 300000,
      bookingId: 'booking-1',
      currency: 'VND',
      paymentId: 'payment-1',
    });
    await adapter.checkStatus(operationInput);
    await adapter.capture(operationInput);
    await adapter.release(operationInput);
    await adapter.refund({
      ...operationInput,
      refundId: 'refund-1',
      gatewayTransactionId: 'momo-tx-1',
    });
    await adapter.checkRefund({ ...operationInput, refundId: 'refund-1' });

    expect(client.createPayment).toHaveBeenCalledWith({
      amountVnd: 300000,
      bookingId: 'booking-1',
      paymentId: 'payment-1',
    });
    expect(client.queryPayment).toHaveBeenCalledWith({ bookingId: 'booking-1', paymentId: 'payment-1' });
    expect(client.confirmPayment).toHaveBeenNthCalledWith(1, {
      action: 'capture',
      amountVnd: 300000,
      bookingId: 'booking-1',
      paymentId: 'payment-1',
    });
    expect(client.confirmPayment).toHaveBeenNthCalledWith(2, {
      action: 'cancel',
      amountVnd: 300000,
      bookingId: 'booking-1',
      paymentId: 'payment-1',
    });
    expect(client.refundPayment).toHaveBeenCalledWith({
      amountVnd: 300000,
      gatewayTransactionId: 'momo-tx-1',
      refundId: 'refund-1',
    });
    expect(client.queryRefund).toHaveBeenCalledWith({ refundId: 'refund-1' });
  });

  it('rejects a real refund when no gateway transaction id was retained', async () => {
    const adapter = new MomoPaymentAdapter(momoClient() as never, config('true') as never);

    await expect(adapter.refund({ ...operationInput, refundId: 'refund-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('VnpayPaymentAdapter', () => {
  it('stays in placeholder mode unless the explicit gateway flag is enabled', async () => {
    const client = vnpayClient();
    const adapter = new VnpayPaymentAdapter(client as never, vnpayConfig('false') as never);

    expect(adapter.mode).toBe('PLACEHOLDER');
    await expect(adapter.checkStatus(operationInput)).resolves.toEqual({
      status: PaymentStatus.AUTHORIZED,
    });
    expect(client.queryPayment).not.toHaveBeenCalled();
  });

  it('creates checkout and requires provider capture before reporting capture', async () => {
    const client = vnpayClient();
    const adapter = new VnpayPaymentAdapter(client as never, vnpayConfig('true') as never);
    const input = {
      ...operationInput,
      rawMeta: { gatewayCreateDate: '20260714120000' },
    };

    expect(adapter.mode).toBe('GATEWAY');
    await expect(
      adapter.authorize({
        amount: 300000,
        bookingId: 'booking-1',
        currency: 'VND',
        paymentId: 'payment-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({ method: PaymentMethod.VNPAY, status: PaymentStatus.PENDING }),
    );
    await expect(adapter.capture(input)).resolves.toEqual(
      expect.objectContaining({ status: PaymentStatus.CAPTURED }),
    );
    expect(client.queryPayment).toHaveBeenCalledWith({
      amountVnd: 300000,
      bookingId: 'booking-1',
      paymentId: 'payment-1',
      transactionDate: '20260714120000',
    });
  });

  it('uses transaction status rather than response code for callbacks', () => {
    const adapter = new VnpayPaymentAdapter(vnpayClient() as never, vnpayConfig('true') as never);

    expect(
      adapter.parseCallback({
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '05',
        vnp_TransactionNo: 'vnp-tx-1',
        vnp_TxnRef: 'booking-1',
      }),
    ).toEqual(
      expect.objectContaining({ providerRef: 'booking-1', status: PaymentStatus.PENDING }),
    );
    expect(
      adapter.parseCallback({
        vnp_ResponseCode: '24',
        vnp_TransactionStatus: '00',
        vnp_TxnRef: 'booking-1',
      }).status,
    ).toBe(PaymentStatus.FAILED);
  });

  it('keeps accepted refunds provider-processing until query reports a completed refund type', async () => {
    const client = vnpayClient();
    client.queryPayment.mockResolvedValueOnce({
      status: PaymentStatus.CAPTURED,
      rawMeta: { gatewayTransactionStatus: '00', gatewayTransactionType: '02' },
    });
    const adapter = new VnpayPaymentAdapter(client as never, vnpayConfig('true') as never);
    const input = {
      ...operationInput,
      gatewayTransactionId: 'vnp-tx-1',
      rawMeta: { gatewayCreateDate: '20260714120000' },
      refundId: 'refund-1',
      requestedBy: 'finance-admin-1',
    };

    await expect(adapter.refund(input)).resolves.toEqual({
      status: PaymentStatus.REFUNDED,
      providerFinalized: false,
      rawMeta: expect.objectContaining({ gatewayTransactionStatus: '05' }),
    });
    await expect(adapter.checkRefund(input)).resolves.toEqual({
      status: PaymentStatus.REFUNDED,
      providerFinalized: true,
      rawMeta: expect.objectContaining({ gatewayTransactionType: '02' }),
    });
    expect(client.requestRefund).toHaveBeenCalledWith({
      amountVnd: 300000,
      bookingId: 'booking-1',
      createBy: 'finance-admin-1',
      refundId: 'refund-1',
      transactionDate: '20260714120000',
      transactionNo: 'vnp-tx-1',
    });
  });

  it('does not finalize an original payment query as a refund', async () => {
    const client = vnpayClient();
    client.queryPayment.mockResolvedValueOnce({
      status: PaymentStatus.CAPTURED,
      rawMeta: { gatewayTransactionStatus: '00', gatewayTransactionType: '01' },
    });
    const adapter = new VnpayPaymentAdapter(client as never, vnpayConfig('true') as never);

    await expect(
      adapter.checkRefund({
        ...operationInput,
        rawMeta: { gatewayCreateDate: '20260714120000' },
        refundId: 'refund-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({ providerFinalized: false, status: PaymentStatus.REFUNDED }),
    );
  });
});

function config(enabled: string) {
  return {
    get: vi.fn((key: string) => (key === 'MOMO_GATEWAY_ENABLED' ? enabled : undefined)),
  };
}

function vnpayConfig(enabled: string) {
  return {
    get: vi.fn((key: string) => (key === 'VNPAY_GATEWAY_ENABLED' ? enabled : undefined)),
  };
}

function momoClient() {
  return {
    createPayment: vi.fn().mockResolvedValue({
      providerRef: 'booking-1',
      rawMeta: { checkoutUrl: 'https://momo.example.test/checkout' },
      status: PaymentStatus.PENDING,
    }),
    queryPayment: vi.fn().mockResolvedValue({ status: PaymentStatus.AUTHORIZED }),
    confirmPayment: vi
      .fn()
      .mockResolvedValueOnce({ status: PaymentStatus.CAPTURED })
      .mockResolvedValueOnce({ status: PaymentStatus.RELEASED }),
    refundPayment: vi.fn().mockResolvedValue({ status: PaymentStatus.REFUNDED }),
    queryRefund: vi.fn().mockResolvedValue({
      status: PaymentStatus.REFUNDED,
      providerFinalized: true,
    }),
  };
}

function vnpayClient() {
  return {
    createPayment: vi.fn().mockReturnValue({
      providerRef: 'booking-1',
      rawMeta: {
        checkoutUrl: 'https://sandbox.vnpayment.vn/checkout',
        gatewayCreateDate: '20260714120000',
      },
      status: PaymentStatus.PENDING,
    }),
    queryPayment: vi.fn().mockResolvedValue({
      status: PaymentStatus.CAPTURED,
      rawMeta: { gatewayTransactionStatus: '00', gatewayTransactionType: '01' },
    }),
    requestRefund: vi.fn().mockResolvedValue({
      accepted: true,
      providerProcessing: true,
      rawMeta: { gatewayTransactionStatus: '05', gatewayTransactionType: '02' },
    }),
  };
}
