import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { hmacHex } from './payment-callback.helpers';
import { VnpayGatewayClient, vnpayPaymentStatus, vnpayVietnamDate } from './vnpay-gateway.client';

const now = new Date('2026-07-14T05:00:00.000Z');

describe('VnpayGatewayClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a signed checkout URL using Vietnam time and retained recovery dates', () => {
    const client = new VnpayGatewayClient(config() as never);

    const result = client.createPayment(
      { bookingId: 'booking-1', paymentId: 'payment-1', amountVnd: 120000 },
      now,
    );

    expect(result).toEqual({
      providerRef: 'booking-1',
      status: PaymentStatus.PENDING,
      rawMeta: {
        provider: 'VNPAY',
        checkoutUrl: expect.stringContaining('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?'),
        gatewayCreateDate: '20260714120000',
        gatewayExpireDate: '20260714121500',
        gatewayPaymentId: 'payment-1',
      },
    });
    expect(result.rawMeta.checkoutUrl).toContain('vnp_Amount=12000000');
    expect(result.rawMeta.checkoutUrl).toContain('vnp_SecureHash=');
  });

  it('queries and verifies a successful VNPay transaction', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(signedResponse('querydr')));
    vi.stubGlobal('fetch', fetchMock);
    const client = new VnpayGatewayClient(config() as never);

    await expect(
      client.queryPayment(
        {
          amountVnd: 120000,
          bookingId: 'booking-1',
          paymentId: 'payment-1',
          transactionDate: '20260714120000',
        },
        now,
      ),
    ).resolves.toEqual({
      status: PaymentStatus.CAPTURED,
      rawMeta: expect.objectContaining({
        gatewayOperation: 'querydr',
        gatewayResponseCode: '00',
        gatewayTransactionId: '14226112',
        gatewayTransactionStatus: '00',
        gatewayTransactionType: '01',
      }),
    });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(request).toEqual(
      expect.objectContaining({
        vnp_Command: 'querydr',
        vnp_TransactionDate: '20260714120000',
        vnp_TxnRef: 'booking-1',
        vnp_SecureHash: expect.any(String),
      }),
    );
    expect(String(request.vnp_RequestId)).toHaveLength(30);
  });

  it('rejects a forged VNPay operation response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ ...signedResponse('querydr'), vnp_SecureHash: '0'.repeat(128) }),
      ),
    );
    const client = new VnpayGatewayClient(config() as never);

    await expect(
      client.queryPayment(
        {
          amountVnd: 120000,
          bookingId: 'booking-1',
          paymentId: 'payment-1',
          transactionDate: '20260714120000',
        },
        now,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('records a signed refund response as provider accepted rather than bank completed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(signedResponse('refund', '05'))));
    const client = new VnpayGatewayClient(config() as never);

    await expect(
      client.requestRefund(
        {
          amountVnd: 120000,
          bookingId: 'booking-1',
          createBy: 'finance-admin-2',
          refundId: 'refund-1',
          transactionDate: '20260714120000',
          transactionNo: '14226112',
        },
        now,
      ),
    ).resolves.toEqual({
      accepted: true,
      providerProcessing: true,
      rawMeta: expect.objectContaining({
        gatewayOperation: 'refund',
        gatewayResponseCode: '00',
        gatewayTransactionStatus: '05',
      }),
    });
  });

  it('fails closed before network access when VNPay configuration is incomplete', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new VnpayGatewayClient({ get: vi.fn() } as never);

    expect(() =>
      client.createPayment({ bookingId: 'booking-1', paymentId: 'payment-1', amountVnd: 120000 }, now),
    ).toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['VNPAY_PAYMENT_URL', 'http://sandbox.vnpayment.vn/payment'],
    ['VNPAY_RETURN_URL', 'not-a-url'],
    ['VNPAY_API_URL', 'https://user:password@sandbox.vnpayment.vn/api'],
  ])('fails closed before network access when %s is unsafe', (key, value) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new VnpayGatewayClient(config({ [key]: value }) as never);

    expect(() =>
      client.createPayment({ bookingId: 'booking-1', paymentId: 'payment-1', amountVnd: 120000 }, now),
    ).toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('VNPay status and timezone policy', () => {
  it('formats all gateway dates in Vietnam time', () => {
    expect(vnpayVietnamDate(new Date('2026-07-14T17:30:45.000Z'))).toBe('20260715003045');
  });

  it.each([
    ['00', PaymentStatus.CAPTURED],
    ['01', PaymentStatus.PENDING],
    ['05', PaymentStatus.PENDING],
    ['06', PaymentStatus.PENDING],
    ['02', PaymentStatus.FAILED],
    ['07', PaymentStatus.FAILED],
  ])('maps VNPay transaction status %s to %s', (status, expected) => {
    expect(vnpayPaymentStatus(status)).toBe(expected);
  });
});

function config(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    VNPAY_TMN_CODE: 'DEMOV210',
    VNPAY_HASH_SECRET: 'hash-secret',
    VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    VNPAY_RETURN_URL: 'https://hands.test/payments/return',
    VNPAY_API_URL: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
    VNPAY_SERVER_IP: '203.0.113.10',
    VNPAY_HTTP_TIMEOUT_MS: '30000',
    ...overrides,
  };
  return { get: vi.fn((key: string) => values[key]) };
}

function signedResponse(command: 'querydr' | 'refund', transactionStatus = '00') {
  const body: Record<string, string> = {
    vnp_ResponseId: 'response-1',
    vnp_Command: command,
    vnp_ResponseCode: '00',
    vnp_Message: 'Success',
    vnp_TmnCode: 'DEMOV210',
    vnp_TxnRef: 'booking-1',
    vnp_Amount: '12000000',
    vnp_BankCode: 'NCB',
    vnp_PayDate: '20260714120100',
    vnp_TransactionNo: '14226112',
    vnp_TransactionType: command === 'refund' ? '02' : '01',
    vnp_TransactionStatus: transactionStatus,
    vnp_OrderInfo: command === 'refund' ? 'Refund HANDS booking booking-1' : 'Query HANDS booking booking-1',
  };
  if (command === 'querydr') {
    body.vnp_PromotionCode = '';
    body.vnp_PromotionAmount = '';
  }
  const signedFields = [
    'vnp_ResponseId',
    'vnp_Command',
    'vnp_ResponseCode',
    'vnp_Message',
    'vnp_TmnCode',
    'vnp_TxnRef',
    'vnp_Amount',
    'vnp_BankCode',
    'vnp_PayDate',
    'vnp_TransactionNo',
    'vnp_TransactionType',
    'vnp_TransactionStatus',
    'vnp_OrderInfo',
    ...(command === 'querydr' ? ['vnp_PromotionCode', 'vnp_PromotionAmount'] : []),
  ];
  body.vnp_SecureHash = hmacHex(
    'sha512',
    'hash-secret',
    signedFields.map((key) => body[key] ?? '').join('|'),
  );
  return body;
}

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
