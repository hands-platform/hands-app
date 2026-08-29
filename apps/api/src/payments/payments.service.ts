import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  CustomerWalletLedgerType,
  PaymentMethod,
  PaymentAdminOperationStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { AdminService } from '../admin/admin.service';
import { assertVerifiedFinanceApprover } from '../admin/finance-approver-policy';
import { EarningsService } from '../earnings/earnings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementsService } from '../settlements/settlements.service';
import {
  CardPaymentAdapter,
  CashPaymentAdapter,
  CustomerWalletPaymentAdapter,
  MomoPaymentAdapter,
  VnpayPaymentAdapter,
} from './adapters';
import {
  customerWalletBookingLockKey,
  customerWalletPaymentRefundSourceKey,
  customerWalletPaymentReleaseSourceKey,
  customerWalletPaymentSourceKey,
} from './customer-wallet-payment';
import { PaymentAdapter, PaymentOperationResult } from './payment-adapter';
import { availableCustomerCheckoutMethods } from './payment-checkout-methods';
import {
  asJsonObject,
  callbackAttemptCreateData,
  callbackAmountVnd,
  callbackAttemptEvidence,
  callbackEvidenceErrorMessage,
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
import { paymentCaptureAuditMetadata, paymentRefundAuditMetadata } from './payment-admin-audit';
import { paymentCaptureUpdateData, paymentRefundRequestCreateData } from './payment-admin-data';
import {
  paymentCaptureSourceStatuses,
  paymentTransitionConflict,
  transitionPaymentStatus,
} from './payment-status-transition';
import { paymentRefundEarningCancellationAudit } from './payment-refund-audit';
import { PAYMENT_REFUND_STATUS_QUEUE_NAME, paymentRefundStatusJob } from './payment-refund-status.queue';
import { paymentUpdatedNotification } from './payments.notifications';
import {
  type PaymentActionDecisionRecord,
  type PaymentAdminAction,
  paymentActionCanExecute,
  paymentActionDecision,
} from './payment-action-decision';

export type PaymentActionReceipt = {
  readonly auditId: string;
  readonly paymentId: string;
  readonly action: PaymentAdminAction;
  readonly before: { readonly paymentStatus: string; readonly bookingStatus: string };
  readonly after: { readonly paymentStatus: string; readonly bookingStatus: string };
  readonly actorId: string;
  readonly completedAt: string;
  readonly idempotencyKey: string;
};

type AdminPaymentActionRecord = PaymentActionDecisionRecord & {
  readonly id: string;
  readonly booking: NonNullable<PaymentActionDecisionRecord['booking']> & {
    readonly status: string;
  };
};

const paymentAdminOperationClaimReplaySelect = {
  errorCode: true,
  errorMessage: true,
  id: true,
  receipt: true,
  requestHash: true,
  status: true,
} satisfies Prisma.PaymentAdminOperationClaimSelect;

const REFUND_BOOKING_SOURCE_STATUSES = [
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.NO_SHOW,
  BookingStatus.EXPIRED,
  BookingStatus.REFUNDED,
] as const;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly customerWallet = new CustomerWalletPaymentAdapter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AdminService))
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
      [this.cash, this.customerWallet, this.momo, this.vnpay, this.card],
      {
        isProduction: this.config.get<string>('NODE_ENV') === 'production',
        allowPlaceholder:
          this.config.get<string>('ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS')?.trim().toLowerCase() ===
          'true',
        allowRedirectMethods:
          this.config.get<string>('CUSTOMER_APP_PAYMENT_REDIRECT_FLOW_ENABLED')?.trim().toLowerCase() ===
          'true',
      },
    );

    return {
      currency: 'VND',
      defaultMethod: methods[0]?.method ?? PaymentMethod.CASH,
      methods,
    };
  }

  async customerCheckoutAction(customerUserId: string, bookingId: string) {
    const payment = await this.prisma.payment.findFirstOrThrow({
      where: {
        bookingId,
        booking: { customerProfile: { userId: customerUserId } },
      },
      select: {
        bookingId: true,
        id: true,
        method: true,
        rawMeta: true,
        status: true,
      },
    });
    const checkoutUrl = stringValue(asJsonObject(payment.rawMeta).checkoutUrl);
    if (!checkoutUrl) {
      throw new BadRequestException('This payment does not require an external checkout');
    }

    return {
      bookingId: payment.bookingId,
      checkoutUrl,
      method: payment.method,
      paymentId: payment.id,
      status: payment.status,
    };
  }

  requiresPostBookingAuthorization(method: PaymentMethod) {
    return method === PaymentMethod.CUSTOMER_WALLET || this.adapterFor(method).mode === 'GATEWAY';
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

  paymentRequiresGatewayCaptureForBookingCompletion(method: PaymentMethod, status: PaymentStatus) {
    return this.adapterFor(method).mode === 'GATEWAY' && status !== PaymentStatus.CAPTURED;
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
        where: { rawMeta: { path: ['authorizationState'], equals: 'PENDING' } },
      });
      paymentForAuthorization = transition.payment;
      if (!transition.transitioned) {
        return paymentForAuthorization;
      }
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
    this.assertPublicCallbackMethod(paymentMethod);
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
      this.assertCallbackMatchesPayment(paymentMethod, payload, existing, verification.verified);

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
          if (
            adapter.mode === 'GATEWAY' &&
            (isGatewayAuthorizationReady(existing.status) || existing.status === PaymentStatus.FAILED)
          ) {
            await this.scheduleGatewayStatusCheck(existing.id);
          }
          return { ok: true, replay: true };
        }
        throw new ConflictException('Payment callback conflicts with a terminal payment status');
      }

      const acceptedCallback = parsed;
      const acceptedPayment = existing;
      const acceptedVerification = verification;
      const transition = await this.prisma.$transaction(async (transaction) => {
        const result = await transitionPaymentStatus(transaction, {
          data: {
            status: acceptedCallback.status,
            rawMeta: toJsonOrUndefined({
              ...asJsonObject(acceptedPayment.rawMeta),
              ...callbackRawMeta(acceptedCallback.rawMeta, acceptedVerification),
              ...(adapter.mode === 'GATEWAY'
                ? gatewayAuthorizationEvidence(acceptedCallback.status, 'CALLBACK')
                : {}),
            }),
          },
          fromStatuses: [acceptedPayment.status],
          paymentId: acceptedPayment.id,
          targetStatus: acceptedCallback.status,
        });
        await transaction.paymentCallbackAttempt.create({
          data: callbackAttemptCreateData({
            ...initialEvidence,
            paymentId: result.payment.id,
            providerRef: acceptedCallback.providerRef,
            outcome: result.transitioned ? 'ACCEPTED' : 'REPLAY',
            signatureVerified: acceptedVerification.verified,
            verificationMode: acceptedVerification.mode,
            providerStatus: acceptedCallback.status,
            rawPayload: body,
          }),
        });
        return result;
      });
      const payment = transition.payment;
      await this.notifyPaymentUpdated(payment.id);
      if (
        adapter.mode === 'GATEWAY' &&
        (isGatewayAuthorizationReady(payment.status) || payment.status === PaymentStatus.FAILED)
      ) {
        await this.scheduleGatewayStatusCheck(payment.id);
      }
      return { ok: true, replay: !transition.transitioned };
    } catch (error) {
      try {
        await this.recordCallbackAttempt({
          ...initialEvidence,
          paymentId: existing?.id ?? null,
          providerRef: parsed?.providerRef || initialEvidence.providerRef,
          outcome: callbackFailureOutcome(error),
          signatureVerified: verification?.verified ?? null,
          verificationMode: verification?.mode ?? null,
          providerStatus: parsed?.status ?? initialEvidence.providerStatus,
          errorCode: errorCode(error),
          errorMessage: callbackEvidenceErrorMessage(error),
          rawPayload: body,
        });
      } catch {
        this.logger.error(`Payment callback evidence could not be recorded for ${paymentMethod}`);
        throw new ServiceUnavailableException('Payment callback evidence is temporarily unavailable');
      }
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
      if (adapter.mode === 'GATEWAY' && payment.status === PaymentStatus.FAILED) {
        await this.scheduleGatewayStatusCheck(payment.id);
      }
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
          ...(adapter.mode === 'GATEWAY' ? gatewayAuthorizationEvidence(status, 'STATUS_QUERY') : {}),
        }),
      },
      fromStatuses: [payment.status],
      paymentId: payment.id,
      targetStatus: status,
    });
    await this.notifyPaymentUpdated(updated.id);
    if (adapter.mode === 'GATEWAY' && updated.status === PaymentStatus.FAILED) {
      await this.scheduleGatewayStatusCheck(updated.id);
    }

    return {
      paymentId,
      bookingId: updated.bookingId,
      status: updated.status,
      bookingRecoveryReady: adapter.mode === 'GATEWAY' && isGatewayAuthorizationReady(updated.status),
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

  async syncStatusForAdmin(
    actorId: string,
    paymentId: string,
    input: { idempotencyKey: string; reason?: string | null },
  ) {
    return this.executeAdminPaymentAction({
      action: 'SYNC',
      actorId,
      execute: () => this.checkAndSyncStatus(paymentId),
      idempotencyKey: input.idempotencyKey,
      paymentId,
      reason: input.reason,
    });
  }

  async captureForAdmin(
    actorId: string,
    paymentId: string,
    input: { idempotencyKey: string; reason?: string | null },
  ) {
    await assertVerifiedFinanceApprover(this.prisma, actorId, 'Payment capture');
    return this.executeAdminPaymentAction({
      action: 'CAPTURE',
      actorId,
      execute: () => this.capture(actorId, paymentId),
      idempotencyKey: input.idempotencyKey,
      paymentId,
      reason: input.reason,
    });
  }

  async confirmGatewayCaptureForBookingCompletion(actorId: string, bookingId: string) {
    const current = await this.prisma.payment.findUnique({ where: { bookingId } });
    if (!current) {
      throw new BadRequestException(`Payment for booking ${bookingId} was not found`);
    }
    if (this.adapterFor(current.method).mode !== 'GATEWAY' || current.status === PaymentStatus.CAPTURED) {
      return current;
    }
    return this.capture(actorId, current.id);
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
    const current = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (current.status === PaymentStatus.RELEASED) {
      return current;
    }
    if (current.method === PaymentMethod.CUSTOMER_WALLET) {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`payment-release:${paymentId}`}, 0))::text AS "lockResult"`,
        );
        const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
        if (payment.status === PaymentStatus.RELEASED) {
          return { payment, transitioned: false };
        }
        return {
          payment: await this.releaseCustomerWalletPayment(payment, tx),
          transitioned: true,
        };
      });
      if (result.transitioned) {
        await this.notifyPaymentUpdated(result.payment.id);
      }
      return result.payment;
    }
    if (current.status !== PaymentStatus.PENDING && current.status !== PaymentStatus.AUTHORIZED) {
      throw paymentTransitionConflict(current.id, current.status, PaymentStatus.RELEASED);
    }

    const operation = await this.adapterFor(current.method).release(paymentOperationInput(current));
    assertPaymentOperationStatus(current.id, operation.status, PaymentStatus.RELEASED);
    const result = await transitionPaymentStatus(this.prisma, {
      data: paymentOperationUpdateData(current, operation, { status: operation.status }),
      fromStatuses: [current.status],
      paymentId: current.id,
      targetStatus: operation.status,
    });
    if (result.transitioned) {
      await this.notifyPaymentUpdated(result.payment.id);
    }
    return result.payment;
  }

  async releaseForAdmin(
    actorId: string,
    paymentId: string,
    input: { idempotencyKey: string; reason?: string | null },
  ) {
    await assertVerifiedFinanceApprover(this.prisma, actorId, 'Payment release');
    return this.executeAdminPaymentAction({
      action: 'RELEASE',
      actorId,
      execute: () => this.release(paymentId),
      idempotencyKey: input.idempotencyKey,
      paymentId,
      reason: input.reason,
    });
  }

  async requestRefundForAdmin(
    actorId: string,
    paymentId: string,
    input: { idempotencyKey?: string | null; reason?: string | null },
  ) {
    const idempotencyKey = input.idempotencyKey?.trim() || `refund-request:${paymentId}:${randomUUID()}`;
    return this.executeAdminPaymentAction({
      action: 'REQUEST_REFUND',
      actorId,
      execute: () => this.requestRefund(actorId, paymentId, input),
      idempotencyKey,
      paymentId,
      reason: input.reason,
    });
  }

  async closeUnmatchedBookingPayment(
    paymentId: string,
    reason: string,
    request: { requestedByAdminId?: string; source?: string } = {},
  ) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status === PaymentStatus.RELEASED || payment.status === PaymentStatus.REFUNDED) {
      return {
        payment,
        refundRequested: payment.status === PaymentStatus.REFUNDED,
        released: payment.status === PaymentStatus.RELEASED,
      };
    }
    if (payment.status !== PaymentStatus.CAPTURED) {
      const releasedPayment = await this.release(paymentId);
      return {
        payment: releasedPayment,
        refundRequested: false,
        released: releasedPayment.status === PaymentStatus.RELEASED,
      };
    }

    const requestedAt = new Date();
    const refund = await this.prisma.refund.upsert({
      where: { paymentId },
      create: {
        paymentId,
        ...paymentRefundRequestCreateData({
          amount: payment.amount,
          bookingId: payment.bookingId,
          currency: payment.currency,
          reason,
          requestedAt,
          requestedByAdminId: request.requestedByAdminId,
          source: request.source ?? 'UNMATCHED_BOOKING_CLOSE',
        }),
      },
      update: {},
    });
    return { payment, refund, refundRequested: true, released: false };
  }

  async notifyPaymentUpdatedAfterCommit(paymentId: string) {
    try {
      await this.notifyPaymentUpdated(paymentId);
    } catch (error) {
      this.logger.warn(`Could not notify payment update for ${paymentId}: ${errorMessage(error)}`);
    }
  }

  async requestRefund(actorId: string, paymentId: string, input: { reason?: string | null } = {}) {
    const requestedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`payment-refund:${paymentId}`}, 0))::text AS "lockResult"`,
      );
      const current = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!current) {
        throw new BadRequestException(`Payment ${paymentId} was not found`);
      }
      if (current.status !== PaymentStatus.CAPTURED) {
        throw paymentTransitionConflict(paymentId, current.status, PaymentStatus.REFUNDED);
      }
      await this.assertBookingCanBeRefunded(tx, current.bookingId);

      const createData = paymentRefundRequestCreateData({
        amount: current.amount,
        bookingId: current.bookingId,
        currency: current.currency,
        reason: stringValue(input.reason) ?? 'Admin manual refund',
        requestedAt,
        requestedByAdminId: actorId,
        source: 'ADMIN_MANUAL',
      });
      let refund = await tx.refund.findUnique({ where: { paymentId } });
      let created = false;
      if (!refund) {
        refund = await tx.refund.upsert({
          where: { paymentId },
          create: {
            paymentId,
            ...createData,
          },
          update: {},
        });
        const requestMetadata = asJsonObject(refund.metadata);
        created =
          stringValue(requestMetadata.requestedAt) === requestedAt.toISOString() &&
          stringValue(requestMetadata.requestedByAdminId) === actorId;
      } else if (refund.status === 'REJECTED') {
        const reset = await tx.refund.updateMany({
          where: { id: refund.id, status: 'REJECTED' },
          data: createData,
        });
        if (reset.count !== 1) {
          throw new ConflictException(`Refund ${refund.id} request was already changed`);
        }
        refund = await tx.refund.findUniqueOrThrow({ where: { id: refund.id } });
        created = true;
      }

      if (refund.status !== 'REQUESTED') {
        throw new ConflictException(`Refund ${refund.id} cannot be requested from status ${refund.status}`);
      }
      if (created) {
        await this.admin.writeAudit(
          actorId,
          'payment.refund.request',
          `payment:${paymentId}`,
          {
            refundId: refund.id,
            requestedAt: requestedAt.toISOString(),
          },
          undefined,
          tx,
        );
      }
      return tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { refunds: true },
      });
    });
  }

  async refund(actorId: string, paymentId: string) {
    const occurredAt = new Date();
    const approval = await this.prisma.$transaction(async (tx) => {
      await assertPaymentRefundApprovalAdmin(tx, actorId);
      const current = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!current) {
        throw new BadRequestException(`Payment ${paymentId} was not found`);
      }
      if (current.status !== PaymentStatus.CAPTURED) {
        throw paymentTransitionConflict(paymentId, current.status, PaymentStatus.REFUNDED);
      }
      await this.assertBookingCanBeRefunded(tx, current.bookingId);
      const refund = await tx.refund.findUnique({ where: { paymentId } });
      if (!refund) {
        throw new ConflictException('Payment refund must be requested before finance approval');
      }
      if (
        refund.status === 'APPROVAL_PROCESSING' ||
        refund.status === 'PROVIDER_PROCESSING' ||
        refund.status === 'GATEWAY_CONFIRMED'
      ) {
        return { current, mode: 'RECOVERY' as const, refund };
      }
      if (refund.status !== 'REQUESTED') {
        throw new ConflictException(`Refund ${refund.id} cannot be approved from status ${refund.status}`);
      }
      const requestContext = paymentRefundRequestContext(refund.metadata);
      assertIndependentPaymentRefundApprover(requestContext.requestedByAdminId, actorId);
      const approvalMetadata = {
        ...asJsonObject(refund.metadata),
        approvalAdminId: actorId,
        approvedAt: occurredAt.toISOString(),
        occurredAt: occurredAt.toISOString(),
      };
      const approvalClaim = await tx.refund.updateMany({
        where: { id: refund.id, status: 'REQUESTED' },
        data: {
          status: 'APPROVAL_PROCESSING',
          metadata: toJsonOrUndefined(approvalMetadata),
        },
      });
      if (approvalClaim.count !== 1) {
        throw new ConflictException(`Refund ${refund.id} approval was already claimed`);
      }
      await this.admin.writeAudit(
        actorId,
        'payment.refund.approval.claim',
        `payment:${paymentId}`,
        {
          approvalAdminId: actorId,
          approvedAt: occurredAt.toISOString(),
          refundId: refund.id,
          requestedByAdminId: requestContext.requestedByAdminId,
        },
        undefined,
        tx,
      );
      return {
        current,
        mode: 'CLAIMED' as const,
        refund: { id: refund.id, metadata: approvalMetadata, status: 'APPROVAL_PROCESSING' },
        requestContext,
      };
    });

    if (approval.mode === 'RECOVERY') {
      await this.checkAndFinalizeRefund(approval.refund.id);
      return this.prisma.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { refunds: true },
      });
    }
    const { current, requestContext } = approval;
    let refundInProgress: { id: string; metadata: unknown; status: string } = approval.refund;

    try {
      const paymentMeta = asJsonObject(current.rawMeta);
      const operation = await this.adapterFor(current.method).refund({
        ...paymentOperationInput(current),
        refundId: refundInProgress.id,
        requestedBy: actorId,
        refundMeta: refundInProgress.metadata,
        gatewayTransactionId:
          stringValue(paymentMeta.gatewayTransactionId || paymentMeta.transId) || undefined,
      });
      if (operation.providerFinalized === false) {
        refundInProgress = await advanceRefundStatus(this.prisma, {
          refund: refundInProgress,
          fromStatuses: ['APPROVAL_PROCESSING'],
          metadata: {
            ...asJsonObject(refundInProgress.metadata),
            ...asJsonObject(operation.rawMeta),
            providerAcceptedAt: new Date().toISOString(),
          },
          targetStatus: 'PROVIDER_PROCESSING',
        });
        if (refundInProgress.status !== 'PROVIDER_PROCESSING') {
          if (refundInProgress.status === 'GATEWAY_CONFIRMED') {
            await this.checkAndFinalizeRefund(refundInProgress.id);
          }
          return this.prisma.payment.findUniqueOrThrow({
            where: { id: paymentId },
            include: { refunds: true },
          });
        }
        await this.tryScheduleRefundStatusCheck(refundInProgress.id);
        await this.admin.writeAudit(actorId, 'payment.refund.provider-processing', `payment:${paymentId}`, {
          approvalAdminId: actorId,
          requestedByAdminId: requestContext.requestedByAdminId,
          refundId: refundInProgress.id,
          status: refundInProgress.status,
        });
        return this.prisma.payment.findUniqueOrThrow({
          where: { id: paymentId },
          include: { refunds: true },
        });
      }
      assertPaymentOperationStatus(paymentId, operation.status, PaymentStatus.REFUNDED);
      refundInProgress = await advanceRefundStatus(this.prisma, {
        refund: refundInProgress,
        fromStatuses: ['APPROVAL_PROCESSING', 'PROVIDER_PROCESSING'],
        metadata: {
          ...asJsonObject(refundInProgress.metadata),
          ...asJsonObject(operation.rawMeta),
          gatewayConfirmedAt: new Date().toISOString(),
        },
        targetStatus: 'GATEWAY_CONFIRMED',
      });
      if (refundInProgress.status === 'COMPLETED') {
        return this.prisma.payment.findUniqueOrThrow({
          where: { id: paymentId },
          include: { refunds: true },
        });
      }
    } catch (error) {
      await this.recordRefundGatewayFailure(refundInProgress, error);
      throw error;
    }

    return this.finalizeRefund({
      actorId,
      approvalAdminId: actorId,
      occurredAt,
      paymentId,
      refund: refundInProgress,
      requestedByAdminId: requestContext.requestedByAdminId,
    });
  }

  async rejectRefund(actorId: string, refundId: string, reason: string) {
    const rejectedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      await assertPaymentRefundApprovalAdmin(tx, actorId);
      const refund = await tx.refund.findUnique({ where: { id: refundId } });
      if (!refund) {
        throw new BadRequestException(`Refund ${refundId} was not found`);
      }
      if (refund.status !== 'REQUESTED') {
        throw new ConflictException(`Refund ${refundId} cannot be rejected from status ${refund.status}`);
      }
      const requestContext = paymentRefundRequestContext(refund.metadata);
      assertIndependentPaymentRefundApprover(requestContext.requestedByAdminId, actorId);
      const claim = await tx.refund.updateMany({
        where: { id: refundId, status: 'REQUESTED' },
        data: {
          status: 'REJECTED',
          metadata: toJsonOrUndefined({
            ...asJsonObject(refund.metadata),
            rejectionAdminId: actorId,
            rejectionReason: reason,
            rejectedAt: rejectedAt.toISOString(),
          }),
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException(`Refund ${refundId} decision was already claimed`);
      }
      await this.admin.writeAudit(
        actorId,
        'payment.refund.reject',
        `payment:${refund.paymentId}`,
        {
          reason,
          refundId,
          requestedByAdminId: requestContext.requestedByAdminId,
        },
        undefined,
        tx,
      );
      return {
        id: refundId,
        paymentId: refund.paymentId,
        status: 'REJECTED',
      };
    });
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
    if (
      refund.status !== 'APPROVAL_PROCESSING' &&
      refund.status !== 'PROVIDER_PROCESSING' &&
      refund.status !== 'GATEWAY_CONFIRMED'
    ) {
      throw new ConflictException(`Refund ${refundId} cannot be checked from status ${refund.status}`);
    }

    const audit = refundAuditContext(refund.metadata, refundId);
    let refundForFinalization: { id: string; metadata: unknown; status: string } = refund;
    if (refund.status === 'APPROVAL_PROCESSING' || refund.status === 'PROVIDER_PROCESSING') {
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
        const advanced = await advanceRefundStatus(this.prisma, {
          refund,
          fromStatuses: ['APPROVAL_PROCESSING', 'PROVIDER_PROCESSING'],
          metadata: {
            ...asJsonObject(refund.metadata),
            ...asJsonObject(operation.rawMeta),
            providerLastCheckedAt: new Date().toISOString(),
          },
          targetStatus: 'PROVIDER_PROCESSING',
        });
        return { completed: advanced.status === 'COMPLETED', paymentId: refund.paymentId, refundId };
      }
      assertPaymentOperationStatus(refund.paymentId, operation.status, PaymentStatus.REFUNDED);
      refundForFinalization = await advanceRefundStatus(this.prisma, {
        refund,
        fromStatuses: ['APPROVAL_PROCESSING', 'PROVIDER_PROCESSING'],
        metadata: {
          ...asJsonObject(refund.metadata),
          ...asJsonObject(operation.rawMeta),
          gatewayConfirmedAt: new Date().toISOString(),
          providerLastCheckedAt: new Date().toISOString(),
        },
        targetStatus: 'GATEWAY_CONFIRMED',
      });
      if (refundForFinalization.status === 'COMPLETED') {
        return { completed: true, paymentId: refund.paymentId, refundId };
      }
    }

    const finalizedAt = new Date();
    await this.finalizeRefund({
      actorId: audit.actorId,
      approvalAdminId: audit.approvalAdminId,
      occurredAt: finalizedAt,
      paymentId: refund.paymentId,
      refund: refundForFinalization,
      requestedByAdminId: audit.requestedByAdminId,
    });
    return { completed: true, paymentId: refund.paymentId, refundId };
  }

  private async finalizeRefund(input: {
    actorId: string;
    approvalAdminId: string;
    occurredAt: Date;
    paymentId: string;
    refund: { id: string; metadata: unknown };
    requestedByAdminId: string | null;
  }) {
    const { actorId, approvalAdminId, occurredAt, paymentId, refund, requestedByAdminId } = input;

    let settlementReversal: Prisma.InputJsonObject = { skipped: true, reason: 'NOT_ATTEMPTED' };
    let earningCancellation: Awaited<ReturnType<EarningsService['cancelForRefund']>> = {
      skipped: true,
      reason: 'NOT_ATTEMPTED',
    };
    const payment = await this.prisma.$transaction(async (tx) => {
      const paymentBooking = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        select: { bookingId: true },
      });
      await lockPaymentBookingLifecycle(tx, paymentBooking.bookingId);
      await this.assertBookingCanBeRefunded(tx, paymentBooking.bookingId);
      const transition = await transitionPaymentStatus(tx, {
        data: { status: PaymentStatus.REFUNDED },
        fromStatuses: [PaymentStatus.CAPTURED],
        idempotentTarget: false,
        paymentId,
        targetStatus: PaymentStatus.REFUNDED,
      });
      const bookingTransition = await tx.booking.updateMany({
        where: {
          id: transition.payment.bookingId,
          status: { in: [...REFUND_BOOKING_SOURCE_STATUSES] },
        },
        data: { status: BookingStatus.REFUNDED },
      });
      if (bookingTransition.count !== 1) {
        throw new ConflictException(
          `Booking ${transition.payment.bookingId} changed while refund finalization was running`,
        );
      }
      const refundTransition = await tx.refund.updateMany({
        where: { id: refund.id, status: 'GATEWAY_CONFIRMED' },
        data: {
          status: 'COMPLETED',
          metadata: toJsonOrUndefined({
            ...asJsonObject(refund.metadata),
            completedAt: occurredAt.toISOString(),
          }),
        },
      });
      if (refundTransition.count !== 1) {
        throw new ConflictException(`Refund ${refund.id} finalization was already claimed`);
      }
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
      if (transition.payment.method === PaymentMethod.CUSTOMER_WALLET) {
        await this.restoreCustomerWalletPaymentForRefund(tx, transition.payment);
      }
      earningCancellation = await this.earnings.cancelForRefund(transition.payment.bookingId, tx);
      const finalizedPayment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { refunds: true },
      });
      await this.admin.writeAudit(
        actorId,
        'payment.refund',
        `payment:${paymentId}`,
        {
        ...paymentRefundAuditMetadata(
          finalizedPayment,
          paymentRefundEarningCancellationAudit(earningCancellation),
        ),
        approvalAdminId,
        requestedByAdminId,
        settlementReversal,
        },
        undefined,
        tx,
      );
      return finalizedPayment;
    });
    await this.notifyPaymentUpdated(payment.id);

    return payment;
  }

  private async assertBookingCanBeRefunded(
    client: Pick<Prisma.TransactionClient, 'booking'>,
    bookingId: string,
  ) {
    const booking = await client.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true },
    });
    if (
      !REFUND_BOOKING_SOURCE_STATUSES.includes(
        booking.status as (typeof REFUND_BOOKING_SOURCE_STATUSES)[number],
      )
    ) {
      throw new ConflictException({
        code: 'BOOKING_NOT_REFUNDABLE',
        message: `Booking ${bookingId} cannot be refunded from status ${booking.status}`,
      });
    }
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

  private async recordRefundGatewayFailure(refund: { id: string; metadata: unknown }, error: unknown) {
    try {
      await this.prisma.refund.updateMany({
        where: { id: refund.id, status: 'APPROVAL_PROCESSING' },
        data: {
          metadata: toJsonOrUndefined({
            ...asJsonObject(refund.metadata),
            gatewayLastError: errorMessage(error),
            gatewayLastErrorAt: new Date().toISOString(),
            gatewayRecoveryRequired: true,
            gatewayResultUncertain: true,
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
    if (method === PaymentMethod.CUSTOMER_WALLET) {
      return this.customerWallet;
    }
    throw new BadRequestException('Unsupported payment method');
  }

  private async releaseCustomerWalletPayment(
    payment: {
    amount: number;
    bookingId: string;
    currency: string;
    id: string;
    status: PaymentStatus;
    },
    existingTx?: Prisma.TransactionClient,
  ) {
    if (payment.status !== PaymentStatus.AUTHORIZED) {
      throw paymentTransitionConflict(payment.id, payment.status, PaymentStatus.RELEASED);
    }

    const release = async (tx: Prisma.TransactionClient) => {
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: payment.bookingId },
        select: { customerProfileId: true },
      });
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${customerWalletBookingLockKey(
          booking.customerProfileId,
        )}, 0))::text AS "lockResult"`,
      );
      const reservation = await tx.customerWalletLedgerEntry.findUnique({
        where: { sourceKey: customerWalletPaymentSourceKey(payment.bookingId) },
      });
      if (!reservation || reservation.amount >= 0) {
        throw new ConflictException('Customer wallet booking reservation is missing');
      }
      const transition = await transitionPaymentStatus(tx, {
        data: { status: PaymentStatus.RELEASED },
        fromStatuses: [PaymentStatus.AUTHORIZED],
        paymentId: payment.id,
        targetStatus: PaymentStatus.RELEASED,
      });
      const releaseData = {
        amount: -reservation.amount,
        bookingId: payment.bookingId,
        currency: payment.currency,
        customerProfileId: booking.customerProfileId,
        metadata: {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          reservationEntryId: reservation.id,
          reservationState: 'RELEASED',
        },
        notes: 'Customer wallet booking reservation released after booking close.',
        reference: payment.id,
        type: CustomerWalletLedgerType.REFUND,
      };
      const releaseEntry = await tx.customerWalletLedgerEntry.upsert({
        where: { sourceKey: customerWalletPaymentReleaseSourceKey(payment.bookingId) },
        update: {},
        create: {
          ...releaseData,
          sourceKey: customerWalletPaymentReleaseSourceKey(payment.bookingId),
        },
      });
      assertCustomerWalletLedgerReplay(releaseEntry, releaseData);
      return transition.payment;
    };
    const updated = existingTx ? await release(existingTx) : await this.prisma.$transaction(release);
    if (!existingTx) {
      await this.notifyPaymentUpdated(updated.id);
    }
    return updated;
  }

  private async restoreCustomerWalletPaymentForRefund(
    tx: Prisma.TransactionClient,
    payment: { amount: number; bookingId: string; currency: string; id: string },
  ) {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: payment.bookingId },
      select: { customerProfileId: true },
    });
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${customerWalletBookingLockKey(
        booking.customerProfileId,
      )}, 0))::text AS "lockResult"`,
    );
    const reservation = await tx.customerWalletLedgerEntry.findUnique({
      where: { sourceKey: customerWalletPaymentSourceKey(payment.bookingId) },
    });
    if (!reservation || reservation.amount >= 0) {
      throw new ConflictException('Customer wallet payment debit is missing');
    }
    const refundData = {
      amount: -reservation.amount,
      bookingId: payment.bookingId,
      currency: payment.currency,
      customerProfileId: booking.customerProfileId,
      metadata: {
        bookingId: payment.bookingId,
        paymentId: payment.id,
        reservationEntryId: reservation.id,
        reservationState: 'REFUNDED',
      },
      notes: 'Customer wallet payment restored after completed booking refund.',
      reference: payment.id,
      type: CustomerWalletLedgerType.REFUND,
    };
    const refundEntry = await tx.customerWalletLedgerEntry.upsert({
      where: { sourceKey: customerWalletPaymentRefundSourceKey(payment.bookingId) },
      update: {},
      create: {
        ...refundData,
        sourceKey: customerWalletPaymentRefundSourceKey(payment.bookingId),
      },
    });
    assertCustomerWalletLedgerReplay(refundEntry, refundData);
  }

  private parsePaymentMethod(method: PaymentMethod | string): PaymentMethod {
    if (Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      return method as PaymentMethod;
    }
    throw new BadRequestException('Unsupported payment method');
  }

  private verifyCallback(method: PaymentMethod, payload: unknown) {
    const body = asJsonObject(payload);
    if (method === PaymentMethod.MOMO) {
      return this.verifyMomoCallback(body);
    }
    if (method === PaymentMethod.VNPAY) {
      return this.verifyVnpayCallback(body);
    }
    throw new BadRequestException('Unsupported payment method');
  }

  private assertPublicCallbackMethod(method: PaymentMethod) {
    if (method !== PaymentMethod.MOMO && method !== PaymentMethod.VNPAY) {
      throw new BadRequestException('Payment method does not support public callbacks');
    }
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

  private assertCallbackMatchesPayment(
    method: PaymentMethod,
    payload: unknown,
    payment: { amount: number; method: PaymentMethod },
    verified: boolean,
  ) {
    if (payment.method !== method) {
      throw new BadRequestException('Payment callback method does not match the stored payment');
    }

    const body = asJsonObject(payload);
    const callbackAmount = callbackAmountVnd(method, body);
    if (callbackAmount === null) {
      throw new BadRequestException('Payment callback amount is required');
    }
    if (callbackAmount !== payment.amount) {
      throw new BadRequestException('Payment callback amount does not match the stored payment');
    }

    if (method === PaymentMethod.MOMO) {
      const expectedPartnerCode = this.config.get<string>('MOMO_PARTNER_CODE')?.trim();
      const partnerCode = stringValue(body.partnerCode);
      if (verified && !expectedPartnerCode) {
        throw new BadRequestException('MoMo callback partner code is not configured');
      }
      if (expectedPartnerCode && !partnerCode) {
        throw new BadRequestException('MoMo callback partner code is required');
      }
      if (expectedPartnerCode && partnerCode !== expectedPartnerCode) {
        throw new BadRequestException('MoMo callback partner code does not match');
      }
    }

    if (method === PaymentMethod.VNPAY) {
      const expectedTmnCode = this.config.get<string>('VNPAY_TMN_CODE')?.trim();
      const tmnCode = stringValue(body.vnp_TmnCode);
      if (verified && !expectedTmnCode) {
        throw new BadRequestException('VNPay callback merchant code is not configured');
      }
      if (expectedTmnCode && !tmnCode) {
        throw new BadRequestException('VNPay callback merchant code is required');
      }
      if (expectedTmnCode && tmnCode !== expectedTmnCode) {
        throw new BadRequestException('VNPay callback merchant code does not match');
      }
    }
  }

  private async recordCallbackAttempt(input: PaymentCallbackAttemptInput) {
    await this.prisma.paymentCallbackAttempt.create({
      data: callbackAttemptCreateData(input),
    });
  }

  private async executeAdminPaymentAction(input: {
    action: PaymentAdminAction;
    actorId: string;
    execute: () => Promise<unknown>;
    idempotencyKey: string;
    paymentId: string;
    reason?: string | null;
  }): Promise<PaymentActionReceipt> {
    const idempotencyKey = input.idempotencyKey.trim();
    if (idempotencyKey.length < 8) {
      throw new BadRequestException({
        code: 'PAYMENT_ACTION_IDEMPOTENCY_KEY_REQUIRED',
        message: 'Payment actions require an idempotency key of at least 8 characters.',
      });
    }

    const reason = input.reason?.trim() || null;
    if (input.action !== 'SYNC' && (!reason || reason.length < 12)) {
      throw new BadRequestException({
        code: 'PAYMENT_ACTION_REASON_REQUIRED',
        message: 'Capture, release, and refund review actions require a reason of at least 12 characters.',
      });
    }

    const replay = await this.findPaymentActionReceipt(input.paymentId, idempotencyKey);
    if (replay) {
      return replay;
    }

    const beforeRecord = await this.loadAdminPaymentActionRecord(input.paymentId);
    const decision = paymentActionDecision(beforeRecord, input.action);
    if (!paymentActionCanExecute(decision)) {
      throw new ConflictException({
        actionDecision: decision,
        code: decision.reasonCode,
        message: decision.reason,
      });
    }

    const before = paymentActionState(beforeRecord);
    const requestHash = paymentActionRequestHash({
      action: input.action,
      actorId: input.actorId,
      paymentId: input.paymentId,
      reason,
    });
    const claim = await this.acquirePaymentActionClaim({
      action: input.action,
      actorId: input.actorId,
      idempotencyKey,
      paymentId: input.paymentId,
      reason,
      requestHash,
    });
    if (claim.replay) {
      return claim.replay;
    }

    try {
      await input.execute();
      const afterRecord = await this.loadAdminPaymentActionRecord(input.paymentId);
      const receiptWithoutAuditId = {
        action: input.action,
        actorId: input.actorId,
        after: paymentActionState(afterRecord),
        before,
        completedAt: new Date().toISOString(),
        idempotencyKey,
        paymentId: input.paymentId,
      };
      let receipt: PaymentActionReceipt = {
        auditId: claim.id,
        ...receiptWithoutAuditId,
      };

      try {
        const audit = await this.admin.writeAudit(
          input.actorId,
          'payment.action_receipt',
          `payment:${input.paymentId}`,
          {
            decision,
            idempotencyKey,
            reason,
            receipt: receiptWithoutAuditId,
          },
        );
        receipt = { ...receipt, auditId: audit.id };
      } catch (error) {
        this.logger.error(
          `Payment action ${claim.id} completed but the legacy audit mirror failed`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      await this.prisma.paymentAdminOperationClaim.update({
        where: { id: claim.id },
        data: {
          completedAt: new Date(receipt.completedAt),
          receipt: receipt as Prisma.InputJsonValue,
          status: PaymentAdminOperationStatus.SUCCEEDED,
        },
      });
      return receipt;
    } catch (error) {
      await this.prisma.paymentAdminOperationClaim.update({
        where: { id: claim.id },
        data: {
          errorCode: 'PAYMENT_ACTION_RESULT_REQUIRES_REVIEW',
          errorMessage: safePaymentActionErrorMessage(error),
          status: PaymentAdminOperationStatus.REVIEW_REQUIRED,
        },
      });
      throw new ConflictException({
        code: 'PAYMENT_ACTION_RESULT_REQUIRES_REVIEW',
        message: 'The payment provider result is uncertain. Review the payment before any retry.',
        operationClaimId: claim.id,
      });
    }
  }

  private async acquirePaymentActionClaim(input: {
    action: PaymentAdminAction;
    actorId: string;
    idempotencyKey: string;
    paymentId: string;
    reason: string | null;
    requestHash: string;
  }): Promise<{ id: string; replay: PaymentActionReceipt | null }> {
    try {
      const claim = await this.prisma.paymentAdminOperationClaim.create({
        data: {
          action: input.action,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          paymentId: input.paymentId,
          reason: input.reason,
          requestHash: input.requestHash,
        },
        select: { id: true },
      });
      return { id: claim.id, replay: null };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }

    const sameRequest = await this.prisma.paymentAdminOperationClaim.findUnique({
      where: {
        paymentId_idempotencyKey: {
          idempotencyKey: input.idempotencyKey,
          paymentId: input.paymentId,
        },
      },
      select: paymentAdminOperationClaimReplaySelect,
    });
    if (sameRequest) {
      if (sameRequest.requestHash !== input.requestHash) {
        throw new ConflictException({
          code: 'PAYMENT_ACTION_IDEMPOTENCY_PAYLOAD_MISMATCH',
          message: 'This idempotency key was already used with different payment action inputs.',
        });
      }
      return this.waitForPaymentActionClaim(sameRequest.id);
    }

    const activeClaim = await this.prisma.paymentAdminOperationClaim.findFirst({
      where: {
        paymentId: input.paymentId,
        status: {
          in: [PaymentAdminOperationStatus.IN_PROGRESS, PaymentAdminOperationStatus.REVIEW_REQUIRED],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
    throw new ConflictException({
      code:
        activeClaim?.status === PaymentAdminOperationStatus.REVIEW_REQUIRED
        ? 'PAYMENT_ACTION_REVIEW_REQUIRED'
        : 'PAYMENT_ACTION_IN_PROGRESS',
      message:
        activeClaim?.status === PaymentAdminOperationStatus.REVIEW_REQUIRED
        ? 'A previous payment action has an uncertain provider result and requires review.'
        : 'Another payment action is already in progress.',
      operationClaimId: activeClaim?.id ?? null,
    });
  }

  private async waitForPaymentActionClaim(
    claimId: string,
  ): Promise<{ id: string; replay: PaymentActionReceipt }> {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const claim = await this.prisma.paymentAdminOperationClaim.findUnique({
        where: { id: claimId },
        select: paymentAdminOperationClaimReplaySelect,
      });
      if (!claim) {
        break;
      }
      if (claim.status === PaymentAdminOperationStatus.SUCCEEDED) {
        const receipt = paymentActionReceiptFromAudit(claim.id, claim.receipt);
        if (receipt) {
          return { id: claim.id, replay: receipt };
        }
      }
      if (claim.status === PaymentAdminOperationStatus.REVIEW_REQUIRED) {
        throw new ConflictException({
          code: claim.errorCode || 'PAYMENT_ACTION_REVIEW_REQUIRED',
          message: claim.errorMessage || 'The previous payment action requires operator review.',
          operationClaimId: claim.id,
        });
      }
      await paymentActionClaimDelay(100);
    }
    throw new ConflictException({
      code: 'PAYMENT_ACTION_IN_PROGRESS',
      message: 'The same payment action is still in progress. Reopen the payment before retrying.',
      operationClaimId: claimId,
    });
  }

  private async findPaymentActionReceipt(
    paymentId: string,
    idempotencyKey: string,
  ): Promise<PaymentActionReceipt | null> {
    const audits = await this.prisma.adminAuditLog.findMany({
      where: {
        action: 'payment.action_receipt',
        target: `payment:${paymentId}`,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, metadata: true },
      take: 20,
    });

    for (const audit of audits) {
      const metadata = asJsonObject(audit.metadata);
      if (stringValue(metadata.idempotencyKey) !== idempotencyKey) {
        continue;
      }
      const receipt = paymentActionReceiptFromAudit(audit.id, metadata.receipt);
      if (receipt) {
        return receipt;
      }
    }
    return null;
  }

  private async loadAdminPaymentActionRecord(paymentId: string): Promise<AdminPaymentActionRecord> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          select: {
            status: true,
            customerWalletLedgerEntries: {
              orderBy: { createdAt: 'desc' },
              select: {
                amount: true,
                createdAt: true,
                sourceKey: true,
                updatedAt: true,
              },
              take: 5,
            },
          },
        },
        callbackAttempts: {
          orderBy: { createdAt: 'desc' },
          select: {
            callbackAmount: true,
            createdAt: true,
            outcome: true,
            signatureVerified: true,
          },
          take: 5,
        },
      },
    });
    if (!payment) {
      throw new BadRequestException(`Payment ${paymentId} was not found`);
    }
    return payment;
  }
}

async function lockPaymentBookingLifecycle(tx: Prisma.TransactionClient, bookingId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`);
}

function paymentActionState(record: AdminPaymentActionRecord) {
  return {
    bookingStatus: record.booking.status,
    paymentStatus: record.status,
  };
}

function paymentActionReceiptFromAudit(auditId: string, value: unknown): PaymentActionReceipt | null {
  const receipt = asJsonObject(value);
  const receiptAuditId = stringValue(receipt.auditId) || auditId;
  const action = stringValue(receipt.action);
  const actorId = stringValue(receipt.actorId);
  const completedAt = stringValue(receipt.completedAt);
  const idempotencyKey = stringValue(receipt.idempotencyKey);
  const paymentId = stringValue(receipt.paymentId);
  const before = asJsonObject(receipt.before);
  const after = asJsonObject(receipt.after);
  const beforeBookingStatus = stringValue(before.bookingStatus);
  const beforePaymentStatus = stringValue(before.paymentStatus);
  const afterBookingStatus = stringValue(after.bookingStatus);
  const afterPaymentStatus = stringValue(after.paymentStatus);
  if (
    !isPaymentAdminAction(action) ||
    !actorId ||
    !completedAt ||
    !idempotencyKey ||
    !paymentId ||
    !beforeBookingStatus ||
    !beforePaymentStatus ||
    !afterBookingStatus ||
    !afterPaymentStatus
  ) {
    return null;
  }
  return {
    action,
    actorId,
    after: { bookingStatus: afterBookingStatus, paymentStatus: afterPaymentStatus },
    auditId: receiptAuditId,
    before: { bookingStatus: beforeBookingStatus, paymentStatus: beforePaymentStatus },
    completedAt,
    idempotencyKey,
    paymentId,
  };
}

function isPaymentAdminAction(value: string | null): value is PaymentAdminAction {
  return value === 'SYNC' || value === 'CAPTURE' || value === 'RELEASE' || value === 'REQUEST_REFUND';
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
  const approvalAdminId = stringValue(record.approvalAdminId);
  const occurredAtValue = stringValue(record.occurredAt);
  const occurredAt = occurredAtValue ? new Date(occurredAtValue) : null;
  if (!approvalAdminId || !occurredAt || Number.isNaN(occurredAt.getTime())) {
    throw new BadRequestException(`Refund ${refundId} is missing immutable approval audit context`);
  }
  return {
    actorId: approvalAdminId,
    approvalAdminId,
    occurredAt,
    requestedByAdminId: stringValue(record.requestedByAdminId) || stringValue(record.actorId) || null,
  };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function paymentActionRequestHash(input: {
  action: PaymentAdminAction;
  actorId: string;
  paymentId: string;
  reason: string | null;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
      action: input.action,
      actorId: input.actorId,
      paymentId: input.paymentId,
      reason: input.reason,
      }),
    )
    .digest('hex');
}

function safePaymentActionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Payment provider result could not be confirmed.';
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 500);
}

function assertCustomerWalletLedgerReplay(existing: object, expected: object) {
  const existingRecord = existing as Record<string, unknown>;
  const expectedRecord = expected as Record<string, unknown>;
  const fields = [
    'amount',
    'bookingId',
    'currency',
    'customerProfileId',
    'metadata',
    'notes',
    'reference',
    'type',
  ] as const;
  const matches = fields.every(
    (field) =>
      !(field in existingRecord) ||
      isDeepStrictEqual(existingRecord[field] ?? null, expectedRecord[field] ?? null),
  );
  if (!matches) {
    throw new ConflictException('A customer wallet entry already exists with different financial evidence.');
  }
}

function paymentActionClaimDelay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

type PaymentApprovalLookupDb = Pick<Prisma.TransactionClient, 'adminAuditLog' | 'user'>;

type RefundStateDb = Pick<Prisma.TransactionClient, 'refund'>;

const REFUND_STATUS_ORDER: Readonly<Record<string, number>> = {
  REQUESTED: 0,
  APPROVAL_PROCESSING: 1,
  PROVIDER_PROCESSING: 2,
  GATEWAY_CONFIRMED: 3,
  COMPLETED: 4,
};

async function advanceRefundStatus(
  db: RefundStateDb,
  input: {
    refund: { id: string; metadata: unknown; status: string };
    fromStatuses: string[];
    metadata: Prisma.InputJsonObject;
    targetStatus: string;
  },
) {
  const mutation = await db.refund.updateMany({
    where: { id: input.refund.id, status: { in: input.fromStatuses } },
    data: {
      status: input.targetStatus,
      metadata: toJsonOrUndefined(input.metadata),
    },
  });
  if (mutation.count === 1) {
    return {
      ...input.refund,
      metadata: input.metadata,
      status: input.targetStatus,
    };
  }

  const latest = await db.refund.findUnique({
    where: { id: input.refund.id },
    select: { id: true, metadata: true, status: true },
  });
  if (!latest) {
    throw new BadRequestException(`Refund ${input.refund.id} was not found`);
  }
  const latestOrder = REFUND_STATUS_ORDER[latest.status];
  const targetOrder = REFUND_STATUS_ORDER[input.targetStatus];
  if (latestOrder !== undefined && targetOrder !== undefined && latestOrder >= targetOrder) {
    return latest;
  }
  throw new ConflictException(
    `Refund ${input.refund.id} changed from ${input.refund.status} to ${latest.status} during processing`,
  );
}

function paymentRefundRequestContext(metadata: unknown) {
  const record = asJsonObject(metadata);
  return {
    requestedByAdminId: stringValue(record.requestedByAdminId) || stringValue(record.actorId) || null,
  };
}

function assertIndependentPaymentRefundApprover(requestedByAdminId: string | null, approvalAdminId: string) {
  if (requestedByAdminId === approvalAdminId) {
    throw new BadRequestException('Payment refund requires approval from a different admin');
  }
}

async function assertPaymentRefundApprovalAdmin(db: PaymentApprovalLookupDb, approvalAdminId: string) {
  await assertVerifiedFinanceApprover(db, approvalAdminId, 'Payment refund');
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
