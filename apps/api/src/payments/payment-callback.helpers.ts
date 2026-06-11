import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';

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

export function momoSignatureCandidates(body: Record<string, unknown>, accessKey?: string) {
  const material: Record<string, unknown> = { ...body };
  delete material.signature;
  if (accessKey?.trim()) {
    material.accessKey = accessKey.trim();
  }

  const sorted = sortedKeyValueString(material);
  const fixedOrder = [
    'accessKey',
    'amount',
    'extraData',
    'message',
    'orderId',
    'orderInfo',
    'orderType',
    'partnerCode',
    'payType',
    'requestId',
    'responseTime',
    'resultCode',
    'transId',
  ];
  const fixed = fixedOrder
    .filter((key) => material[key] !== undefined && material[key] !== null)
    .map((key) => `${key}=${stringValue(material[key])}`)
    .join('&');
  return Array.from(new Set([sorted, fixed].filter(Boolean)));
}

export function vnpaySignatureCandidates(body: Record<string, unknown>) {
  const material = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType'),
  );
  const raw = sortedKeyValueString(material);
  const encoded = Object.keys(material)
    .sort()
    .map((key) => `${key}=${phpUrlEncode(stringValue(material[key]))}`)
    .join('&');
  return Array.from(new Set([raw, encoded].filter(Boolean)));
}

export function sortedKeyValueString(values: Record<string, unknown>) {
  return Object.keys(values)
    .filter((key) => values[key] !== undefined && values[key] !== null)
    .sort()
    .map((key) => `${key}=${stringValue(values[key])}`)
    .join('&');
}

export function hmacHex(algorithm: 'sha256' | 'sha512', secret: string, data: string) {
  return createHmac(algorithm, secret).update(Buffer.from(data, 'utf8')).digest('hex');
}

export function secureEqualHex(expected: string, actual: string) {
  const normalizedActual = actual.toLowerCase();
  if (!/^[a-f0-9]+$/i.test(normalizedActual) || expected.length !== normalizedActual.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(normalizedActual, 'hex'));
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

function phpUrlEncode(value: string) {
  return encodeURIComponent(value).replace(/%20/g, '+');
}
