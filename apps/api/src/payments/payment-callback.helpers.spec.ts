import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  asJsonObject,
  callbackAmountVnd,
  callbackAttemptCreateData,
  callbackAttemptEvidence,
  callbackFailureOutcome,
  callbackProviderRef,
  callbackRawMeta,
  errorCode,
  errorMessage,
  hmacHex,
  isTerminalPaymentStatus,
  momoSignatureCandidates,
  secureEqualHex,
  sortedKeyValueString,
  stringValue,
  toJsonOrUndefined,
  vnpaySignatureCandidates,
} from './payment-callback.helpers';

describe('payment callback helpers', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds callback raw metadata with verification details', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-11T00:00:00.000Z'));

    expect(callbackRawMeta({ providerRef: 'momo-booking-1' }, { verified: true, mode: 'momo-hmac' })).toEqual({
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
        rawPayload: { recordedAt: new Date('2026-06-11T00:00:00.000Z') },
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
      rawPayload: { recordedAt: '2026-06-11T00:00:00.000Z' },
      signatureVerified: undefined,
      verificationMode: undefined,
    });
  });

  it('classifies callback errors for audit evidence', () => {
    expect(errorCode(new BadRequestException('bad'))).toBe('BAD_REQUEST');
    expect(errorCode(new ConflictException('conflict'))).toBe('CONFLICT');
    expect(errorCode(new Error('unknown'))).toBe('CALLBACK_ERROR');

    expect(callbackFailureOutcome(new ConflictException('conflict'))).toBe('CONFLICT');
    expect(callbackFailureOutcome(new BadRequestException('bad'))).toBe('REJECTED');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('boom')).toBe('Payment callback processing failed');
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
