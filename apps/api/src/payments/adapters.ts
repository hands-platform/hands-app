import { BadRequestException, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  PaymentAdapter,
  PaymentAdapterMode,
  PaymentAuthorization,
  PaymentAuthorizationInput,
  PaymentCallbackResult,
  PaymentOperationInput,
  PaymentOperationResult,
  PaymentRefundInput,
} from './payment-adapter';
import { MomoGatewayClient } from './momo-gateway.client';
import { VnpayGatewayClient, vnpayVietnamDate } from './vnpay-gateway.client';

abstract class PlaceholderRedirectAdapter implements PaymentAdapter {
  abstract readonly method: PaymentMethod;
  get mode(): PaymentAdapterMode {
    return 'PLACEHOLDER' as const;
  }

  initialAuthorization(input: PaymentAuthorizationInput): PaymentAuthorization {
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

  async authorize(input: PaymentAuthorizationInput): Promise<PaymentAuthorization> {
    return this.initialAuthorization(input);
  }

  parseCallback(payload: unknown): PaymentCallbackResult {
    const body = isRecord(payload) ? payload : {};
    return {
      providerRef: String(body.providerRef ?? body.orderId ?? body.vnp_TxnRef ?? ''),
      status: normalizeStatus(body.status ?? body.resultCode ?? body.vnp_ResponseCode),
      rawMeta: body,
    };
  }

  async checkStatus(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    void input;
    return { status: PaymentStatus.AUTHORIZED };
  }

  async capture(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    void input;
    return { status: PaymentStatus.CAPTURED };
  }

  async release(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    void input;
    return { status: PaymentStatus.RELEASED };
  }

  async refund(input: PaymentRefundInput): Promise<PaymentOperationResult> {
    void input;
    return { status: PaymentStatus.REFUNDED, providerFinalized: true };
  }

  async checkRefund(input: PaymentRefundInput): Promise<PaymentOperationResult> {
    return this.refund(input);
  }
}

@Injectable()
export class MomoPaymentAdapter extends PlaceholderRedirectAdapter {
  readonly method = PaymentMethod.MOMO;

  constructor(
    @Optional() private readonly gatewayClient?: MomoGatewayClient,
    @Optional() private readonly config?: ConfigService,
  ) {
    super();
  }

  override get mode(): PaymentAdapterMode {
    return this.gatewayEnabled() ? ('GATEWAY' as const) : ('PLACEHOLDER' as const);
  }

  override initialAuthorization(input: PaymentAuthorizationInput): PaymentAuthorization {
    if (!this.gatewayEnabled()) {
      return super.initialAuthorization(input);
    }
    return {
      method: this.method,
      status: PaymentStatus.PENDING,
      providerRef: input.bookingId,
      rawMeta: { provider: this.method, authorizationState: 'PENDING' },
    };
  }

  override async authorize(input: PaymentAuthorizationInput): Promise<PaymentAuthorization> {
    if (!this.gatewayEnabled()) {
      return super.authorize(input);
    }
    if (!input.paymentId) {
      throw new BadRequestException('MoMo authorization requires a persisted payment id');
    }
    const result = await this.client().createPayment({
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      amountVnd: input.amount,
    });
    return { method: this.method, ...result };
  }

  override async checkStatus(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!this.gatewayEnabled()) {
      return super.checkStatus(input);
    }
    return this.client().queryPayment({ bookingId: input.bookingId, paymentId: input.paymentId });
  }

  override async capture(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!this.gatewayEnabled()) {
      return super.capture(input);
    }
    return this.client().confirmPayment({
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      amountVnd: input.amount,
      action: 'capture',
    });
  }

  override async release(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!this.gatewayEnabled()) {
      return super.release(input);
    }
    return this.client().confirmPayment({
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      amountVnd: input.amount,
      action: 'cancel',
    });
  }

  override async refund(input: PaymentRefundInput): Promise<PaymentOperationResult> {
    if (!this.gatewayEnabled()) {
      return super.refund(input);
    }
    if (!input.gatewayTransactionId) {
      throw new BadRequestException('MoMo refund requires a gateway transaction id');
    }
    return this.client().refundPayment({
      refundId: input.refundId,
      amountVnd: input.amount,
      gatewayTransactionId: input.gatewayTransactionId,
    });
  }

  override async checkRefund(input: PaymentRefundInput): Promise<PaymentOperationResult> {
    if (!this.gatewayEnabled()) {
      return super.checkRefund(input);
    }
    return this.client().queryRefund({ refundId: input.refundId });
  }

  private gatewayEnabled() {
    return this.config?.get<string>('MOMO_GATEWAY_ENABLED')?.trim().toLowerCase() === 'true';
  }

  private client() {
    if (!this.gatewayClient) {
      throw new ServiceUnavailableException('MoMo gateway client is unavailable');
    }
    return this.gatewayClient;
  }
}

@Injectable()
export class CardPaymentAdapter extends PlaceholderRedirectAdapter {
  readonly method = PaymentMethod.CARD;
}

@Injectable()
export class VnpayPaymentAdapter extends PlaceholderRedirectAdapter {
  readonly method = PaymentMethod.VNPAY;

  constructor(
    @Optional() private readonly gatewayClient?: VnpayGatewayClient,
    @Optional() private readonly config?: ConfigService,
  ) {
    super();
  }

  override get mode(): PaymentAdapterMode {
    return this.gatewayEnabled() ? ('GATEWAY' as const) : ('PLACEHOLDER' as const);
  }

  override initialAuthorization(input: PaymentAuthorizationInput): PaymentAuthorization {
    if (!this.gatewayEnabled()) {
      return super.initialAuthorization(input);
    }
    return {
      method: this.method,
      status: PaymentStatus.PENDING,
      providerRef: input.bookingId,
      rawMeta: { provider: this.method, authorizationState: 'PENDING' },
    };
  }

  override async authorize(input: PaymentAuthorizationInput): Promise<PaymentAuthorization> {
    if (!this.gatewayEnabled()) {
      return super.authorize(input);
    }
    if (!input.paymentId) {
      throw new BadRequestException('VNPay authorization requires a persisted payment id');
    }
    const result = this.client().createPayment({
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      amountVnd: input.amount,
    });
    return { method: this.method, ...result };
  }

  override parseCallback(payload: unknown): PaymentCallbackResult {
    if (!this.gatewayEnabled()) {
      return super.parseCallback(payload);
    }
    const body = isRecord(payload) ? payload : {};
    const responseCode = String(body.vnp_ResponseCode ?? '');
    const transactionStatus = String(body.vnp_TransactionStatus ?? '');
    return {
      providerRef: String(body.vnp_TxnRef ?? ''),
      status: responseCode === '00' ? vnpayCallbackStatus(transactionStatus) : PaymentStatus.FAILED,
      rawMeta: {
        ...body,
        gatewayPayDate: stringOrUndefined(body.vnp_PayDate),
        gatewayTransactionId: stringOrUndefined(body.vnp_TransactionNo),
        gatewayTransactionStatus: transactionStatus,
        gatewayTransactionType: stringOrUndefined(body.vnp_TransactionType),
      },
    };
  }

  override async checkStatus(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!this.gatewayEnabled()) {
      return super.checkStatus(input);
    }
    return this.queryPayment(input);
  }

  override async capture(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!this.gatewayEnabled()) {
      return super.capture(input);
    }
    const operation = await this.queryPayment(input);
    if (operation.status !== PaymentStatus.CAPTURED) {
      throw new ServiceUnavailableException('VNPay payment is not captured by the provider');
    }
    return operation;
  }

  override async release(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!this.gatewayEnabled()) {
      return super.release(input);
    }
    const meta = paymentMetadata(input);
    const expireDate = stringOrUndefined(meta.gatewayExpireDate);
    if (!expireDate || expireDate > vnpayVietnamDate(new Date())) {
      throw new ServiceUnavailableException(
        'VNPay checkout cannot be released before its provider expiry is confirmed',
      );
    }
    const operation = await this.queryPayment(input);
    if (operation.status === PaymentStatus.CAPTURED) {
      throw new ServiceUnavailableException('Captured VNPay payments require the refund workflow');
    }
    return {
      status: PaymentStatus.RELEASED,
      rawMeta: { ...operation.rawMeta, gatewayReleaseReason: 'CHECKOUT_EXPIRED' },
    };
  }

  override async refund(input: PaymentRefundInput): Promise<PaymentOperationResult> {
    if (!this.gatewayEnabled()) {
      return super.refund(input);
    }
    const meta = paymentMetadata(input);
    const transactionDate = requiredMetadata(meta, 'gatewayCreateDate', 'VNPay refund');
    const requestedBy = input.requestedBy?.trim();
    if (!requestedBy) {
      throw new BadRequestException('VNPay refund requires the requesting admin id');
    }
    const operation = await this.client().requestRefund({
      refundId: input.refundId,
      bookingId: input.bookingId,
      amountVnd: input.amount,
      transactionDate,
      transactionNo: input.gatewayTransactionId,
      createBy: requestedBy,
    });
    return {
      status: PaymentStatus.REFUNDED,
      providerFinalized: false,
      rawMeta: operation.rawMeta,
    };
  }

  override async checkRefund(input: PaymentRefundInput): Promise<PaymentOperationResult> {
    if (!this.gatewayEnabled()) {
      return super.checkRefund(input);
    }
    const operation = await this.queryPayment(input);
    const meta: Record<string, unknown> = isRecord(operation.rawMeta) ? operation.rawMeta : {};
    const transactionType = String(meta.gatewayTransactionType ?? '');
    const transactionStatus = String(meta.gatewayTransactionStatus ?? '');
    const finalized = ['02', '03'].includes(transactionType) && transactionStatus === '00';
    if (transactionStatus === '09' || operation.status === PaymentStatus.FAILED) {
      throw new ServiceUnavailableException('VNPay refund was rejected or failed');
    }
    return {
      status: PaymentStatus.REFUNDED,
      providerFinalized: finalized,
      rawMeta: operation.rawMeta,
    };
  }

  private queryPayment(input: PaymentOperationInput) {
    const meta = paymentMetadata(input);
    return this.client().queryPayment({
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      amountVnd: input.amount,
      transactionDate: requiredMetadata(meta, 'gatewayCreateDate', 'VNPay status query'),
    });
  }

  private gatewayEnabled() {
    return this.config?.get<string>('VNPAY_GATEWAY_ENABLED')?.trim().toLowerCase() === 'true';
  }

  private client() {
    if (!this.gatewayClient) {
      throw new ServiceUnavailableException('VNPay gateway client is unavailable');
    }
    return this.gatewayClient;
  }
}

export class CashPaymentAdapter implements PaymentAdapter {
  readonly method = PaymentMethod.CASH;
  readonly mode = 'INTERNAL' as const;

  initialAuthorization(): PaymentAuthorization {
    return {
      method: PaymentMethod.CASH,
      status: PaymentStatus.PENDING,
      providerRef: null,
      rawMeta: { provider: 'CASH' },
    };
  }

  async authorize() {
    return this.initialAuthorization();
  }

  parseCallback(payload: unknown): PaymentCallbackResult {
    return {
      providerRef: isRecord(payload) ? String(payload.providerRef ?? '') : '',
      status: PaymentStatus.CAPTURED,
      rawMeta: isRecord(payload) ? payload : {},
    };
  }

  async checkStatus() {
    return { status: PaymentStatus.PENDING };
  }

  async capture() {
    return { status: PaymentStatus.CAPTURED };
  }

  async release() {
    return { status: PaymentStatus.RELEASED };
  }

  async refund() {
    return { status: PaymentStatus.REFUNDED, providerFinalized: true };
  }

  async checkRefund() {
    return { status: PaymentStatus.REFUNDED, providerFinalized: true };
  }
}

export class CustomerWalletPaymentAdapter implements PaymentAdapter {
  readonly method = PaymentMethod.CUSTOMER_WALLET;
  readonly mode = 'INTERNAL' as const;

  initialAuthorization(): PaymentAuthorization {
    return {
      method: PaymentMethod.CUSTOMER_WALLET,
      status: PaymentStatus.AUTHORIZED,
      providerRef: null,
      rawMeta: { provider: 'CUSTOMER_WALLET', reservationState: 'HELD' },
    };
  }

  async authorize() {
    return this.initialAuthorization();
  }

  parseCallback(payload: unknown): PaymentCallbackResult {
    return {
      providerRef: isRecord(payload) ? String(payload.providerRef ?? '') : '',
      status: PaymentStatus.CAPTURED,
      rawMeta: isRecord(payload) ? payload : {},
    };
  }

  async checkStatus() {
    return { status: PaymentStatus.AUTHORIZED };
  }

  async capture() {
    return { status: PaymentStatus.CAPTURED };
  }

  async release() {
    return { status: PaymentStatus.RELEASED };
  }

  async refund() {
    return { status: PaymentStatus.REFUNDED, providerFinalized: true };
  }

  async checkRefund() {
    return { status: PaymentStatus.REFUNDED, providerFinalized: true };
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

function paymentMetadata(input: PaymentOperationInput) {
  return isRecord(input.rawMeta) ? input.rawMeta : {};
}

function requiredMetadata(meta: Record<string, unknown>, key: string, operation: string) {
  const value = stringOrUndefined(meta[key]);
  if (!value) {
    throw new BadRequestException(`${operation} requires retained ${key}`);
  }
  return value;
}

function stringOrUndefined(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
}

function vnpayCallbackStatus(transactionStatus: string) {
  if (transactionStatus === '00') return PaymentStatus.CAPTURED;
  if (['01', '05', '06'].includes(transactionStatus)) return PaymentStatus.PENDING;
  return PaymentStatus.FAILED;
}
