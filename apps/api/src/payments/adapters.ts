import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PaymentAdapter, PaymentAuthorization, PaymentCallbackResult } from './payment-adapter';

abstract class PlaceholderRedirectAdapter implements PaymentAdapter {
  abstract readonly method: PaymentMethod;

  authorize(input: { bookingId: string; amount: number; currency: string }): PaymentAuthorization {
    const providerRef = `${this.method.toLowerCase()}-${input.bookingId}-${Date.now()}`;
    return {
      method: this.method,
      status: PaymentStatus.AUTHORIZED,
      providerRef,
      rawMeta: {
        provider: this.method,
        amount: input.amount,
        currency: input.currency,
        checkoutUrl: `/payment-placeholder/${this.method.toLowerCase()}/${providerRef}`,
      },
    };
  }

  parseCallback(payload: unknown): PaymentCallbackResult {
    const body = isRecord(payload) ? payload : {};
    return {
      providerRef: String(body.providerRef ?? body.orderId ?? body.vnp_TxnRef ?? ''),
      status: normalizeStatus(body.status ?? body.resultCode ?? body.vnp_ResponseCode),
      rawMeta: body,
    };
  }

  checkStatus(providerRef: string) {
    void providerRef;
    return PaymentStatus.AUTHORIZED;
  }

  release(providerRef: string | null) {
    void providerRef;
    return PaymentStatus.RELEASED;
  }
}

export class MomoPaymentAdapter extends PlaceholderRedirectAdapter {
  readonly method = PaymentMethod.MOMO;
}

export class VnpayPaymentAdapter extends PlaceholderRedirectAdapter {
  readonly method = PaymentMethod.VNPAY;
}

export class CashPaymentAdapter implements PaymentAdapter {
  readonly method = PaymentMethod.CASH;

  authorize(): PaymentAuthorization {
    return {
      method: PaymentMethod.CASH,
      status: PaymentStatus.PENDING,
      providerRef: null,
      rawMeta: { provider: 'CASH' },
    };
  }

  parseCallback(payload: unknown): PaymentCallbackResult {
    return {
      providerRef: isRecord(payload) ? String(payload.providerRef ?? '') : '',
      status: PaymentStatus.CAPTURED,
      rawMeta: isRecord(payload) ? payload : {},
    };
  }

  checkStatus() {
    return PaymentStatus.PENDING;
  }

  release() {
    return PaymentStatus.RELEASED;
  }
}

function normalizeStatus(value: unknown) {
  if (value === 'CAPTURED' || value === 'SUCCESS' || value === '00' || value === '0' || value === 0) {
    return PaymentStatus.CAPTURED;
  }
  if (value === 'FAILED') {
    return PaymentStatus.FAILED;
  }
  if (value === 'REFUNDED') {
    return PaymentStatus.REFUNDED;
  }
  return PaymentStatus.AUTHORIZED;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
