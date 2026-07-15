import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { MomoGatewayClient } from './momo-gateway.client';

describe('MomoGatewayClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-07-14T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates a signed checkout and returns only operational response metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        partnerCode: 'partner-code',
        orderId: 'booking-1',
        requestId: 'payment-1',
        amount: 120000,
        responseTime: 1720951200000,
        message: 'Successful.',
        resultCode: 0,
        payUrl: 'https://test-payment.momo.vn/pay/booking-1',
        deeplink: 'momo://payment/booking-1',
        signature: '38cc47749bf559fdcab174dcbf9ee29d8f30567cc57d672e2e1c742de82cf639',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new MomoGatewayClient(config() as never);

    await expect(
      client.createPayment({ bookingId: 'booking-1', paymentId: 'payment-1', amountVnd: 120000 }),
    ).resolves.toEqual({
      providerRef: 'booking-1',
      status: PaymentStatus.PENDING,
      rawMeta: {
        provider: 'MOMO',
        requestId: 'payment-1',
        resultCode: 0,
        responseTime: 1720951200000,
        checkoutUrl: 'https://test-payment.momo.vn/pay/booking-1',
        deeplink: 'momo://payment/booking-1',
        qrCodeUrl: undefined,
      },
    });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(request).toEqual(
      expect.objectContaining({
        orderId: 'booking-1',
        requestId: 'payment-1',
        requestType: 'captureWallet',
        autoCapture: false,
      }),
    );
    expect(request.signature).toEqual(expect.any(String));
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }),
    );
  });

  it('rejects a create response with a forged signature', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          partnerCode: 'partner-code',
          orderId: 'booking-1',
          requestId: 'payment-1',
          amount: 120000,
          responseTime: 1720951200000,
          message: 'Successful.',
          resultCode: 0,
          payUrl: 'https://test-payment.momo.vn/pay/booking-1',
          signature: '0'.repeat(64),
        }),
      ),
    );
    const client = new MomoGatewayClient(config() as never);

    await expect(
      client.createPayment({ bookingId: 'booking-1', paymentId: 'payment-1', amountVnd: 120000 }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it.each([
    [0, PaymentStatus.CAPTURED],
    [9000, PaymentStatus.AUTHORIZED],
    [1000, PaymentStatus.PENDING],
    [7000, PaymentStatus.PENDING],
    [1001, PaymentStatus.FAILED],
  ])('maps MoMo query result code %s to %s', async (resultCode, expectedStatus) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          partnerCode: 'partner-code',
          orderId: 'booking-1',
          requestId: 'payment-1-q-1720951200000',
          resultCode,
          responseTime: 1720951200100,
          message: 'Gateway result',
          transId: 3005899645,
        }),
      ),
    );
    const client = new MomoGatewayClient(config() as never);

    await expect(client.queryPayment({ bookingId: 'booking-1', paymentId: 'payment-1' })).resolves.toEqual(
      expect.objectContaining({
        status: expectedStatus,
        rawMeta: expect.objectContaining({
          queryResultCode: resultCode,
          gatewayTransactionId: '3005899645',
        }),
      }),
    );
  });

  it.each([
    ['capture', PaymentStatus.CAPTURED],
    ['cancel', PaymentStatus.RELEASED],
  ] as const)('confirms an authorized payment with %s', async (action, expectedStatus) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          partnerCode: 'partner-code',
          orderId: 'booking-1',
          requestId: `payment-1-${action}`,
          requestType: action,
          amount: 120000,
          transId: 3005899645,
          resultCode: 0,
          message: 'Successful.',
          responseTime: 1720951200100,
        }),
      ),
    );
    const client = new MomoGatewayClient(config() as never);

    await expect(
      client.confirmPayment({ bookingId: 'booking-1', paymentId: 'payment-1', amountVnd: 120000, action }),
    ).resolves.toEqual({
      status: expectedStatus,
      rawMeta: expect.objectContaining({
        gatewayOperation: action,
        gatewayTransactionId: '3005899645',
      }),
    });
  });

  it('creates a full MoMo refund operation with its own idempotent reference', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          partnerCode: 'partner-code',
          orderId: 'refund-1',
          requestId: 'refund-1-r',
          amount: 120000,
          transId: 3005899646,
          resultCode: 0,
          message: 'Successful.',
          responseTime: 1720951200100,
        }),
      ),
    );
    const client = new MomoGatewayClient(config() as never);

    await expect(
      client.refundPayment({ refundId: 'refund-1', amountVnd: 120000, gatewayTransactionId: 3005899645 }),
    ).resolves.toEqual({
      status: PaymentStatus.REFUNDED,
      rawMeta: expect.objectContaining({
        gatewayOperation: 'refund',
        gatewayTransactionId: '3005899646',
      }),
    });
  });

  it.each([
    [0, true],
    [7002, false],
  ])('queries MoMo refund result code %s and reports finalized=%s', async (resultCode, providerFinalized) => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        partnerCode: 'partner-code',
        orderId: 'booking-1',
        requestId: 'refund-1-rq-1720951200000',
        resultCode: 0,
        message: 'Successful.',
        responseTime: 1720951200100,
        refundTrans: [
          {
            orderId: 'refund-1',
            amount: 120000,
            resultCode,
            transId: resultCode === 0 ? 3005899646 : 0,
            createdTime: 1720951200000,
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new MomoGatewayClient(config() as never);

    await expect(client.queryRefund({ refundId: 'refund-1' })).resolves.toEqual({
      status: PaymentStatus.REFUNDED,
      providerFinalized,
      rawMeta: expect.objectContaining({
        gatewayOperation: 'refund-query',
        gatewayRefundResultCode: resultCode,
      }),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://test-payment.momo.vn/v2/gateway/api/refund/query',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fails closed before network access when required configuration is absent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new MomoGatewayClient({ get: vi.fn() } as never);

    await expect(
      client.createPayment({ bookingId: 'booking-1', paymentId: 'payment-1', amountVnd: 120000 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['MOMO_BASE_URL', 'http://insecure.hands.test'],
    ['MOMO_IPN_URL', 'not-a-url'],
    ['MOMO_REDIRECT_URL', 'https://user:password@hands.test/return'],
  ])('fails closed before network access when %s is unsafe', async (key, value) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const client = new MomoGatewayClient(config({ [key]: value }) as never);

      await expect(
        client.createPayment({ bookingId: 'booking-1', paymentId: 'payment-1', amountVnd: 120000 }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
  });
});

function config(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    MOMO_PARTNER_CODE: 'partner-code',
    MOMO_ACCESS_KEY: 'access-key',
    MOMO_SECRET_KEY: 'secret-key',
    MOMO_BASE_URL: 'https://test-payment.momo.vn',
    MOMO_IPN_URL: 'https://api.hands.test/api/payments/MOMO/callback',
    MOMO_REDIRECT_URL: 'https://hands.test/payments/return',
    MOMO_HTTP_TIMEOUT_MS: '30000',
    ...overrides,
  };
  return { get: vi.fn((key: string) => values[key]) };
}

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
