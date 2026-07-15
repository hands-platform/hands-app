import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { hmacHex, secureEqualHex } from './payment-callback.helpers';
import { requiredGatewayConfig, requiredHttpsGatewayConfig } from './payment-gateway-config';
import {
  buildVnpayCheckoutRequest,
  buildVnpayQueryPaymentRequest,
  buildVnpayRefundPaymentRequest,
} from './payment-gateway-requests';

const VNPAY_DEFAULT_TIMEOUT_MS = 30_000;
const VNPAY_MAXIMUM_TIMEOUT_MS = 60_000;
const VNPAY_CHECKOUT_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class VnpayGatewayClient {
  constructor(private readonly config: ConfigService) {}

  assertConfigured() {
    this.settings();
  }

  createPayment(input: { bookingId: string; paymentId: string; amountVnd: number }, now = new Date()) {
    const settings = this.settings();
    const createDate = vnpayVietnamDate(now);
    const expireDate = vnpayVietnamDate(new Date(now.getTime() + VNPAY_CHECKOUT_TTL_MS));
    const request = buildVnpayCheckoutRequest({
      amountVnd: input.amountVnd,
      createDate,
      expireDate,
      hashSecret: settings.hashSecret,
      ipAddress: settings.serverIp,
      paymentUrl: settings.paymentUrl,
      returnUrl: settings.returnUrl,
      tmnCode: settings.tmnCode,
      txnRef: input.bookingId,
    });

    return {
      providerRef: input.bookingId,
      status: PaymentStatus.PENDING,
      rawMeta: {
        provider: 'VNPAY',
        checkoutUrl: request.checkoutUrl,
        gatewayCreateDate: createDate,
        gatewayExpireDate: expireDate,
        gatewayPaymentId: input.paymentId,
      },
    };
  }

  async queryPayment(
    input: { bookingId: string; paymentId: string; amountVnd: number; transactionDate: string },
    now = new Date(),
  ) {
    const settings = this.settings();
    const request = buildVnpayQueryPaymentRequest({
      apiUrl: settings.apiUrl,
      createDate: vnpayVietnamDate(now),
      hashSecret: settings.hashSecret,
      ipAddress: settings.serverIp,
      orderInfo: `Query HANDS booking ${input.bookingId}`,
      requestId: vnpayRequestId(input.paymentId, 'q', now),
      tmnCode: settings.tmnCode,
      transactionDate: input.transactionDate,
      txnRef: input.bookingId,
    });
    const body = await this.postJson(request.endpoint, request.body, settings.timeoutMs);
    assertVnpayOperationResponse(body, {
      amountVnd: input.amountVnd,
      command: 'querydr',
      hashSecret: settings.hashSecret,
      tmnCode: settings.tmnCode,
      txnRef: input.bookingId,
    });
    const responseCode = field(body, 'vnp_ResponseCode');
    if (responseCode !== '00') {
      throw new BadGatewayException(`VNPay query failed with response code ${responseCode}`);
    }
    const transactionStatus = field(body, 'vnp_TransactionStatus');

    return {
      status: vnpayPaymentStatus(transactionStatus),
      rawMeta: vnpayOperationMetadata(body, 'querydr'),
    };
  }

  async requestRefund(
    input: {
      refundId: string;
      bookingId: string;
      amountVnd: number;
      transactionDate: string;
      transactionNo?: string;
      createBy: string;
    },
    now = new Date(),
  ) {
    const settings = this.settings();
    const request = buildVnpayRefundPaymentRequest({
      amountVnd: input.amountVnd,
      apiUrl: settings.apiUrl,
      createBy: input.createBy,
      createDate: vnpayVietnamDate(now),
      hashSecret: settings.hashSecret,
      ipAddress: settings.serverIp,
      orderInfo: `Refund HANDS booking ${input.bookingId}`,
      requestId: vnpayRequestId(input.refundId, 'r', now),
      tmnCode: settings.tmnCode,
      transactionDate: input.transactionDate,
      transactionNo: input.transactionNo,
      txnRef: input.bookingId,
    });
    const body = await this.postJson(request.endpoint, request.body, settings.timeoutMs);
    assertVnpayOperationResponse(body, {
      amountVnd: input.amountVnd,
      command: 'refund',
      hashSecret: settings.hashSecret,
      tmnCode: settings.tmnCode,
      txnRef: input.bookingId,
    });
    const responseCode = field(body, 'vnp_ResponseCode');
    if (responseCode !== '00' && responseCode !== '94') {
      throw new BadGatewayException(`VNPay refund failed with response code ${responseCode}`);
    }

    return {
      accepted: true,
      providerProcessing: responseCode === '94' || ['05', '06'].includes(field(body, 'vnp_TransactionStatus')),
      rawMeta: vnpayOperationMetadata(body, 'refund'),
    };
  }

  private settings() {
    return {
      tmnCode: requiredGatewayConfig(this.config, 'VNPAY_TMN_CODE'),
      hashSecret: requiredGatewayConfig(this.config, 'VNPAY_HASH_SECRET'),
      paymentUrl: requiredHttpsGatewayConfig(this.config, 'VNPAY_PAYMENT_URL'),
      returnUrl: requiredHttpsGatewayConfig(this.config, 'VNPAY_RETURN_URL'),
      apiUrl: requiredHttpsGatewayConfig(this.config, 'VNPAY_API_URL'),
      serverIp: requiredGatewayConfig(this.config, 'VNPAY_SERVER_IP'),
      timeoutMs: vnpayTimeoutMs(this.config.get<string>('VNPAY_HTTP_TIMEOUT_MS')),
    };
  }

  private async postJson(endpoint: string, body: object, timeoutMs: number) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException('VNPay gateway request failed');
    }
    if (!response.ok) {
      throw new BadGatewayException(`VNPay gateway returned HTTP ${response.status}`);
    }
    try {
      return record(await response.json());
    } catch {
      throw new BadGatewayException('VNPay gateway returned an invalid JSON response');
    }
  }
}

export function vnpayVietnamDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}${value('month')}${value('day')}${value('hour')}${value('minute')}${value('second')}`;
}

export function vnpayPaymentStatus(transactionStatus: string) {
  if (transactionStatus === '00') return PaymentStatus.CAPTURED;
  if (transactionStatus === '01' || transactionStatus === '05' || transactionStatus === '06') {
    return PaymentStatus.PENDING;
  }
  return PaymentStatus.FAILED;
}

function vnpayRequestId(reference: string, operation: 'q' | 'r', date: Date) {
  const digest = createHash('sha256').update(reference).digest('hex').slice(0, 15);
  return `${digest}${operation}${vnpayVietnamDate(date)}`;
}

function assertVnpayOperationResponse(
  body: Record<string, unknown>,
  expected: {
    amountVnd: number;
    command: 'querydr' | 'refund';
    hashSecret: string;
    tmnCode: string;
    txnRef: string;
  },
) {
  if (field(body, 'vnp_Command') !== expected.command) {
    throw new BadGatewayException('VNPay response command does not match the request');
  }
  if (field(body, 'vnp_TmnCode') !== expected.tmnCode) {
    throw new BadGatewayException('VNPay response terminal code does not match the request');
  }
  if (field(body, 'vnp_TxnRef') !== expected.txnRef) {
    throw new BadGatewayException('VNPay response transaction reference does not match the request');
  }
  if (Number(field(body, 'vnp_Amount')) !== expected.amountVnd * 100) {
    throw new BadGatewayException('VNPay response amount does not match the payment operation');
  }
  const signature = field(body, 'vnp_SecureHash');
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
    ...(expected.command === 'querydr' ? ['vnp_PromotionCode', 'vnp_PromotionAmount'] : []),
  ];
  const signingMaterial = signedFields.map((key) => field(body, key)).join('|');
  if (!secureEqualHex(hmacHex('sha512', expected.hashSecret, signingMaterial), signature)) {
    throw new BadGatewayException('VNPay operation response signature is invalid');
  }
}

function vnpayOperationMetadata(body: Record<string, unknown>, operation: 'querydr' | 'refund') {
  return {
    provider: 'VNPAY',
    gatewayOperation: operation,
    gatewayResponseId: field(body, 'vnp_ResponseId'),
    gatewayResponseCode: field(body, 'vnp_ResponseCode'),
    gatewayTransactionId: optionalField(body, 'vnp_TransactionNo'),
    gatewayTransactionStatus: field(body, 'vnp_TransactionStatus'),
    gatewayTransactionType: optionalField(body, 'vnp_TransactionType'),
    gatewayPayDate: optionalField(body, 'vnp_PayDate'),
    gatewayMessage: optionalField(body, 'vnp_Message'),
  };
}

function vnpayTimeoutMs(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return VNPAY_DEFAULT_TIMEOUT_MS;
  return Math.min(VNPAY_MAXIMUM_TIMEOUT_MS, Math.max(1_000, parsed));
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadGatewayException('VNPay gateway returned an invalid response');
  }
  return value as Record<string, unknown>;
}

function field(body: Record<string, unknown>, key: string) {
  return body[key] === undefined || body[key] === null ? '' : String(body[key]);
}

function optionalField(body: Record<string, unknown>, key: string) {
  const value = field(body, key);
  return value || undefined;
}
