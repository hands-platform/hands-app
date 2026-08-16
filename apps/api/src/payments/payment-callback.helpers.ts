import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';

const TERMINAL_PAYMENT_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.CAPTURED,
  PaymentStatus.REFUNDED,
  PaymentStatus.RELEASED,
]);
const REDACTED_PAYMENT_CALLBACK_VALUE = '[REDACTED]';
const TRUNCATED_PAYMENT_CALLBACK_VALUE = '[TRUNCATED]';
const PAYMENT_CALLBACK_MAX_ARRAY_ITEMS = 20;
const PAYMENT_CALLBACK_MAX_DEPTH = 4;
const PAYMENT_CALLBACK_MAX_KEYS = 40;
const PAYMENT_CALLBACK_MAX_STRING_LENGTH = 512;
const REDACTED_PAYMENT_CALLBACK_KEYS = new Set([
  'accesskey',
  'apikey',
  'apisecret',
  'secret',
  'securehash',
  'securehashtype',
  'signature',
  'vnpsecurehash',
  'vnpsecurehashtype',
]);
const PAYMENT_CALLBACK_EVIDENCE_KEYS = new Set([
  'amount',
  'gatewayPayDate',
  'gatewayTransactionId',
  'gatewayTransactionStatus',
  'gatewayTransactionType',
  'message',
  'orderId',
  'partnerCode',
  'payType',
  'providerRef',
  'requestId',
  'responseTime',
  'resultCode',
  'status',
  'transId',
  'vnp_Amount',
  'vnp_BankCode',
  'vnp_CardType',
  'vnp_PayDate',
  'vnp_ResponseCode',
  'vnp_TmnCode',
  'vnp_TransactionNo',
  'vnp_TransactionStatus',
  'vnp_TransactionType',
  'vnp_TxnRef',
]);

export function callbackRawMeta(
  rawMeta: Record<string, unknown>,
  verification: { verified: boolean; mode: string },
) {
  return {
    ...paymentCallbackEvidencePayload(rawMeta),
    callbackReceivedAt: new Date().toISOString(),
    callbackSignatureVerified: verification.verified,
    callbackVerificationMode: verification.mode,
  };
}

export function isTerminalPaymentStatus(status: PaymentStatus) {
  return TERMINAL_PAYMENT_STATUSES.has(status);
}

export function toJsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function asJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
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

export type PaymentCallbackAttemptInput = {
  paymentId?: string | null;
  method: PaymentMethod;
  providerRef?: string | null;
  outcome: string;
  signatureVerified?: boolean | null;
  verificationMode?: string | null;
  providerStatus?: string | null;
  gatewayTransactionId?: string | null;
  callbackAmount?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  rawPayload?: Record<string, unknown>;
};

export function callbackAttemptCreateData(input: PaymentCallbackAttemptInput) {
  return {
    paymentId: input.paymentId ?? undefined,
    method: input.method,
    providerRef: input.providerRef || undefined,
    outcome: input.outcome,
    signatureVerified: input.signatureVerified ?? undefined,
    verificationMode: input.verificationMode ?? undefined,
    providerStatus: input.providerStatus ?? undefined,
    gatewayTransactionId: input.gatewayTransactionId ?? undefined,
    callbackAmount: input.callbackAmount ?? undefined,
    errorCode: input.errorCode ?? undefined,
    errorMessage: input.errorMessage ?? undefined,
    rawPayload: toJsonOrUndefined(paymentCallbackEvidencePayload(input.rawPayload ?? {})),
  };
}

export function paymentCallbackEvidencePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return redactPaymentCallbackPayload(
    Object.fromEntries(
      Object.entries(payload).filter(([key]) => PAYMENT_CALLBACK_EVIDENCE_KEYS.has(key)),
    ),
  );
}

export function redactPaymentCallbackPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).slice(0, PAYMENT_CALLBACK_MAX_KEYS).map(([key, value]) => [
      key,
      isRedactedPaymentCallbackKey(key)
        ? REDACTED_PAYMENT_CALLBACK_VALUE
        : redactPaymentCallbackValue(value, 1),
    ]),
  );
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

export function callbackEvidenceErrorMessage(error: unknown) {
  if (error instanceof ConflictException) {
    return 'Payment callback conflicts with the current payment state';
  }
  if (!(error instanceof BadRequestException)) {
    return 'Payment callback processing failed';
  }

  const message = error.message.toLowerCase();
  if (message.includes('signature') || message.includes('secure hash') || message.includes('secret')) {
    return 'Payment callback authentication rejected';
  }
  if (message.includes('amount')) {
    return 'Payment callback amount rejected';
  }
  if (message.includes('provider reference')) {
    return 'Payment callback provider reference rejected';
  }
  if (message.includes('method') || message.includes('partner code') || message.includes('merchant code')) {
    return 'Payment callback binding rejected';
  }
  return 'Payment callback request rejected';
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

function redactPaymentCallbackValue(value: unknown, depth: number): unknown {
  if (depth > PAYMENT_CALLBACK_MAX_DEPTH) {
    return TRUNCATED_PAYMENT_CALLBACK_VALUE;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, PAYMENT_CALLBACK_MAX_ARRAY_ITEMS)
      .map((item) => redactPaymentCallbackValue(item, depth + 1));
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    return value.length > PAYMENT_CALLBACK_MAX_STRING_LENGTH
      ? `${value.slice(0, PAYMENT_CALLBACK_MAX_STRING_LENGTH)}${TRUNCATED_PAYMENT_CALLBACK_VALUE}`
      : value;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, PAYMENT_CALLBACK_MAX_KEYS)
      .map(([key, nestedValue]) => [
        key,
        isRedactedPaymentCallbackKey(key)
          ? REDACTED_PAYMENT_CALLBACK_VALUE
          : redactPaymentCallbackValue(nestedValue, depth + 1),
      ]),
  );
}

function isRedactedPaymentCallbackKey(key: string) {
  return REDACTED_PAYMENT_CALLBACK_KEYS.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase());
}
