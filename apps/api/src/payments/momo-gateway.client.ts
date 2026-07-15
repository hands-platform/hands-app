import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { hmacHex, secureEqualHex } from './payment-callback.helpers';
import { requiredGatewayConfig, requiredHttpsGatewayConfig } from './payment-gateway-config';
import {
  buildMomoCreatePaymentRequest,
  buildMomoConfirmPaymentRequest,
  buildMomoQueryPaymentRequest,
  buildMomoRefundPaymentRequest,
  buildMomoRefundQueryRequest,
} from './payment-gateway-requests';

const MOMO_MINIMUM_TIMEOUT_MS = 30_000;
const MOMO_MAXIMUM_TIMEOUT_MS = 60_000;

@Injectable()
export class MomoGatewayClient {
  constructor(private readonly config: ConfigService) {}

  assertConfigured() {
    this.settings();
  }

  async createPayment(input: { bookingId: string; paymentId: string; amountVnd: number }) {
    const settings = this.settings();
    const request = buildMomoCreatePaymentRequest({
      accessKey: settings.accessKey,
      amountVnd: input.amountVnd,
      baseUrl: settings.baseUrl,
      ipnUrl: settings.ipnUrl,
      orderId: input.bookingId,
      orderInfo: `HANDS booking ${input.bookingId}`,
      partnerCode: settings.partnerCode,
      redirectUrl: settings.redirectUrl,
      requestId: input.paymentId,
      secretKey: settings.secretKey,
      autoCapture: false,
    });
    const body = await this.postJson(request.endpoint, request.body, settings.timeoutMs);
    this.assertCreateResponse(body, input, settings);

    return {
      providerRef: input.bookingId,
      status: PaymentStatus.PENDING,
      rawMeta: {
        provider: 'MOMO',
        requestId: stringField(body, 'requestId'),
        resultCode: numberField(body, 'resultCode'),
        responseTime: numberField(body, 'responseTime'),
        checkoutUrl: stringField(body, 'payUrl'),
        deeplink: optionalStringField(body, 'deeplink'),
        qrCodeUrl: optionalStringField(body, 'qrCodeUrl'),
      },
    };
  }

  async queryPayment(input: { bookingId: string; paymentId: string }) {
    const settings = this.settings();
    const requestId = momoQueryRequestId(input.paymentId);
    const request = buildMomoQueryPaymentRequest({
      accessKey: settings.accessKey,
      baseUrl: settings.baseUrl,
      orderId: input.bookingId,
      partnerCode: settings.partnerCode,
      requestId,
      secretKey: settings.secretKey,
    });
    const body = await this.postJson(request.endpoint, request.body, settings.timeoutMs);
    assertIdentity(body, 'partnerCode', settings.partnerCode);
    assertIdentity(body, 'orderId', input.bookingId);
    assertIdentity(body, 'requestId', requestId);
    const resultCode = numberField(body, 'resultCode');

    return {
      status: momoPaymentStatus(resultCode),
      rawMeta: {
        provider: 'MOMO',
        queryRequestId: requestId,
        queryResultCode: resultCode,
        queryResponseTime: optionalNumberField(body, 'responseTime'),
        gatewayTransactionId: optionalStringOrNumberField(body, 'transId'),
        gatewayMessage: optionalStringField(body, 'message'),
      },
    };
  }

  async confirmPayment(input: {
    bookingId: string;
    paymentId: string;
    amountVnd: number;
    action: 'capture' | 'cancel';
  }) {
    const settings = this.settings();
    const requestId = `${input.paymentId.slice(0, 38)}-${input.action}`;
    const request = buildMomoConfirmPaymentRequest({
      accessKey: settings.accessKey,
      amountVnd: input.amountVnd,
      baseUrl: settings.baseUrl,
      description: `HANDS booking ${input.bookingId} ${input.action}`,
      orderId: input.bookingId,
      partnerCode: settings.partnerCode,
      requestId,
      requestType: input.action,
      secretKey: settings.secretKey,
    });
    const body = await this.postJson(request.endpoint, request.body, settings.timeoutMs);
    this.assertOperationResponse(body, {
      amountVnd: input.amountVnd,
      orderId: input.bookingId,
      partnerCode: settings.partnerCode,
      requestId,
    });
    assertIdentity(body, 'requestType', input.action);
    return {
      status: input.action === 'capture' ? PaymentStatus.CAPTURED : PaymentStatus.RELEASED,
      rawMeta: operationMetadata(body, input.action),
    };
  }

  async refundPayment(input: {
    refundId: string;
    amountVnd: number;
    gatewayTransactionId: string | number;
  }) {
    const settings = this.settings();
    const requestId = `${input.refundId.slice(0, 46)}-r`;
    const request = buildMomoRefundPaymentRequest({
      accessKey: settings.accessKey,
      amountVnd: input.amountVnd,
      baseUrl: settings.baseUrl,
      description: `HANDS refund ${input.refundId}`,
      orderId: input.refundId,
      partnerCode: settings.partnerCode,
      requestId,
      secretKey: settings.secretKey,
      transId: input.gatewayTransactionId,
    });
    const body = await this.postJson(request.endpoint, request.body, settings.timeoutMs);
    this.assertOperationResponse(body, {
      amountVnd: input.amountVnd,
      orderId: input.refundId,
      partnerCode: settings.partnerCode,
      requestId,
    });
    return { status: PaymentStatus.REFUNDED, rawMeta: operationMetadata(body, 'refund') };
  }

  async queryRefund(input: { refundId: string }) {
    const settings = this.settings();
    const requestId = momoRefundQueryRequestId(input.refundId);
    const request = buildMomoRefundQueryRequest({
      accessKey: settings.accessKey,
      baseUrl: settings.baseUrl,
      orderId: input.refundId,
      partnerCode: settings.partnerCode,
      requestId,
      secretKey: settings.secretKey,
    });
    const body = await this.postJson(request.endpoint, request.body, settings.timeoutMs);
    assertIdentity(body, 'partnerCode', settings.partnerCode);
    assertIdentity(body, 'requestId', requestId);
    const queryResultCode = numberField(body, 'resultCode');
    if (queryResultCode !== 0) {
      throw new BadGatewayException(`MoMo refund query failed with result code ${queryResultCode}`);
    }

    const refund = recordArray(body, 'refundTrans').find(
      (entry) => String(entry.orderId ?? '') === input.refundId,
    );
    const refundResultCode = refund ? numberField(refund, 'resultCode') : undefined;
    if (refundResultCode !== undefined && ![0, 1000, 7000, 7002].includes(refundResultCode)) {
      throw new BadGatewayException(`MoMo refund failed with result code ${refundResultCode}`);
    }

    return {
      status: PaymentStatus.REFUNDED,
      providerFinalized: refundResultCode === 0,
      rawMeta: {
        provider: 'MOMO',
        gatewayOperation: 'refund-query',
        gatewayResultCode: queryResultCode,
        gatewayRefundResultCode: refundResultCode,
        gatewayTransactionId: refund
          ? optionalStringOrNumberField(refund, 'transId')
          : undefined,
        gatewayResponseTime: optionalNumberField(body, 'responseTime'),
        gatewayMessage: optionalStringField(body, 'message'),
      },
    };
  }

  private settings() {
    return {
      partnerCode: requiredGatewayConfig(this.config, 'MOMO_PARTNER_CODE'),
      accessKey: requiredGatewayConfig(this.config, 'MOMO_ACCESS_KEY'),
      secretKey: requiredGatewayConfig(this.config, 'MOMO_SECRET_KEY'),
      baseUrl: requiredHttpsGatewayConfig(this.config, 'MOMO_BASE_URL'),
      ipnUrl: requiredHttpsGatewayConfig(this.config, 'MOMO_IPN_URL'),
      redirectUrl: requiredHttpsGatewayConfig(this.config, 'MOMO_REDIRECT_URL'),
      timeoutMs: momoTimeoutMs(this.config.get<string>('MOMO_HTTP_TIMEOUT_MS')),
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
      throw new ServiceUnavailableException('MoMo gateway request failed');
    }
    if (!response.ok) {
      throw new BadGatewayException(`MoMo gateway returned HTTP ${response.status}`);
    }
    try {
      return record(await response.json());
    } catch {
      throw new BadGatewayException('MoMo gateway returned an invalid JSON response');
    }
  }

  private assertCreateResponse(
    body: Record<string, unknown>,
    input: { bookingId: string; paymentId: string; amountVnd: number },
    settings: ReturnType<MomoGatewayClient['settings']>,
  ) {
    assertIdentity(body, 'partnerCode', settings.partnerCode);
    assertIdentity(body, 'orderId', input.bookingId);
    assertIdentity(body, 'requestId', input.paymentId);
    if (numberField(body, 'amount') !== input.amountVnd) {
      throw new BadGatewayException('MoMo response amount does not match the payment');
    }
    const resultCode = numberField(body, 'resultCode');
    if (resultCode !== 0) {
      throw new BadGatewayException(`MoMo create payment failed with result code ${resultCode}`);
    }
    stringField(body, 'payUrl');
    const signature = stringField(body, 'signature');
    const signingMaterial = [
      `accessKey=${settings.accessKey}`,
      `amount=${numberField(body, 'amount')}`,
      `message=${stringField(body, 'message')}`,
      `orderId=${stringField(body, 'orderId')}`,
      `partnerCode=${stringField(body, 'partnerCode')}`,
      `payUrl=${stringField(body, 'payUrl')}`,
      `requestId=${stringField(body, 'requestId')}`,
      `responseTime=${numberField(body, 'responseTime')}`,
      `resultCode=${resultCode}`,
    ].join('&');
    if (!secureEqualHex(hmacHex('sha256', settings.secretKey, signingMaterial), signature)) {
      throw new BadGatewayException('MoMo create response signature is invalid');
    }
  }

  private assertOperationResponse(
    body: Record<string, unknown>,
    expected: { amountVnd: number; orderId: string; partnerCode: string; requestId: string },
  ) {
    assertIdentity(body, 'partnerCode', expected.partnerCode);
    assertIdentity(body, 'orderId', expected.orderId);
    assertIdentity(body, 'requestId', expected.requestId);
    if (numberField(body, 'amount') !== expected.amountVnd) {
      throw new BadGatewayException('MoMo response amount does not match the payment operation');
    }
    const resultCode = numberField(body, 'resultCode');
    if (resultCode !== 0) {
      throw new BadGatewayException(`MoMo payment operation failed with result code ${resultCode}`);
    }
  }
}

export function momoPaymentStatus(resultCode: number) {
  if (resultCode === 0) return PaymentStatus.CAPTURED;
  if (resultCode === 9000) return PaymentStatus.AUTHORIZED;
  if (resultCode === 1000 || resultCode === 7000 || resultCode === 7002) return PaymentStatus.PENDING;
  return PaymentStatus.FAILED;
}

function momoQueryRequestId(paymentId: string) {
  return `${paymentId.slice(0, 30)}-q-${Date.now()}`;
}

function momoRefundQueryRequestId(refundId: string) {
  return `${refundId.slice(0, 30)}-rq-${Date.now()}`;
}

function momoTimeoutMs(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return MOMO_MINIMUM_TIMEOUT_MS;
  return Math.min(MOMO_MAXIMUM_TIMEOUT_MS, Math.max(MOMO_MINIMUM_TIMEOUT_MS, parsed));
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadGatewayException('MoMo gateway returned an invalid response');
  }
  return value as Record<string, unknown>;
}

function recordArray(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (!Array.isArray(value)) {
    throw new BadGatewayException(`MoMo response ${key} is invalid`);
  }
  return value.map(record);
}

function stringField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== 'string' || !value) {
    throw new BadGatewayException(`MoMo response ${key} is invalid`);
  }
  return value;
}

function numberField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new BadGatewayException(`MoMo response ${key} is invalid`);
  }
  return number;
}

function optionalStringField(body: Record<string, unknown>, key: string) {
  return typeof body[key] === 'string' ? body[key] : undefined;
}

function optionalNumberField(body: Record<string, unknown>, key: string) {
  return body[key] === undefined ? undefined : numberField(body, key);
}

function optionalStringOrNumberField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function assertIdentity(body: Record<string, unknown>, key: string, expected: string) {
  if (String(body[key] ?? '') !== expected) {
    throw new BadGatewayException(`MoMo response ${key} does not match the request`);
  }
}

function operationMetadata(body: Record<string, unknown>, operation: 'capture' | 'cancel' | 'refund') {
  return {
    provider: 'MOMO',
    gatewayOperation: operation,
    gatewayTransactionId: optionalStringOrNumberField(body, 'transId'),
    gatewayResultCode: numberField(body, 'resultCode'),
    gatewayResponseTime: optionalNumberField(body, 'responseTime'),
    gatewayMessage: optionalStringField(body, 'message'),
  };
}
