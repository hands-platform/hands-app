import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';

export function callbackRawMeta(
  rawMeta: Record<string, unknown>,
  verification: { verified: boolean; mode: string },
) {
  return {
    ...rawMeta,
    callbackReceivedAt: new Date().toISOString(),
    callbackSignatureVerified: verification.verified,
    callbackVerificationMode: verification.mode,
  };
}

export function callbackAttemptEvidence(method: PaymentMethod, body: Record<string, unknown>) {
  return {
    method,
    providerRef: callbackProviderRef(body),
    providerStatus:
      stringValueOrNull(body.status) ??
      stringValueOrNull(body.resultCode) ??
      stringValueOrNull(body.vnp_ResponseCode) ??
      stringValueOrNull(body.message),
    gatewayTransactionId:
      stringValueOrNull(body.transId) ??
      stringValueOrNull(body.transactionId) ??
      stringValueOrNull(body.vnp_TransactionNo) ??
      stringValueOrNull(body.vnp_TxnRef),
    callbackAmount: callbackAmountVnd(method, body),
  };
}

export function callbackAmountVnd(method: PaymentMethod, body: Record<string, unknown>) {
  if (method === PaymentMethod.MOMO && body.amount !== undefined) {
    return numberValue(body.amount);
  }
  if (method === PaymentMethod.VNPAY && body.vnp_Amount !== undefined) {
    const rawAmount = numberValue(body.vnp_Amount);
    return rawAmount === null ? null : Math.round(rawAmount / 100);
  }
  return null;
}

export function callbackProviderRef(body: Record<string, unknown>) {
  return (
    stringValueOrNull(body.providerRef) ??
    stringValueOrNull(body.orderId) ??
    stringValueOrNull(body.vnp_TxnRef)
  );
}

export function errorCode(error: unknown) {
  if (error instanceof BadRequestException) {
    return 'BAD_REQUEST';
  }
  if (error instanceof ConflictException) {
    return 'CONFLICT';
  }
  return 'CALLBACK_ERROR';
}

export function callbackFailureOutcome(error: unknown) {
  return error instanceof ConflictException ? 'CONFLICT' : 'REJECTED';
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Payment callback processing failed';
}

export function stringValue(value: unknown) {
  return value === undefined || value === null ? '' : String(value);
}

function stringValueOrNull(value: unknown) {
  const valueString = stringValue(value);
  return valueString ? valueString : null;
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}
