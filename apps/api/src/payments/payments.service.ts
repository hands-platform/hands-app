import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentMethod, PaymentStatus, Prisma, Role } from '@prisma/client';
import { Queue } from 'bullmq';
import { AdminService } from '../admin/admin.service';
import { EarningsService } from '../earnings/earnings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementsService } from '../settlements/settlements.service';
import { CardPaymentAdapter, CashPaymentAdapter, MomoPaymentAdapter, VnpayPaymentAdapter } from './adapters';
import { PaymentAdapter, PaymentOperationResult } from './payment-adapter';
import { availableCustomerCheckoutMethods } from './payment-checkout-methods';
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
import { paymentCaptureUpdateData, paymentRefundRequestCreateData } from './payment-admin-data';
import {
  paymentCaptureSourceStatuses,
  paymentTransitionConflict,
  transitionPaymentStatus,
} from './payment-status-transition';
import { paymentRefundEarningCancellationAudit } from './payment-refund-audit';
import {
  PAYMENT_REFUND_STATUS_QUEUE_NAME,
  paymentRefundStatusJob,
} from './payment-refund-status.queue';
import { paymentUpdatedNotification } from './payments.notifications';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly admin: AdminService,
    private readonly earnings: EarningsService,
    private readonly momo: MomoPaymentAdapter,
    private readonly vnpay: VnpayPaymentAdapter,
    private readonly card: CardPaymentAdapter,
    private readonly cash: CashPaymentAdapter,
    @InjectQueue(PAYMENT_STATUS_CHECK_QUEUE_NAME) private readonly paymentStatusQueue: Queue,
    @InjectQueue(PAYMENT_REFUND_STATUS_QUEUE_NAME) private readonly paymentRefundStatusQueue: Queue,
    private readonly notifications?: NotificationsService,
    private readonly settlements?: SettlementsService,
  ) {}

  customerCheckoutMethods() {
    const methods = availableCustomerCheckoutMethods(
      [this.cash, this.momo, this.vnpay, this.card],
      {
        isProduction: this.config.get<string>('NODE_ENV') === 'production',
        allowPlaceholder:
          this.config
            .get<string>('ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS')
            ?.trim()
            .toLowerCase() === 'true',
        allowRedirectMethods:
          this.config
            .get<string>('CUSTOMER_APP_PAYMENT_REDIRECT_FLOW_ENABLED')
            ?.trim()
            .toLowerCase() === 'true',
      },
    );

    return {
      currency: 'VND',
      defaultMethod: methods[0]?.method ?? PaymentMethod.CASH,
      methods,
    };
  }

  requiresPostBookingAuthorization(method: PaymentMethod) {
    return this.adapterFor(method).mode === 'GATEWAY';
  }

  paymentCanOpenMatching(method: PaymentMethod, status: PaymentStatus) {
    const adapter = this.adapterFor(method);
    if (adapter.mode !== 'GATEWAY') {
      return true;
    }
    return method === PaymentMethod.VNPAY
      ? status === PaymentStatus.CAPTURED
      : isGatewayAuthorizationReady(status);
  }

  paymentRequiresCaptureBeforeMatching(method: PaymentMethod) {
    return this.adapterFor(method).mode === 'GATEWAY' && method === PaymentMethod.VNPAY;
  }

  buildAuthorization(
    method: PaymentMethod,
    amount: number,
    bookingId = 'pending-booking',
    extraRawMeta?: unknown,
  ) {
    const adapter = this.adapterFor(method);
    this.assertAuthorizationAvailable(adapter);
    const authorization = adapter.initialAuthorization({ bookingId, amount, currency: 'VND' });
    const authorizationMeta = asJsonObject(authorization.rawMeta);
    const extraMeta = asJsonObject(extraRawMeta);
    return {
      method: authorization.method,
      amount,
      status: authorization.status,
      providerRef: authorization.providerRef,
      rawMeta: toJsonOrUndefined({
        ...authorizationMeta,
        ...extraMeta,
        ...(adapter.mode === 'GATEWAY' ? { authorizationState: 'PENDING' } : {}),
      }),
    };
  }

  async scheduleStatusCheck(paymentId: string) {
    const job = paymentStatusCheckJob(paymentId);
    await this.paymentStatusQueue.add(job.name, job.data, job.options);
  }

  async scheduleRefundStatusCheck(refundId: string) {
    const job = paymentRefundStatusJob(refundId);
    await this.paymentRefundStatusQueue.add(job.name, job.data, job.options);
  }

  async refreshAuthorizationForBooking(paymentId: string, bookingId: string) {
    const existingPayment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const adapter = this.adapterFor(existingPayment.method);
    this.assertAuthorizationAvailable(adapter);
    let paymentForAuthorization = existingPayment;
    if (adapter.mode === 'GATEWAY') {
      const prepared = adapter.initialAuthorization({
        bookingId,
        paymentId,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
      });
      const transition = await transitionPaymentStatus(this.prisma, {
        data: {
          status: prepared.status,
          providerRef: prepared.providerRef,
          rawMeta: toJsonOrUndefined({
            ...asJsonObject(existingPayment.rawMeta),
            ...asJsonObject(prepared.rawMeta),
            authorizationState: 'INITIALIZING',
            authorizationStartedAt: new Date().toISOString(),
          }),
        },
        fromStatuses: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED],
        paymentId,
        targetStatus: prepared.status,
      });
      paymentForAuthorization = transition.payment;
    }
    let authorization: Awaited<ReturnType<PaymentAdapter['authorize']>>;
    try {
      authorization = await adapter.authorize({
        bookingId,
        paymentId,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
      });
    } catch (error) {
      if (adapter.mode === 'GATEWAY') {
        await this.recordGatewayAuthorizationRetry(paymentForAuthorization, error);
      }
      throw error;
    }

    const { payment } = await transitionPaymentStatus(this.prisma, {
      data: {
        status: authorization.status,
        providerRef: authorization.providerRef,
        rawMeta: toJsonOrUndefined({
          ...asJsonObject(paymentForAuthorization.rawMeta),
          ...asJsonObject(authorization.rawMeta),
          ...(adapter.mode === 'GATEWAY' ? { authorizationState: 'READY' } : {}),
        }),
      },
      fromStatuses: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED],
      paymentId,
      targetStatus: authorization.status,
    });
    return payment;
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
      const adapter = this.adapterFor(paymentMethod);
      parsed = adapter.parseCallback(payload);
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
          const adapter = this.adapterFor(paymentMethod);
          if (adapter.mode === 'GATEWAY' && isGatewayAuthorizationReady(existing.status)) {
            await this.scheduleGatewayStatusCheck(existing.id);
          }
          return { ok: true, replay: true, payment: existing };
        }
        throw new ConflictException('Payment callback conflicts with a terminal payment status');
      }

      const transition = await transitionPaymentStatus(this.prisma, {
        data: {
          status: parsed.status,
          rawMeta: toJsonOrUndefined({
            ...asJsonObject(existing.rawMeta),
            ...callbackRawMeta(parsed.rawMeta, verification),
            ...(adapter.mode === 'GATEWAY'
              ? gatewayAuthorizationEvidence(parsed.status, 'CALLBACK')
              : {}),
          }),
        },
        fromStatuses: [existing.status],
        paymentId: existing.id,
        targetStatus: parsed.status,
      });
      const payment = transition.payment;
      await this.recordCallbackAttempt({
        ...initialEvidence,
        paymentId: payment.id,
        providerRef: parsed.providerRef,
        outcome: transition.transitioned ? 'ACCEPTED' : 'REPLAY',
        signatureVerified: verification.verified,
        verificationMode: verification.mode,
        providerStatus: parsed.status,
        rawPayload: body,
      });
      await this.notifyPaymentUpdated(payment.id);
      if (adapter.mode === 'GATEWAY' && isGatewayAuthorizationReady(payment.status)) {
        await this.scheduleGatewayStatusCheck(payment.id);
      }
      return { ok: true, replay: !transition.transitioned, payment };
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

  async handleVnpayIpn(payload: Record<string, unknown>) {
    try {
      const result = await this.handleCallback(PaymentMethod.VNPAY, payload);
      return result.replay
        ? { RspCode: '02', Message: 'Order already confirmed' }
        : { RspCode: '00', Message: 'Confirm Success' };
    } catch (error) {
      const message = errorMessage(error).toLowerCase();
      if (error instanceof ConflictException) {
        return { RspCode: '02', Message: 'Order already confirmed' };
      }
      if (message.includes('provider reference is unknown')) {
        return { RspCode: '01', Message: 'Order not Found' };
      }
      if (message.includes('amount does not match')) {
        return { RspCode: '04', Message: 'Invalid Amount' };
      }
      if (
        message.includes('callback secret') ||
        message.includes('merchant code') ||
        message.includes('secure hash') ||
        message.includes('signature')
      ) {
        return { RspCode: '97', Message: 'Invalid Checksum' };
      }
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }

  async checkAndSyncStatus(paymentId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (!payment.providerRef) {
      return { skipped: true, reason: 'NO_PROVIDER_REF' };
    }
    const adapter = this.adapterFor(payment.method);
    if (isTerminalPaymentStatus(payment.status)) {
      return {
        skipped: true,
        reason: 'TERMINAL_STATUS',
        paymentId,
        bookingId: payment.bookingId,
        status: payment.status,
        bookingRecoveryReady:
          adapter.mode === 'GATEWAY' &&
          isGatewayAuthorizationReady(payment.status) &&
          asJsonObject(payment.rawMeta).authorizationState === 'READY',
      };
    }

    const operation = await adapter.checkStatus(paymentOperationInput(payment));
    const status = operation.status;
    const { payment: updated } = await transitionPaymentStatus(this.prisma, {
      data: {
        status,
        rawMeta: toJsonOrUndefined({
          ...asJsonObject(payment.rawMeta),
          ...asJsonObject(operation.rawMeta),
          ...(adapter.mode === 'GATEWAY'
            ? gatewayAuthorizationEvidence(status, 'STATUS_QUERY')
            : {}),
        }),
      },
      fromStatuses: [payment.status],
      paymentId: payment.id,
      targetStatus: status,
    });
    await this.notifyPaymentUpdated(updated.id);

    return {
      paymentId,
      bookingId: updated.bookingId,
      status: updated.status,
      bookingRecoveryReady:
        adapter.mode === 'GATEWAY' && isGatewayAuthorizationReady(updated.status),
    };
  }

  private async recordGatewayAuthorizationRetry(
    payment: Awaited<ReturnType<typeof this.prisma.payment.findUniqueOrThrow>>,
    error: unknown,
  ) {
    try {
      await transitionPaymentStatus(this.prisma, {
        data: {
          rawMeta: toJsonOrUndefined({
            ...asJsonObject(payment.rawMeta),
            authorizationState: 'RETRY_PENDING',
            authorizationLastErrorAt: new Date().toISOString(),
            authorizationLastError: errorMessage(error),
          }),
        },
        fromStatuses: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED],
        paymentId: payment.id,
        targetStatus: payment.status,
      });
    } catch (stateError) {
      this.logger.warn(
        `Could not persist gateway retry state for payment ${payment.id}: ${errorMessage(stateError)}`,
      );
    }

    await this.scheduleGatewayStatusCheck(payment.id);
  }

  private async scheduleGatewayStatusCheck(paymentId: string) {
    try {
      await this.scheduleStatusCheck(paymentId);
    } catch (queueError) {
      this.logger.error(
        `Could not schedule gateway status recovery for payment ${paymentId}: ${errorMessage(queueError)}`,
      );
    }
  }

  async syncStatusForAdmin(actorId: string, paymentId: string) {
    const result = await this.checkAndSyncStatus(paymentId);
    await this.admin.writeAudit(actorId, 'payment.sync', `payment:${paymentId}`, toJsonOrUndefined(result));
    return result;
  }

  async capture(actorId: string, paymentId: string) {
    const current = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!current) {
      throw new BadRequestException(`Payment ${paymentId} was not found`);
    }
    if (current.status === PaymentStatus.CAPTURED) {
      return current;
    }
    const captureSourceStatuses = paymentCaptureSourceStatuses(current.method);
    if (!captureSourceStatuses.includes(current.status)) {
      throw paymentTransitionConflict(paymentId, current.status, PaymentStatus.CAPTURED);
    }
    const operation = await this.adapterFor(current.method).capture(paymentOperationInput(current));
    assertPaymentOperationStatus(paymentId, operation.status, PaymentStatus.CAPTURED);
    const { payment } = await transitionPaymentStatus(this.prisma, {
      data: paymentOperationUpdateData(current, operation, paymentCaptureUpdateData()),
      fromStatuses: captureSourceStatuses,
      paymentId,
      targetStatus: PaymentStatus.CAPTURED,
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
    if (payment.status === PaymentStatus.RELEASED) {
      return payment;
    }
    if (payment.status !== PaymentStatus.PENDING && payment.status !== PaymentStatus.AUTHORIZED) {
      throw paymentTransitionConflict(paymentId, payment.status, PaymentStatus.RELEASED);
    }
    const operation = await this.adapterFor(payment.method).release(paymentOperationInput(payment));
    const status = operation.status;
    assertPaymentOperationStatus(paymentId, status, PaymentStatus.RELEASED);
    const { payment: updated } = await transitionPaymentStatus(this.prisma, {
      data: paymentOperationUpdateData(payment, operation, { status }),
      fromStatuses: [payment.status],
      paymentId,
      targetStatus: status,
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

  async closeUnmatchedBookingPayment(paymentId: string, reason: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status !== PaymentStatus.CAPTURED) {
      const releasedPayment = await this.release(paymentId);
      return {
        payment: releasedPayment,
        refundRequested: false,
        released: releasedPayment.status === PaymentStatus.RELEASED,
      };
    }

    const refund = await this.prisma.refund.upsert({
      where: { paymentId },
      create: {
        paymentId,
        bookingId: payment.bookingId,
        amount: payment.amount,
        currency: payment.currency,
        reason,
        status: 'REQUESTED',
        metadata: {
          source: 'UNMATCHED_BOOKING_CLOSE',
          requestedAt: new Date().toISOString(),
        },
      },
      update: {},
    });
    return { payment, refund, refundRequested: true, released: false };
  }

  async refund(actorId: string, paymentId: string, input: { approvalAdminId?: string | null } = {}) {
    const approvalAdminId = normalizePaymentRefundApprovalAdminId(input.approvalAdminId, actorId);
    await assertPaymentRefundApprovalAdmin(this.prisma, approvalAdminId);
    const occurredAt = new Date();
    const current = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!current) {
      throw new BadRequestException(`Payment ${paymentId} was not found`);
    }
    if (current.status !== PaymentStatus.CAPTURED) {
      throw paymentTransitionConflict(paymentId, current.status, PaymentStatus.REFUNDED);
    }
    const refundCreateData = paymentRefundRequestCreateData({
      actorId,
      amount: current.amount,
      approvalAdminId,
      bookingId: current.bookingId,
      currency: current.currency,
      occurredAt,
    });
    let refund = await this.prisma.refund.findUnique({ where: { paymentId } });
    const shouldAttachApprovalContext = refund?.status === 'REQUESTED';
    if (!refund) {
      try {
        refund = await this.prisma.refund.create({
          data: {
            paymentId,
            ...refundCreateData,
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        refund = await this.prisma.refund.findUnique({ where: { paymentId } });
        if (!refund) {
          throw error;
        }
      }
    }

    if (shouldAttachApprovalContext) {
      refund = await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          metadata: toJsonOrUndefined({
            ...asJsonObject(refund.metadata),
            actorId,
            approvalAdminId,
            occurredAt: occurredAt.toISOString(),
          }),
        },
      });
    }

    if (refund.status === 'PROVIDER_PROCESSING') {
      await this.tryScheduleRefundStatusCheck(refund.id);
      return this.prisma.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { refunds: true },
      });
    }

    if (refund.status !== 'GATEWAY_CONFIRMED') {
      try {
        const paymentMeta = asJsonObject(current.rawMeta);
        const operation = await this.adapterFor(current.method).refund({
          ...paymentOperationInput(current),
          refundId: refund.id,
          requestedBy: actorId,
          refundMeta: refund.metadata,
          gatewayTransactionId:
            stringValue(paymentMeta.gatewayTransactionId || paymentMeta.transId) || undefined,
        });
        if (operation.providerFinalized === false) {
          refund = await this.prisma.refund.update({
            where: { id: refund.id },
            data: {
              status: 'PROVIDER_PROCESSING',
              metadata: toJsonOrUndefined({
                ...asJsonObject(refund.metadata),
                ...asJsonObject(operation.rawMeta),
                providerAcceptedAt: new Date().toISOString(),
              }),
            },
          });
          await this.tryScheduleRefundStatusCheck(refund.id);
          await this.admin.writeAudit(actorId, 'payment.refund.provider-processing', `payment:${paymentId}`, {
            approvalAdminId,
            refundId: refund.id,
            status: refund.status,
          });
          return this.prisma.payment.findUniqueOrThrow({
            where: { id: paymentId },
            include: { refunds: true },
          });
        }
        assertPaymentOperationStatus(paymentId, operation.status, PaymentStatus.REFUNDED);
        refund = await this.prisma.refund.update({
          where: { id: refund.id },
          data: {
            status: 'GATEWAY_CONFIRMED',
            metadata: toJsonOrUndefined({
              ...asJsonObject(refund.metadata),
              ...asJsonObject(operation.rawMeta),
              gatewayConfirmedAt: new Date().toISOString(),
            }),
          },
        });
      } catch (error) {
        await this.recordRefundGatewayFailure(refund, error);
        throw error;
      }
    }

    return this.finalizeRefund({ actorId, approvalAdminId, occurredAt, paymentId, refund });
  }

  async checkAndFinalizeRefund(refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { payment: true },
    });
    if (!refund) {
      throw new BadRequestException(`Refund ${refundId} was not found`);
    }
    if (refund.status === 'COMPLETED') {
      return { completed: true, paymentId: refund.paymentId, refundId };
    }
    if (refund.status !== 'PROVIDER_PROCESSING' && refund.status !== 'GATEWAY_CONFIRMED') {
      throw new ConflictException(`Refund ${refundId} cannot be checked from status ${refund.status}`);
    }

    const audit = refundAuditContext(refund.metadata, refundId);
    let refundForFinalization: { id: string; metadata: unknown } = refund;
    if (refund.status === 'PROVIDER_PROCESSING') {
      const paymentMeta = asJsonObject(refund.payment.rawMeta);
      const operation = await this.adapterFor(refund.payment.method).checkRefund({
        ...paymentOperationInput(refund.payment),
        refundId,
        requestedBy: audit.actorId,
        refundMeta: refund.metadata,
        gatewayTransactionId:
          stringValue(paymentMeta.gatewayTransactionId || paymentMeta.transId) || undefined,
      });
      if (operation.providerFinalized === false) {
        await this.prisma.refund.update({
          where: { id: refundId },
          data: {
            status: 'PROVIDER_PROCESSING',
            metadata: toJsonOrUndefined({
              ...asJsonObject(refund.metadata),
              ...asJsonObject(operation.rawMeta),
              providerLastCheckedAt: new Date().toISOString(),
            }),
          },
        });
        return { completed: false, paymentId: refund.paymentId, refundId };
      }
      assertPaymentOperationStatus(refund.paymentId, operation.status, PaymentStatus.REFUNDED);
      refundForFinalization = await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: 'GATEWAY_CONFIRMED',
          metadata: toJsonOrUndefined({
            ...asJsonObject(refund.metadata),
            ...asJsonObject(operation.rawMeta),
            gatewayConfirmedAt: new Date().toISOString(),
            providerLastCheckedAt: new Date().toISOString(),
          }),
        },
      });
    }

    await this.finalizeRefund({
      actorId: audit.actorId,
      approvalAdminId: audit.approvalAdminId,
      occurredAt: audit.occurredAt,
      paymentId: refund.paymentId,
      refund: refundForFinalization,
    });
    return { completed: true, paymentId: refund.paymentId, refundId };
  }

  private async finalizeRefund(input: {
    actorId: string;
    approvalAdminId: string;
    occurredAt: Date;
    paymentId: string;
    refund: { id: string; metadata: unknown };
  }) {
    const { actorId, approvalAdminId, occurredAt, paymentId, refund } = input;

    let settlementReversal: Prisma.InputJsonObject = { skipped: true, reason: 'NOT_ATTEMPTED' };
    let earningCancellation: Awaited<ReturnType<EarningsService['cancelForRefund']>> = {
      skipped: true,
      reason: 'NOT_ATTEMPTED',
    };
    const payment = await this.prisma.$transaction(async (tx) => {
      const transition = await transitionPaymentStatus(tx, {
        data: { status: PaymentStatus.REFUNDED },
        fromStatuses: [PaymentStatus.CAPTURED],
        idempotentTarget: false,
        paymentId,
        targetStatus: PaymentStatus.REFUNDED,
      });
      await tx.booking.update({
        where: { id: transition.payment.bookingId },
        data: { status: BookingStatus.REFUNDED },
      });
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: 'COMPLETED',
          metadata: toJsonOrUndefined({
            ...asJsonObject(refund.metadata),
            completedAt: new Date().toISOString(),
          }),
        },
      });
      settlementReversal = paymentSettlementReversalAudit(
        await this.settlements?.reverseBookingSettlementSnapshotForRefund(
          {
            actorId,
            bookingId: transition.payment.bookingId,
            occurredAt,
            reason: 'Admin manual refund',
          },
          tx,
        ),
      );
      earningCancellation = await this.earnings.cancelForRefund(transition.payment.bookingId, tx);
      return tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { refunds: true } });
    });

    await this.admin.writeAudit(actorId, 'payment.refund', `payment:${paymentId}`, {
      ...paymentRefundAuditMetadata(payment, paymentRefundEarningCancellationAudit(earningCancellation)),
      approvalAdminId,
      settlementReversal,
    });
    await this.notifyPaymentUpdated(payment.id);

    return payment;
  }

  private async tryScheduleRefundStatusCheck(refundId: string) {
    try {
      await this.scheduleRefundStatusCheck(refundId);
    } catch (error) {
      this.logger.error(
        `Could not schedule provider refund status check for refund ${refundId}: ${errorMessage(error)}`,
      );
    }
  }

  private async recordRefundGatewayFailure(
    refund: { id: string; metadata: unknown },
    error: unknown,
  ) {
    try {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: 'REQUESTED',
          metadata: toJsonOrUndefined({
            ...asJsonObject(refund.metadata),
            gatewayLastError: errorMessage(error),
            gatewayLastErrorAt: new Date().toISOString(),
          }),
        },
      });
    } catch (stateError) {
      this.logger.warn(
        `Could not persist gateway refund retry state for refund ${refund.id}: ${errorMessage(stateError)}`,
      );
    }
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
    if (method === PaymentMethod.CARD) {
      return this.card;
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
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const allowsUnverifiedDevelopmentCallbacks =
      this.config.get<string>('ALLOW_UNVERIFIED_PAYMENT_CALLBACKS')?.trim().toLowerCase() === 'true';
    if (!isProduction && allowsUnverifiedDevelopmentCallbacks) {
      return null;
    }
    throw new BadRequestException(`${method} callback secret is not configured`);
  }

  private assertAuthorizationAvailable(adapter: PaymentAdapter) {
    if (adapter.mode !== 'PLACEHOLDER') {
      return;
    }

    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const allowsLocalPlaceholder =
      this.config.get<string>('ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS')?.trim().toLowerCase() === 'true';
    if (!isProduction && allowsLocalPlaceholder) {
      return;
    }

    throw new BadRequestException(
      `${adapter.method} checkout is unavailable until the real payment gateway adapter is configured`,
    );
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

function isGatewayAuthorizationReady(status: PaymentStatus) {
  return (
    status === PaymentStatus.PENDING ||
    status === PaymentStatus.AUTHORIZED ||
    status === PaymentStatus.CAPTURED
  );
}

function gatewayAuthorizationEvidence(status: PaymentStatus, source: 'CALLBACK' | 'STATUS_QUERY') {
  return {
    authorizationState: isGatewayAuthorizationReady(status) ? 'READY' : 'FAILED',
    authorizationVerifiedAt: new Date().toISOString(),
    authorizationVerifiedBy: source,
  };
}

type PaymentOperationRecord = {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  providerRef: string | null;
  rawMeta: unknown;
};

function paymentOperationInput(payment: PaymentOperationRecord) {
  const rawMeta = asJsonObject(payment.rawMeta);
  return {
    paymentId: payment.id,
    bookingId: payment.bookingId,
    amount: payment.amount,
    currency: payment.currency,
    providerRef: payment.providerRef,
    ...(Object.keys(rawMeta).length > 0 ? { rawMeta: payment.rawMeta } : {}),
  };
}

function paymentOperationUpdateData(
  payment: PaymentOperationRecord,
  operation: PaymentOperationResult,
  base: Prisma.PaymentUpdateManyMutationInput,
) {
  const operationMeta = asJsonObject(operation.rawMeta);
  if (Object.keys(operationMeta).length === 0) {
    return base;
  }
  return {
    ...base,
    rawMeta: toJsonOrUndefined({
      ...asJsonObject(payment.rawMeta),
      ...operationMeta,
    }),
  };
}

function assertPaymentOperationStatus(
  paymentId: string,
  actualStatus: PaymentStatus,
  expectedStatus: PaymentStatus,
) {
  if (actualStatus !== expectedStatus) {
    throw new ConflictException(
      `Payment ${paymentId} gateway operation returned ${actualStatus} instead of ${expectedStatus}`,
    );
  }
}

function refundAuditContext(metadata: unknown, refundId: string) {
  const record = asJsonObject(metadata);
  const actorId = stringValue(record.actorId);
  const approvalAdminId = stringValue(record.approvalAdminId);
  const occurredAtValue = stringValue(record.occurredAt);
  const occurredAt = occurredAtValue ? new Date(occurredAtValue) : null;
  if (!actorId || !approvalAdminId || !occurredAt || Number.isNaN(occurredAt.getTime())) {
    throw new BadRequestException(`Refund ${refundId} is missing immutable approval audit context`);
  }
  return { actorId, approvalAdminId, occurredAt };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

type PaymentApprovalLookupDb = Partial<Pick<Prisma.TransactionClient, 'user'>>;

function normalizePaymentRefundApprovalAdminId(value: string | null | undefined, actorId: string) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized === actorId) {
    throw new BadRequestException('Payment refund requires approval from a different admin');
  }
  return normalized;
}

async function assertPaymentRefundApprovalAdmin(db: PaymentApprovalLookupDb, approvalAdminId: string) {
  const userDelegate = db.user;
  if (!userDelegate?.findFirst) {
    return;
  }

  const approver = await userDelegate.findFirst({
    where: { id: approvalAdminId, roles: { has: Role.FINANCE_APPROVER } },
    select: { id: true },
  });
  if (!approver) {
    throw new BadRequestException('Payment refund requires approval from a finance approver');
  }
}

function paymentSettlementReversalAudit(result: unknown): Prisma.InputJsonObject {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { skipped: true, reason: 'NO_SETTLEMENT_SERVICE' };
  }
  const record = result as Record<string, unknown>;
  if (record.skipped) {
    return {
      skipped: true,
      reason: stringValue(record.reason) ?? 'UNKNOWN',
    };
  }
  const metadata = asJsonObject(record.metadata);
  return {
    skipped: false,
    couponReversalStatus: stringValue(metadata.couponReversalStatus),
    settlementId: stringValue(record.id),
    settlementStatus: stringValue(record.settlementStatus),
    taxStatus: stringValue(record.taxStatus),
  };
}
