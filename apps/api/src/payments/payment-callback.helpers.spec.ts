import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  asJsonObject,
  callbackAmountVnd,
  callbackAttemptCreateData,
  callbackAttemptEvidence,
  callbackEvidenceErrorMessage,
  callbackFailureOutcome,
  callbackProviderRef,
  callbackRawMeta,
  errorCode,
  errorMessage,
  hmacHex,
  isTerminalPaymentStatus,
  momoSignatureCandidates,
  paymentCallbackEvidencePayload,
  redactPaymentCallbackPayload,
  secureEqualHex,
  sortedKeyValueString,
  stringValue,
  toJsonOrUndefined,
  vnpaySignatureCandidates,
} from './payment-callback.helpers';

describe('payment callback helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds callback raw metadata with verification details', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-11T00:00:00.000Z'));

    expect(
      callbackRawMeta(
        { providerRef: 'momo-booking-1', signature: 'gateway-signature' },
        { verified: true, mode: 'momo-hmac' },
      ),
    ).toEqual({
      providerRef: 'momo-booking-1',
      callbackReceivedAt: '2026-06-11T00:00:00.000Z',
      callbackSignatureVerified: true,
      callbackVerificationMode: 'momo-hmac',
    });
  });

  it('normalizes provider references and callback amounts by method', () => {
    expect(callbackProviderRef({ providerRef: 'cash-booking-1' })).toBe('cash-booking-1');
    expect(callbackProviderRef({ orderId: 'momo-booking-1' })).toBe('momo-booking-1');
    expect(callbackProviderRef({ vnp_TxnRef: 'vnpay-booking-1' })).toBe('vnpay-booking-1');

    expect(callbackAmountVnd(PaymentMethod.MOMO, { amount: '300000' })).toBe(300000);
    expect(callbackAmountVnd(PaymentMethod.VNPAY, { vnp_Amount: '30000000' })).toBe(300000);
    expect(callbackAmountVnd(PaymentMethod.CASH, { amount: '300000' })).toBeNull();
  });

  it('identifies terminal payment statuses and serializes JSON payloads', () => {
    expect(isTerminalPaymentStatus(PaymentStatus.CAPTURED)).toBe(true);
    expect(isTerminalPaymentStatus(PaymentStatus.REFUNDED)).toBe(true);
    expect(isTerminalPaymentStatus(PaymentStatus.RELEASED)).toBe(true);
    expect(isTerminalPaymentStatus(PaymentStatus.AUTHORIZED)).toBe(false);

    expect(toJsonOrUndefined(undefined)).toBeUndefined();
    expect(toJsonOrUndefined({ recordedAt: new Date('2026-06-11T00:00:00.000Z') })).toEqual({
      recordedAt: '2026-06-11T00:00:00.000Z',
    });
    expect(asJsonObject({ ok: true })).toEqual({ ok: true });
    expect(asJsonObject(null)).toEqual({});
    expect(asJsonObject(['nope'])).toEqual({});
  });

  it('builds callback attempt evidence from gateway payloads', () => {
    expect(
      callbackAttemptEvidence(PaymentMethod.VNPAY, {
        vnp_Amount: '30000000',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'gateway-1',
        vnp_TxnRef: 'booking-1',
      }),
    ).toEqual({
      method: PaymentMethod.VNPAY,
      providerRef: 'booking-1',
      providerStatus: '00',
      gatewayTransactionId: 'gateway-1',
      callbackAmount: 300000,
    });
  });

  it('builds callback attempt create data with Prisma-friendly optional fields', () => {
    expect(
      callbackAttemptCreateData({
        method: PaymentMethod.CASH,
        outcome: 'REJECTED',
        paymentId: null,
        providerRef: '',
        providerStatus: null,
        rawPayload: {
          recordedAt: new Date('2026-06-11T00:00:00.000Z'),
          vnp_SecureHash: 'gateway-secure-hash',
        },
        signatureVerified: null,
      }),
    ).toEqual({
      method: PaymentMethod.CASH,
      outcome: 'REJECTED',
      paymentId: undefined,
      providerRef: undefined,
      providerStatus: undefined,
      gatewayTransactionId: undefined,
      callbackAmount: undefined,
      errorCode: undefined,
      errorMessage: undefined,
      rawPayload: {
      },
      signatureVerified: undefined,
      verificationMode: undefined,
    });
  });

  it('persists only allowlisted callback evidence fields', () => {
    expect(
      paymentCallbackEvidencePayload({
        amount: '300000',
        customerEmail: 'customer@example.com',
        extraData: 'opaque-provider-data',
        orderId: 'booking-1',
        orderInfo: 'Customer booking details',
        signature: 'gateway-signature',
        transId: 'transaction-1',
      }),
    ).toEqual({
      amount: '300000',
      orderId: 'booking-1',
      transId: 'transaction-1',
    });
  });

  it('redacts callback payload signing material recursively without removing evidence', () => {
    expect(
      redactPaymentCallbackPayload({
        amount: '300000',
        api_secret: 'api-secret',
        orderId: 'booking-1',
        signature: 'momo-signature',
        nested: {
          accessKey: 'access-key',
          providerRef: 'provider-ref-1',
          vnp_SecureHashType: 'sha512',
        },
        attempts: [{ secure_hash: 'nested-hash', status: '00' }],
      }),
    ).toEqual({
      amount: '300000',
      api_secret: '[REDACTED]',
      orderId: 'booking-1',
      signature: '[REDACTED]',
      nested: {
        accessKey: '[REDACTED]',
        providerRef: 'provider-ref-1',
        vnp_SecureHashType: '[REDACTED]',
      },
      attempts: [{ secure_hash: '[REDACTED]', status: '00' }],
    });
  });

  it('bounds untrusted callback evidence before persistence', () => {
    const keys = Object.fromEntries(Array.from({ length: 45 }, (_, index) => [`key${index}`, index]));
    const result = redactPaymentCallbackPayload({
      ...keys,
      longValue: 'x'.repeat(700),
      nested: { one: { two: { three: { four: { five: 'too-deep' } } } } },
      values: Array.from({ length: 25 }, (_, index) => index),
    });

    expect(Object.keys(result)).toHaveLength(40);
    expect(result.key39).toBe(39);
    expect(result.key40).toBeUndefined();

    const bounded = redactPaymentCallbackPayload({
      longValue: 'x'.repeat(700),
      nested: { one: { two: { three: { four: { five: 'too-deep' } } } } },
      values: Array.from({ length: 25 }, (_, index) => index),
    });
    expect(String(bounded.longValue)).toHaveLength(523);
    expect(bounded.values).toEqual(Array.from({ length: 20 }, (_, index) => index));
    expect(bounded.nested).toEqual({ one: { two: { three: { four: '[TRUNCATED]' } } } });
  });

  it('classifies callback errors for audit evidence', () => {
    expect(errorCode(new BadRequestException('bad'))).toBe('BAD_REQUEST');
    expect(errorCode(new ConflictException('conflict'))).toBe('CONFLICT');
    expect(errorCode(new Error('unknown'))).toBe('CALLBACK_ERROR');

    expect(callbackFailureOutcome(new ConflictException('conflict'))).toBe('CONFLICT');
    expect(callbackFailureOutcome(new BadRequestException('bad'))).toBe('REJECTED');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('boom')).toBe('Payment callback processing failed');
    expect(callbackEvidenceErrorMessage(new BadRequestException('Invalid MoMo callback signature'))).toBe(
      'Payment callback authentication rejected',
    );
    expect(
      callbackEvidenceErrorMessage(
        new Error('postgres://operator:secret@database.internal/payment-callbacks'),
      ),
    ).toBe('Payment callback processing failed');
    expect(callbackEvidenceErrorMessage(new ConflictException('private state details'))).toBe(
      'Payment callback conflicts with the current payment state',
    );
    expect(stringValue(null)).toBe('');
  });

  it('builds deterministic signature material candidates', () => {
    expect(
      momoSignatureCandidates(
        {
          amount: 300000,
          orderId: 'booking-1',
          signature: 'ignored',
          requestId: 'request-1',
        },
        'access-key',
      ),
    ).toEqual([
      'accessKey=access-key&amount=300000&orderId=booking-1&requestId=request-1',
    ]);

    expect(
      vnpaySignatureCandidates({
        vnp_Amount: '30000000',
        vnp_OrderInfo: 'Booking 1',
        vnp_SecureHash: 'ignored',
        vnp_TxnRef: 'booking-1',
      }),
    ).toEqual([
      'vnp_Amount=30000000&vnp_OrderInfo=Booking 1&vnp_TxnRef=booking-1',
      'vnp_Amount=30000000&vnp_OrderInfo=Booking+1&vnp_TxnRef=booking-1',
    ]);

    expect(sortedKeyValueString({ b: 2, a: 1, c: null })).toBe('a=1&b=2');
  });

  it('compares callback signatures without leaking timing for valid hex values', () => {
    const digest = hmacHex('sha256', 'secret', 'payload');

    expect(secureEqualHex(digest, digest.toUpperCase())).toBe(true);
    expect(secureEqualHex(digest, 'not-hex')).toBe(false);
    expect(secureEqualHex(digest, digest.slice(0, -2))).toBe(false);
  });
});
