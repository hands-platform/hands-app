import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@prisma/client';
import { Queue } from 'bullmq';
import { AdminService } from '../admin/admin.service';
import { EarningsService } from '../earnings/earnings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CashPaymentAdapter, MomoPaymentAdapter, VnpayPaymentAdapter } from './adapters';
import { PaymentAdapter } from './payment-adapter';
import {
  asJsonObject,
  callbackAttemptCreateData,
  callbackAmountVnd,
  callbackAttemptEvidence,
  callbackFailureOutcome,
  callbackRawMeta,
  errorCode,
  errorMessage,
  hmacHex,
  isTerminalPaymentStatus,
  momoSignatureCandidates,
  secureEqualHex,
  stringValue,
  toJsonOrUndefined,
  type PaymentCallbackAttemptInput,
  vnpaySignatureCandidates,
} from './payment-callback.helpers';
import { PAYMENT_STATUS_CHECK_QUEUE_NAME, paymentStatusCheckJob } from './payment-status.queue';
import {
  paymentCaptureAuditMetadata,
  paymentRefundAuditMetadata,
  paymentReleaseAuditMetadata,
} from './payment-admin-audit';
import { paymentCaptureUpdateData, paymentRefundUpdateData } from './payment-admin-data';
import { paymentRefundEarningCancellationAudit } from './payment-refund-audit';
import { paymentUpdatedNotification } from './payments.notifications';

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
    @InjectQueue(PAYMENT_STATUS_CHECK_QUEUE_NAME) private readonly paymentStatusQueue: Queue,
    private readonly notifications?: NotificationsService,
  ) {}

  buildAuthorization(
    method: PaymentMethod,
    amount: number,
    bookingId = 'pending-booking',
    extraRawMeta?: unknown,
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
    const job = paymentStatusCheckJob(paymentId);
    await this.paymentStatusQueue.add(job.name, job.data, job.options);
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
        rawMeta: toJsonOrUndefined({
          ...asJsonObject(payment.rawMeta),
          ...asJsonObject(authorization.rawMeta),
        }),
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
      data: paymentCaptureUpdateData(),
    });

    await this.admin.writeAudit(
      actorId,
      'payment.capture',
      `payment:${paymentId}`,
      paymentCaptureAuditMetadata(payment),
    );
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
    await this.admin.writeAudit(
      actorId,
      'payment.release',
      `payment:${paymentId}`,
      paymentReleaseAuditMetadata(payment),
    );
    return payment;
  }

  async refund(actorId: string, paymentId: string) {
    const existing = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: paymentRefundUpdateData({ bookingId: existing.bookingId, amount: existing.amount }),
      include: { refunds: true },
    });
    const earningCancellation = await this.earnings.cancelForRefund(existing.bookingId);

    await this.admin.writeAudit(actorId, 'payment.refund', `payment:${paymentId}`, {
      ...paymentRefundAuditMetadata(payment, paymentRefundEarningCancellationAudit(earningCancellation)),
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
      ...paymentUpdatedNotification({ paymentId: payment.id, bookingId: payment.bookingId }),
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

  private async recordCallbackAttempt(input: PaymentCallbackAttemptInput) {
    try {
      await this.prisma.paymentCallbackAttempt.create({
        data: callbackAttemptCreateData(input),
      });
    } catch {
      // Callback verification decisions must not become unavailable because audit storage failed.
    }
  }
}
