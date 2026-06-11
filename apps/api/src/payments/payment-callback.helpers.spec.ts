import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import {
  callbackAmountVnd,
  callbackAttemptEvidence,
  callbackFailureOutcome,
  callbackProviderRef,
  callbackRawMeta,
  errorCode,
  errorMessage,
  stringValue,
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
});
