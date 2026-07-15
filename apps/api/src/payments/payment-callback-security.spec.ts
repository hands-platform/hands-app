import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

import { CardPaymentAdapter, CashPaymentAdapter, MomoPaymentAdapter, VnpayPaymentAdapter } from './adapters';
import { hmacHex, momoSignatureCandidates, vnpaySignatureCandidates } from './payment-callback.helpers';
import { PaymentsService } from './payments.service';

describe('payment gateway authorization readiness', () => {
  it('keeps the internal cash authorization available without a feature flag', () => {
    const { service } = createGatewayService(PaymentMethod.MOMO, {});

    expect(service.buildAuthorization(PaymentMethod.CASH, 300000, 'booking-1')).toEqual(
      expect.objectContaining({ method: PaymentMethod.CASH, status: PaymentStatus.PENDING }),
    );
  });

  it.each([PaymentMethod.MOMO, PaymentMethod.VNPAY, PaymentMethod.CARD])(
    'rejects the %s placeholder checkout by default',
    (method) => {
      const { service } = createGatewayService(PaymentMethod.MOMO, {});

      expect(() => service.buildAuthorization(method, 300000, 'booking-1')).toThrow(
        `${method} checkout is unavailable until the real payment gateway adapter is configured`,
      );
    },
  );

  it('allows an explicit non-production placeholder checkout for local UI fixtures', () => {
    const { service } = createGatewayService(PaymentMethod.MOMO, {
      ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS: 'true',
      NODE_ENV: 'development',
    });

    expect(service.buildAuthorization(PaymentMethod.MOMO, 300000, 'booking-1')).toEqual(
      expect.objectContaining({
        method: PaymentMethod.MOMO,
        rawMeta: expect.objectContaining({
          checkoutUrl: expect.stringContaining('/payment-placeholder/momo/'),
        }),
      }),
    );
    expect(service.buildAuthorization(PaymentMethod.CARD, 300000, 'booking-2')).toEqual(
      expect.objectContaining({
        method: PaymentMethod.CARD,
        rawMeta: expect.objectContaining({
          checkoutUrl: expect.stringContaining('/payment-placeholder/card/'),
        }),
      }),
    );
  });

  it.each([PaymentMethod.MOMO, PaymentMethod.CARD])(
    'never enables %s placeholder checkout authorization in production',
    (method) => {
    const { service } = createGatewayService(PaymentMethod.MOMO, {
      ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS: 'true',
      NODE_ENV: 'production',
    });

    expect(() => service.buildAuthorization(method, 300000, 'booking-1')).toThrow(
      `${method} checkout is unavailable until the real payment gateway adapter is configured`,
    );
    },
  );
});

describe('payment gateway callback security', () => {
  it('rejects a MoMo callback without a secret by default', async () => {
    const { prisma, service } = createGatewayService(PaymentMethod.MOMO, {});

    await expect(
      service.handleCallback(PaymentMethod.MOMO, {
        amount: 300000,
        orderId: 'momo-booking-1',
        resultCode: 0,
      }),
    ).rejects.toThrow('MOMO callback secret is not configured');

    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('allows an explicitly enabled unverified local fixture callback', async () => {
    const { prisma, service } = createGatewayService(PaymentMethod.MOMO, {
      ALLOW_UNVERIFIED_PAYMENT_CALLBACKS: 'true',
      NODE_ENV: 'development',
    });

    await expect(
      service.handleCallback(PaymentMethod.MOMO, {
        amount: 300000,
        orderId: 'momo-booking-1',
        resultCode: 0,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        replay: false,
      }),
    );

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawMeta: expect.objectContaining({
            callbackSignatureVerified: false,
            callbackVerificationMode: 'dev-unverified',
          }),
        }),
      }),
    );
  });

  it('never allows the development override in production', async () => {
    const { service } = createGatewayService(PaymentMethod.VNPAY, {
      ALLOW_UNVERIFIED_PAYMENT_CALLBACKS: 'true',
      NODE_ENV: 'production',
    });

    await expect(
      service.handleCallback(PaymentMethod.VNPAY, {
        vnp_Amount: 30000000,
        vnp_ResponseCode: '00',
        vnp_TxnRef: 'vnpay-booking-1',
      }),
    ).rejects.toThrow('VNPAY callback secret is not configured');
  });

  it('accepts a correctly signed MoMo callback', async () => {
    const secret = 'momo-test-secret';
    const accessKey = 'momo-test-access';
    const payload: Record<string, unknown> = {
      amount: 300000,
      message: 'Successful.',
      orderId: 'momo-booking-1',
      partnerCode: 'HANDS_TEST',
      requestId: 'request-1',
      resultCode: 0,
      transId: 'momo-transaction-1',
    };
    payload.signature = hmacHex('sha256', secret, momoSignatureCandidates(payload, accessKey)[0]);
    const { prisma, service } = createGatewayService(PaymentMethod.MOMO, {
      MOMO_ACCESS_KEY: accessKey,
      MOMO_PARTNER_CODE: 'HANDS_TEST',
      MOMO_SECRET_KEY: secret,
      NODE_ENV: 'production',
    });

    await expect(service.handleCallback(PaymentMethod.MOMO, payload)).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    );
    expect(prisma.paymentCallbackAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        signatureVerified: true,
        verificationMode: 'momo-hmac-sha256',
      }),
    });
  });

  it('accepts a correctly signed VNPay callback', async () => {
    const secret = 'vnpay-test-secret';
    const payload: Record<string, unknown> = {
      vnp_Amount: 30000000,
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'HANDS_TEST',
      vnp_TransactionNo: 'vnpay-transaction-1',
      vnp_TxnRef: 'vnpay-booking-1',
    };
    payload.vnp_SecureHash = hmacHex('sha512', secret, vnpaySignatureCandidates(payload)[0]);
    const { prisma, service } = createGatewayService(PaymentMethod.VNPAY, {
      NODE_ENV: 'production',
      VNPAY_HASH_SECRET: secret,
      VNPAY_TMN_CODE: 'HANDS_TEST',
    });

    await expect(service.handleCallback(PaymentMethod.VNPAY, payload)).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    );
    expect(prisma.paymentCallbackAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        signatureVerified: true,
        verificationMode: 'vnpay-hmac-sha512',
      }),
    });
  });
});

function createGatewayService(method: PaymentMethod.MOMO | PaymentMethod.VNPAY, env: Record<string, string>) {
  const providerRef = method === PaymentMethod.MOMO ? 'momo-booking-1' : 'vnpay-booking-1';
  const storedPayment = {
    amount: 300000,
    bookingId: 'booking-1',
    currency: 'VND',
    id: 'payment-1',
    method,
    providerRef,
    rawMeta: {},
    status: PaymentStatus.AUTHORIZED,
  };
  const updatedPayment = { ...storedPayment, status: PaymentStatus.CAPTURED };
  const prisma = {
    payment: {
      findUnique: vi.fn().mockResolvedValue(storedPayment),
      findUniqueOrThrow: vi.fn().mockResolvedValue(updatedPayment),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    paymentCallbackAttempt: {
      create: vi.fn().mockResolvedValue({ id: 'callback-attempt-1' }),
    },
  };
  const service = new PaymentsService(
    prisma as never,
    new ConfigService(env),
    { writeAudit: vi.fn() } as never,
    { cancelForRefund: vi.fn() } as never,
    new MomoPaymentAdapter(),
    new VnpayPaymentAdapter(),
    new CardPaymentAdapter(),
    new CashPaymentAdapter(),
    { add: vi.fn() } as never,
  );

  return { prisma, service };
}
