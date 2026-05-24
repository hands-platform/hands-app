import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  PayoutBatchStatus,
  Prisma,
  ProviderStatus,
  ReviewStatus,
  VerificationStatus,
} from '@prisma/client';
import { SupabaseAdminService } from '../auth/supabase-admin.service';
import { EarningsService } from '../earnings/earnings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly earnings: EarningsService,
    private readonly notifications: NotificationsService,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly redisState: RedisStateService,
  ) {}

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { customerProfile: true, providerProfile: true },
    });
  }

  listProviders() {
    return this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      include: {
        user: {
          include: {
            pushDevices: {
              orderBy: { createdAt: 'desc' },
              include: {
                deliveries: {
                  orderBy: { attemptedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        verification: { include: { files: true } },
        kyc: true,
        documents: { include: { fileAsset: true }, orderBy: { createdAt: 'desc' } },
        bankAccounts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
        taxProfile: true,
        agreements: { orderBy: { acceptedAt: 'desc' } },
        services: { include: { service: true } },
        sessions: { orderBy: { lastSeenAt: 'desc' }, take: 10 },
        devices: { orderBy: { lastSeenAt: 'desc' }, take: 10 },
      },
    });
  }

  async getProviderDetail(providerProfileId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      include: {
        user: {
          include: {
            pushDevices: {
              orderBy: { createdAt: 'desc' },
              include: {
                deliveries: {
                  orderBy: { attemptedAt: 'desc' },
                  take: 5,
                },
              },
            },
          },
        },
        verification: { include: { files: true } },
        kyc: true,
        documents: { include: { fileAsset: true }, orderBy: { createdAt: 'desc' } },
        bankAccounts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
        taxProfile: true,
        agreements: { orderBy: { acceptedAt: 'desc' } },
        services: { include: { service: true } },
        locationSnapshots: { orderBy: { recordedAt: 'desc' }, take: 10 },
        earnings: { orderBy: { createdAt: 'desc' }, take: 10 },
        payoutBatches: { orderBy: { createdAt: 'desc' }, take: 10 },
        sessions: { orderBy: { lastSeenAt: 'desc' }, take: 10 },
        devices: { orderBy: { lastSeenAt: 'desc' }, take: 10 },
        verificationLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { actor: { select: { phone: true, fullName: true } } },
        },
      },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const deviceIds = Array.from(
      new Set(
        [
          ...provider.devices.map((device) => device.deviceId),
          ...provider.sessions.map((session) => session.deviceId),
        ].filter((deviceId): deviceId is string => Boolean(deviceId)),
      ),
    );
    const sharedDeviceMatches = deviceIds.length
      ? await this.prisma.providerDevice.findMany({
          where: {
            deviceId: { in: deviceIds },
            providerProfileId: { not: provider.id },
          },
          orderBy: { lastSeenAt: 'desc' },
          take: 20,
          include: {
            providerProfile: {
              select: {
                id: true,
                displayName: true,
                user: { select: { phone: true } },
              },
            },
          },
        })
      : [];

    return { ...provider, sharedDeviceMatches };
  }

  async enablePushDevice(actorId: string, pushDeviceId: string) {
    const device = await this.prisma.pushDevice.update({
      where: { id: pushDeviceId },
      data: { enabled: true },
    });

    await this.writeAudit(actorId, 'push_device.enable', `push_device:${pushDeviceId}`, {
      pushDeviceId,
      userId: device.userId,
      platform: device.platform,
    });

    return { ok: true, pushDeviceId: device.id };
  }

  async blockProviderDevice(actorId: string, providerDeviceId: string, reason?: string) {
    const blockReason = normalizeNullable(reason);
    if (!blockReason) {
      throw new BadRequestException('Block reason is required');
    }

    const device = await this.prisma.providerDevice.update({
      where: { id: providerDeviceId },
      data: {
        enabled: false,
        blockedAt: new Date(),
        blockReason,
      },
    });

    await this.writeAudit(actorId, 'provider_device.block', `provider_device:${providerDeviceId}`, {
      providerProfileId: device.providerProfileId,
      deviceId: device.deviceId,
      reason: blockReason,
    });

    return { ok: true, providerDeviceId: device.id };
  }

  async unblockProviderDevice(actorId: string, providerDeviceId: string) {
    const device = await this.prisma.providerDevice.update({
      where: { id: providerDeviceId },
      data: {
        enabled: true,
        blockedAt: null,
        blockReason: null,
      },
    });

    await this.writeAudit(actorId, 'provider_device.unblock', `provider_device:${providerDeviceId}`, {
      providerProfileId: device.providerProfileId,
      deviceId: device.deviceId,
    });

    return { ok: true, providerDeviceId: device.id };
  }

  async blockProviderAccount(actorId: string, providerProfileId: string, reason?: string) {
    const blockReason = normalizeNullable(reason);
    if (!blockReason) {
      throw new BadRequestException('Block reason is required');
    }

    const provider = await this.prisma.providerProfile.update({
      where: { id: providerProfileId },
      data: {
        status: ProviderStatus.OFFLINE,
        blockedAt: new Date(),
        blockedReason: blockReason,
      },
      select: { id: true, userId: true, status: true, blockedAt: true, blockedReason: true },
    });
    await this.redisState.setProviderStatus(provider.id, ProviderStatus.OFFLINE);

    await this.writeAudit(actorId, 'provider_account.block', `provider:${providerProfileId}`, {
      providerProfileId,
      reason: blockReason,
    });

    await this.notifications.create({
      userId: provider.userId,
      type: 'provider.account.blocked',
      title: 'Provider account blocked',
      body: blockReason,
      data: { providerProfileId, reason: blockReason },
    });

    return { ok: true, providerProfileId: provider.id, blockedAt: provider.blockedAt };
  }

  async unblockProviderAccount(actorId: string, providerProfileId: string) {
    const provider = await this.prisma.providerProfile.update({
      where: { id: providerProfileId },
      data: {
        blockedAt: null,
        blockedReason: null,
      },
      select: { id: true, userId: true },
    });

    await this.writeAudit(actorId, 'provider_account.unblock', `provider:${providerProfileId}`, {
      providerProfileId,
    });

    await this.notifications.create({
      userId: provider.userId,
      type: 'provider.account.unblocked',
      title: 'Provider account unblocked',
      body: 'Your HANDS provider account can sign in again. Go online only when ready to receive requests.',
      data: { providerProfileId },
    });

    return { ok: true, providerProfileId: provider.id };
  }

  async reviewProvider(
    actorId: string,
    providerProfileId: string,
    status: VerificationStatus,
    reason?: string,
  ) {
    const verification = await this.prisma.providerVerification.upsert({
      where: { providerProfileId },
      update: {
        status,
        rejectionReason: status === VerificationStatus.REJECTED ? reason : null,
        reviewedAt: new Date(),
      },
      create: {
        providerProfileId,
        status,
        rejectionReason: status === VerificationStatus.REJECTED ? reason : null,
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
    });

    await this.writeAudit(actorId, `provider.${status.toLowerCase()}`, `provider:${providerProfileId}`, {
      reason,
    });

    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: { userId: true },
    });
    let supabaseRoleSync = null;
    if (provider) {
      await this.notifications.create({
        userId: provider.userId,
        type: `provider.verification.${status.toLowerCase()}`,
        title:
          status === VerificationStatus.APPROVED ? 'Verification approved' : 'Verification needs updates',
        body:
          status === VerificationStatus.APPROVED
            ? 'You can now receive matching jobs.'
            : (reason ?? 'Please update your documents.'),
        data: { providerProfileId, status, reason },
      });

      if (status === VerificationStatus.APPROVED) {
        supabaseRoleSync = await this.syncProviderSupabaseRole(actorId, providerProfileId);
      }
    }

    return { ...verification, supabaseRoleSync };
  }

  async syncProviderSupabaseRole(actorId: string, providerProfileId: string) {
    const provider = await this.prisma.providerProfile.findUniqueOrThrow({
      where: { id: providerProfileId },
      include: { user: true, verification: true },
    });

    if (provider.verification?.status !== VerificationStatus.APPROVED) {
      const result = {
        status: 'SKIPPED' as const,
        configured: false,
        supabaseUserId: provider.user.supabaseUserId,
        reason: 'Provider must be approved before Supabase provider role sync.',
      };
      await this.writeAudit(actorId, 'provider.supabase_role_sync.skipped', `provider:${providerProfileId}`, {
        result,
      });
      return result;
    }

    const result = await this.supabaseAdmin.grantProviderRole(provider.user.supabaseUserId);
    await this.writeAudit(
      actorId,
      `provider.supabase_role_sync.${result.status.toLowerCase()}`,
      `provider:${providerProfileId}`,
      {
        result,
        userId: provider.userId,
      },
    );
    return result;
  }

  listBookings() {
    return this.prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customerProfile: { include: { user: true } },
        preferredProvider: { include: { user: true } },
        selectedProvider: { include: { user: true } },
        participants: { include: { providerProfile: { include: { user: true } } } },
        services: { include: { service: true } },
        payment: true,
        chatRoom: true,
      },
    });
  }

  getBookingDetail(id: string) {
    return this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: {
        customerProfile: { include: { user: true } },
        preferredProvider: {
          include: {
            user: true,
            locationSnapshots: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
        selectedProvider: {
          include: {
            user: true,
            locationSnapshots: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
        participants: {
          orderBy: { joinedAt: 'asc' },
          include: {
            providerProfile: {
              include: {
                user: true,
                locationSnapshots: { orderBy: { recordedAt: 'desc' }, take: 1 },
              },
            },
          },
        },
        services: { include: { service: true } },
        payment: { include: { refunds: true } },
        refunds: true,
        review: true,
        earning: true,
        opsTasks: {
          orderBy: { updatedAt: 'desc' },
          include: { actor: { select: { phone: true, fullName: true } } },
        },
        snapshots: { orderBy: { recordedAt: 'desc' }, take: 10 },
        chatRoom: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 20,
              include: { sender: { select: { id: true, phone: true, fullName: true, roles: true } } },
            },
          },
        },
      },
    });
  }

  async addBookingOpsNote(actorId: string, bookingId: string, input: { note?: string; preset?: string }) {
    const note = normalizeNullable(input.note);
    const preset = normalizeNullable(input.preset);
    const content = note ?? preset;
    if (!content) {
      throw new BadRequestException('Operation note is required');
    }

    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { id: true, notes: true, status: true },
    });
    const entry = `[${new Date().toISOString()}] ${content}`;
    const notes = booking.notes?.trim() ? `${booking.notes.trim()}\n${entry}` : entry;
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { notes },
    });

    await this.writeAudit(actorId, 'booking.ops_note.add', `booking:${bookingId}`, {
      bookingId,
      status: booking.status,
      note: content,
      preset,
    });

    return updated;
  }

  async updateBookingOpsTask(
    actorId: string,
    bookingId: string,
    input: { type: BookingOpsTaskType; status: BookingOpsTaskStatus; note?: string },
  ) {
    if (!Object.values(BookingOpsTaskType).includes(input.type)) {
      throw new BadRequestException('Invalid operation task type');
    }
    if (!Object.values(BookingOpsTaskStatus).includes(input.status)) {
      throw new BadRequestException('Invalid operation task status');
    }

    const note = normalizeNullable(input.note);
    const task = await this.prisma.bookingOpsTask.upsert({
      where: { bookingId_type: { bookingId, type: input.type } },
      update: {
        status: input.status,
        note,
        actorId,
      },
      create: {
        bookingId,
        type: input.type,
        status: input.status,
        note,
        actorId,
      },
      include: { actor: { select: { phone: true, fullName: true } } },
    });

    await this.writeAudit(actorId, 'booking.ops_task.update', `booking:${bookingId}`, {
      bookingId,
      type: input.type,
      status: input.status,
      note,
    });

    return task;
  }

  listPayments() {
    return this.prisma.payment.findMany({
      orderBy: { id: 'desc' },
      take: 100,
      include: {
        booking: { include: { customerProfile: { include: { user: true } }, selectedProvider: true } },
        refunds: true,
      },
    });
  }

  listRefunds() {
    return this.prisma.refund.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        payment: true,
        booking: { include: { customerProfile: { include: { user: true } }, selectedProvider: true } },
      },
    });
  }

  listEarnings() {
    return this.earnings.listForAdmin();
  }

  earningsSummary() {
    return this.earnings.adminSummary();
  }

  async markEarningPaid(actorId: string, earningId: string) {
    const earning = await this.earnings.markPaid(earningId);
    await this.writeAudit(actorId, 'earning.paid', `earning:${earning.id}`, {
      bookingId: earning.bookingId,
      providerProfileId: earning.providerProfileId,
      netAmount: earning.netAmount,
    });
    return earning;
  }

  listPayoutBatches() {
    return this.earnings.listPayoutBatchesForAdmin();
  }

  async createPayoutBatch(
    actorId: string,
    input: { providerProfileId: string; transferRef?: string; notes?: string },
  ) {
    const batch = await this.earnings.createProviderPayoutBatch(input);
    await this.writeAudit(actorId, 'payout_batch.create', `payout_batch:${batch.id}`, {
      providerProfileId: batch.providerProfileId,
      totalNetAmount: batch.totalNetAmount,
      transferRef: batch.transferRef,
      earningCount: batch.earnings.length,
    });
    return batch;
  }

  async updatePayoutBatch(
    actorId: string,
    payoutBatchId: string,
    input: { status?: PayoutBatchStatus; transferRef?: string | null; notes?: string | null },
  ) {
    const batch = await this.earnings.updatePayoutBatch(payoutBatchId, input);
    await this.writeAudit(actorId, 'payout_batch.update', `payout_batch:${batch.id}`, {
      status: batch.status,
      transferRef: batch.transferRef,
      earningCount: batch.earnings.length,
    });
    return batch;
  }

  listReviews() {
    return this.prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { booking: true, customerProfile: { include: { user: true } }, providerProfile: true },
    });
  }

  async moderateReview(
    actorId: string,
    reviewId: string,
    input: { status: ReviewStatus; reportReason?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id: reviewId },
        data: {
          status: input.status,
          reportReason: input.reportReason,
          moderatedAt: new Date(),
        },
      });

      const aggregate = await tx.review.aggregate({
        where: { providerProfileId: review.providerProfileId, status: ReviewStatus.PUBLISHED },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.providerProfile.update({
        where: { id: review.providerProfileId },
        data: {
          ratingAvg: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count.rating,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'review.moderate',
          target: `review:${review.id}`,
          metadata: toJson({ status: input.status, reportReason: input.reportReason }),
        },
      });

      return review;
    });
  }

  listCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { code: 'asc' },
      take: 100,
    });
  }

  async createCoupon(
    actorId: string,
    input: {
      code: string;
      description?: string;
      discount: unknown;
      active?: boolean;
      startsAt?: string;
      endsAt?: string;
    },
  ) {
    const coupon = await this.prisma.coupon.create({
      data: {
        code: input.code.trim().toUpperCase(),
        description: input.description,
        discount: toJson(input.discount),
        active: input.active ?? true,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
    });

    await this.writeAudit(actorId, 'coupon.create', `coupon:${coupon.id}`, { code: coupon.code });
    return coupon;
  }

  async updateCoupon(
    actorId: string,
    id: string,
    input: {
      description?: string;
      discount?: unknown;
      active?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
    },
  ) {
    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        description: input.description,
        discount: input.discount === undefined ? undefined : toJson(input.discount),
        active: input.active,
        startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt === undefined ? undefined : input.endsAt ? new Date(input.endsAt) : null,
      },
    });

    await this.writeAudit(actorId, 'coupon.update', `coupon:${coupon.id}`, { active: coupon.active });
    return coupon;
  }

  listAuditLogs() {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: { select: { id: true, phone: true, fullName: true } } },
    });
  }

  listNotifications() {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, phone: true, fullName: true } },
        deliveries: { include: { pushDevice: true }, orderBy: { attemptedAt: 'desc' } },
      },
    });
  }

  async retryNotification(actorId: string, notificationId: string) {
    const result = await this.notifications.retry(notificationId);
    await this.writeAudit(actorId, 'notification.retry', `notification:${notificationId}`, {
      notificationId,
    });
    return result;
  }

  writeAudit(actorId: string, action: string, target: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action,
        target,
        metadata,
      },
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeNullable(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
