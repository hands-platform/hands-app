import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'crypto';
import { AdminService } from '../admin/admin.service';
import { EarningsService } from '../earnings/earnings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CashPaymentAdapter, MomoPaymentAdapter, VnpayPaymentAdapter } from './adapters';
import { PaymentAdapter } from './payment-adapter';

const PAYMENT_STATUS_CHECK_DELAY_MS = 30_000;
const PAYMENT_STATUS_CHECK_ATTEMPTS = 5;
const PAYMENT_STATUS_CHECK_BACKOFF_MS = 10_000;
const TERMINAL_PAYMENT_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.CAPTURED,
  PaymentStatus.REFUNDED,
  PaymentStatus.RELEASED,
]);

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly admin: AdminService,
    private readonly earnings: EarningsService,
    private readonly momo: MomoPaymentAdapter,
    private readonly vnpay: VnpayPaymentAdapter,
    private readonly cash: CashPaymentAdapter,
    @InjectQueue('payment-status-check') private readonly paymentStatusQueue: Queue,
    private readonly notifications?: NotificationsService,
  ) {}

  buildAuthorization(
    method: PaymentMethod,
    amount: number,
    bookingId = 'pending-booking',
    extraRawMeta?: Prisma.InputJsonValue,
  ) {
    const authorization = this.adapterFor(method).authorize({ bookingId, amount, currency: 'VND' });
    const authorizationMeta = asJsonObject(authorization.rawMeta);
    const extraMeta = asJsonObject(extraRawMeta);
    return {
      method: authorization.method,
      amount,
      status: authorization.status,
      providerRef: authorization.providerRef,
      rawMeta: toJsonOrUndefined({ ...authorizationMeta, ...extraMeta }),
    };
  }

  async scheduleStatusCheck(paymentId: string) {
    await this.paymentStatusQueue.add(
      'payment-status-check',
      { paymentId },
      {
        delay: PAYMENT_STATUS_CHECK_DELAY_MS,
        attempts: PAYMENT_STATUS_CHECK_ATTEMPTS,
        backoff: { type: 'exponential', delay: PAYMENT_STATUS_CHECK_BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async refreshAuthorizationForBooking(paymentId: string, bookingId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const authorization = this.adapterFor(payment.method).authorize({
      bookingId,
      amount: payment.amount,
      currency: payment.currency,
    });

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: authorization.status,
        providerRef: authorization.providerRef,
        rawMeta: toJsonOrUndefined(authorization.rawMeta),
      },
    });
  }

  async handleCallback(method: PaymentMethod, payload: unknown) {
    const paymentMethod = this.parsePaymentMethod(method);
    const body = asJsonObject(payload);
    const initialEvidence = callbackAttemptEvidence(paymentMethod, body);
    let verification: ReturnType<PaymentsService['verifyCallback']> | null = null;
    let parsed: ReturnType<PaymentAdapter['parseCallback']> | null = null;
    let existing: Awaited<ReturnType<typeof this.prisma.payment.findUnique>> | null = null;

    try {
      verification = this.verifyCallback(paymentMethod, payload);
      parsed = this.adapterFor(paymentMethod).parseCallback(payload);
      if (!parsed.providerRef) {
        throw new BadRequestException('Payment callback provider reference is required');
      }

      existing = await this.prisma.payment.findUnique({ where: { providerRef: parsed.providerRef } });
      if (!existing) {
        throw new BadRequestException('Payment callback provider reference is unknown');
      }
      this.assertCallbackMatchesPayment(paymentMethod, payload, existing);

      if (isTerminalPaymentStatus(existing.status)) {
        if (existing.status === parsed.status) {
          await this.recordCallbackAttempt({
            ...initialEvidence,
            paymentId: existing.id,
            providerRef: parsed.providerRef,
            outcome: 'REPLAY',
            signatureVerified: verification.verified,
            verificationMode: verification.mode,
            providerStatus: parsed.status,
            rawPayload: body,
          });
          return { ok: true, replay: true, payment: existing };
        }
        throw new ConflictException('Payment callback conflicts with a terminal payment status');
      }

      const payment = await this.prisma.payment.update({
        where: { id: existing.id },
        data: {
          status: parsed.status,
          rawMeta: toJsonOrUndefined(callbackRawMeta(parsed.rawMeta, verification)),
        },
      });
      await this.recordCallbackAttempt({
        ...initialEvidence,
        paymentId: payment.id,
        providerRef: parsed.providerRef,
        outcome: 'ACCEPTED',
        signatureVerified: verification.verified,
        verificationMode: verification.mode,
        providerStatus: parsed.status,
        rawPayload: body,
      });
      await this.notifyPaymentUpdated(payment.id);
      return { ok: true, replay: false, payment };
    } catch (error) {
      await this.recordCallbackAttempt({
        ...initialEvidence,
        paymentId: existing?.id ?? null,
        providerRef: parsed?.providerRef || initialEvidence.providerRef,
        outcome: callbackFailureOutcome(error),
        signatureVerified: verification?.verified ?? null,
        verificationMode: verification?.mode ?? null,
        providerStatus: parsed?.status ?? initialEvidence.providerStatus,
        errorCode: errorCode(error),
        errorMessage: errorMessage(error),
        rawPayload: body,
      });
      throw error;
    }
  }

  async checkAndSyncStatus(paymentId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (!payment.providerRef) {
      return { skipped: true, reason: 'NO_PROVIDER_REF' };
    }
    if (isTerminalPaymentStatus(payment.status)) {
      return { skipped: true, reason: 'TERMINAL_STATUS', paymentId, status: payment.status };
    }

    const status = this.adapterFor(payment.method).checkStatus(payment.providerRef);
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status },
    });
    await this.notifyPaymentUpdated(updated.id);

    return { paymentId, status: updated.status };
  }

  async syncStatusForAdmin(actorId: string, paymentId: string) {
    const result = await this.checkAndSyncStatus(paymentId);
    await this.admin.writeAudit(actorId, 'payment.sync', `payment:${paymentId}`, toJsonOrUndefined(result));
    return result;
  }

  async capture(actorId: string, paymentId: string) {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.CAPTURED },
    });

    await this.admin.writeAudit(actorId, 'payment.capture', `payment:${paymentId}`, {
      amount: payment.amount,
      method: payment.method,
      bookingId: payment.bookingId,
    });
    await this.notifyPaymentUpdated(payment.id);

    return payment;
  }

  async release(paymentId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const status = this.adapterFor(payment.method).release(payment.providerRef);
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });
    await this.notifyPaymentUpdated(updated.id);
    return updated;
  }

  async releaseForAdmin(actorId: string, paymentId: string) {
    const payment = await this.release(paymentId);
    await this.admin.writeAudit(actorId, 'payment.release', `payment:${paymentId}`, {
      amount: payment.amount,
      method: payment.method,
      bookingId: payment.bookingId,
      status: payment.status,
    });
    return payment;
  }

  async refund(actorId: string, paymentId: string) {
    const existing = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        booking: { update: { status: BookingStatus.REFUNDED } },
        refunds: {
          create: {
            bookingId: existing.bookingId,
            amount: existing.amount,
            reason: 'Admin manual refund',
            status: 'REQUESTED',
          },
        },
      },
      include: { refunds: true },
    });
    const earningCancellation = await this.earnings.cancelForRefund(existing.bookingId);
    const earningCancellationAudit =
      earningCancellation.skipped || !('earning' in earningCancellation)
        ? { skipped: true, reason: earningCancellation.reason }
        : { skipped: false, earningId: earningCancellation.earning?.id ?? 'unknown' };

    await this.admin.writeAudit(actorId, 'payment.refund', `payment:${paymentId}`, {
      amount: payment.amount,
      method: payment.method,
      earningCancellation: earningCancellationAudit,
    });
    await this.notifyPaymentUpdated(payment.id);

    return payment;
  }

  private async notifyPaymentUpdated(paymentId: string) {
    if (!this.notifications) {
      return;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        bookingId: true,
        booking: { select: { customerProfile: { select: { userId: true } } } },
      },
    });
    if (!payment) {
      return;
    }

    await this.notifications.create({
      userId: payment.booking.customerProfile.userId,
      type: 'payment.updated',
      title: 'Payment updated',
      body: 'Your booking payment status was updated.',
      data: { paymentId: payment.id, bookingId: payment.bookingId },
    });
  }

  private adapterFor(method: PaymentMethod): PaymentAdapter {
    if (method === PaymentMethod.MOMO) {
      return this.momo;
    }
    if (method === PaymentMethod.VNPAY) {
      return this.vnpay;
    }
    if (method === PaymentMethod.CASH) {
      return this.cash;
    }
    throw new BadRequestException('Unsupported payment method');
  }

  private parsePaymentMethod(method: PaymentMethod | string): PaymentMethod {
    if (Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      return method as PaymentMethod;
    }
    throw new BadRequestException('Unsupported payment method');
  }

  private verifyCallback(method: PaymentMethod, payload: unknown) {
    if (method === PaymentMethod.CASH) {
      return { verified: true, mode: 'cash-internal' };
    }

    const body = asJsonObject(payload);
    if (method === PaymentMethod.MOMO) {
      return this.verifyMomoCallback(body);
    }
    if (method === PaymentMethod.VNPAY) {
      return this.verifyVnpayCallback(body);
    }
    throw new BadRequestException('Unsupported payment method');
  }

  private verifyMomoCallback(body: Record<string, unknown>) {
    const secret = this.paymentSecret('MOMO_SECRET_KEY', PaymentMethod.MOMO);
    if (!secret) {
      return { verified: false, mode: 'dev-unverified' };
    }

    const signature = stringValue(body.signature);
    if (!signature) {
      throw new BadRequestException('MoMo callback signature is required');
    }

    const candidates = momoSignatureCandidates(body, this.config.get<string>('MOMO_ACCESS_KEY'));
    const verified = candidates.some((candidate) =>
      secureEqualHex(hmacHex('sha256', secret, candidate), signature),
    );
    if (!verified) {
      throw new BadRequestException('Invalid MoMo callback signature');
    }
    return { verified: true, mode: 'momo-hmac-sha256' };
  }

  private verifyVnpayCallback(body: Record<string, unknown>) {
    const secret = this.paymentSecret('VNPAY_HASH_SECRET', PaymentMethod.VNPAY);
    if (!secret) {
      return { verified: false, mode: 'dev-unverified' };
    }

    const signature = stringValue(body.vnp_SecureHash);
    if (!signature) {
      throw new BadRequestException('VNPay callback secure hash is required');
    }

    const candidates = vnpaySignatureCandidates(body);
    const verified = candidates.some((candidate) =>
      secureEqualHex(hmacHex('sha512', secret, candidate), signature),
    );
    if (!verified) {
      throw new BadRequestException('Invalid VNPay callback secure hash');
    }
    return { verified: true, mode: 'vnpay-hmac-sha512' };
  }

  private paymentSecret(envKey: string, method: PaymentMethod) {
    const secret = this.config.get<string>(envKey)?.trim();
    if (secret) {
      return secret;
    }
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new BadRequestException(`${method} callback secret is not configured`);
    }
    return null;
  }

  private assertCallbackMatchesPayment(method: PaymentMethod, payload: unknown, payment: { amount: number }) {
    const body = asJsonObject(payload);
    const callbackAmount = callbackAmountVnd(method, body);
    if (callbackAmount !== null && callbackAmount !== payment.amount) {
      throw new BadRequestException('Payment callback amount does not match the stored payment');
    }

    if (method === PaymentMethod.MOMO) {
      const expectedPartnerCode = this.config.get<string>('MOMO_PARTNER_CODE')?.trim();
      const partnerCode = stringValue(body.partnerCode);
      if (expectedPartnerCode && partnerCode && partnerCode !== expectedPartnerCode) {
        throw new BadRequestException('MoMo callback partner code does not match');
      }
    }

    if (method === PaymentMethod.VNPAY) {
      const expectedTmnCode = this.config.get<string>('VNPAY_TMN_CODE')?.trim();
      const tmnCode = stringValue(body.vnp_TmnCode);
      if (expectedTmnCode && tmnCode && tmnCode !== expectedTmnCode) {
        throw new BadRequestException('VNPay callback merchant code does not match');
      }
    }
  }

  private async recordCallbackAttempt(input: {
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
  }) {
    try {
      await this.prisma.paymentCallbackAttempt.create({
        data: {
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
          rawPayload: toJsonOrUndefined(input.rawPayload ?? {}),
        },
      });
    } catch {
      // Callback verification decisions must not become unavailable because audit storage failed.
    }
  }
}

function isTerminalPaymentStatus(status: PaymentStatus) {
  return TERMINAL_PAYMENT_STATUSES.has(status);
}

function toJsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function callbackRawMeta(
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

function momoSignatureCandidates(body: Record<string, unknown>, accessKey?: string) {
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

function vnpaySignatureCandidates(body: Record<string, unknown>) {
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

function sortedKeyValueString(values: Record<string, unknown>) {
  return Object.keys(values)
    .filter((key) => values[key] !== undefined && values[key] !== null)
    .sort()
    .map((key) => `${key}=${stringValue(values[key])}`)
    .join('&');
}

function callbackAmountVnd(method: PaymentMethod, body: Record<string, unknown>) {
  if (method === PaymentMethod.MOMO && body.amount !== undefined) {
    return numberValue(body.amount);
  }
  if (method === PaymentMethod.VNPAY && body.vnp_Amount !== undefined) {
    const rawAmount = numberValue(body.vnp_Amount);
    return rawAmount === null ? null : Math.round(rawAmount / 100);
  }
  return null;
}

function callbackAttemptEvidence(method: PaymentMethod, body: Record<string, unknown>) {
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

function callbackProviderRef(body: Record<string, unknown>) {
  return (
    stringValueOrNull(body.providerRef) ??
    stringValueOrNull(body.orderId) ??
    stringValueOrNull(body.vnp_TxnRef)
  );
}

function stringValueOrNull(value: unknown) {
  const valueString = stringValue(value);
  return valueString ? valueString : null;
}

function errorCode(error: unknown) {
  if (error instanceof BadRequestException) {
    return 'BAD_REQUEST';
  }
  if (error instanceof ConflictException) {
    return 'CONFLICT';
  }
  return 'CALLBACK_ERROR';
}

function callbackFailureOutcome(error: unknown) {
  return error instanceof ConflictException ? 'CONFLICT' : 'REJECTED';
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Payment callback processing failed';
}

function stringValue(value: unknown) {
  return value === undefined || value === null ? '' : String(value);
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

function hmacHex(algorithm: 'sha256' | 'sha512', secret: string, data: string) {
  return createHmac(algorithm, secret).update(Buffer.from(data, 'utf8')).digest('hex');
}

function secureEqualHex(expected: string, actual: string) {
  const normalizedActual = actual.toLowerCase();
  if (!/^[a-f0-9]+$/i.test(normalizedActual) || expected.length !== normalizedActual.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(normalizedActual, 'hex'));
}

function phpUrlEncode(value: string) {
  return encodeURIComponent(value).replace(/%20/g, '+');
}
