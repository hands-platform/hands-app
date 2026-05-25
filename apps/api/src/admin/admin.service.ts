import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  EarningStatus,
  FilePurpose,
  FileReviewStatus,
  FileUploadStatus,
  FileVisibility,
  PayoutBatchStatus,
  Prisma,
  ProviderReportSeverity,
  ProviderReportSource,
  ProviderReportStatus,
  ProviderSanctionStatus,
  ProviderSanctionType,
  ProviderStatus,
  ReviewStatus,
  VerificationStatus,
} from '@prisma/client';
import { SupabaseAdminService } from '../auth/supabase-admin.service';
import { EarningsService } from '../earnings/earnings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';

const PRICE_STEP_UNIT_VND = 100000;

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
            fileAssets: {
              where: {
                purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
                visibility: FileVisibility.PUBLIC,
                uploadStatus: FileUploadStatus.UPLOADED,
              },
              orderBy: { createdAt: 'desc' },
              take: 8,
            },
          },
        },
        verification: { include: { files: true } },
        kyc: true,
        documents: { include: { fileAsset: true }, orderBy: { createdAt: 'desc' } },
        bankAccounts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
        taxProfile: true,
        reports: { orderBy: { createdAt: 'desc' }, take: 5 },
        sanctions: { orderBy: { createdAt: 'desc' }, take: 5 },
        agreements: { orderBy: { acceptedAt: 'desc' } },
        services: { include: { service: true } },
        earnings: {
          where: { status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { booking: { include: { payment: true } } },
        },
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
            fileAssets: {
              where: {
                purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
                visibility: FileVisibility.PUBLIC,
                uploadStatus: FileUploadStatus.UPLOADED,
              },
              orderBy: { createdAt: 'desc' },
              take: 8,
            },
          },
        },
        verification: { include: { files: true } },
        kyc: true,
        documents: { include: { fileAsset: true }, orderBy: { createdAt: 'desc' } },
        bankAccounts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
        taxProfile: true,
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            booking: { select: { id: true, status: true } },
            reporterUser: { select: { phone: true, fullName: true } },
            assignedAdmin: { select: { phone: true, fullName: true } },
            sanctions: { orderBy: { createdAt: 'desc' } },
          },
        },
        sanctions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            report: { select: { id: true, category: true, severity: true, status: true, summary: true } },
            issuedBy: { select: { phone: true, fullName: true } },
            liftedBy: { select: { phone: true, fullName: true } },
          },
        },
        agreements: { orderBy: { acceptedAt: 'desc' } },
        services: { include: { service: true } },
        locationSnapshots: { orderBy: { recordedAt: 'desc' }, take: 10 },
        earnings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { booking: { include: { payment: true } } },
        },
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

    await this.prisma.providerSanction.create({
      data: {
        providerProfileId,
        type: ProviderSanctionType.ACCOUNT_BLOCK,
        status: ProviderSanctionStatus.ACTIVE,
        reason: blockReason,
        issuedById: actorId,
        metadata: toJson({ source: 'admin_account_block' }),
      },
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

    await this.prisma.providerSanction.updateMany({
      where: {
        providerProfileId,
        type: ProviderSanctionType.ACCOUNT_BLOCK,
        status: ProviderSanctionStatus.ACTIVE,
      },
      data: {
        status: ProviderSanctionStatus.LIFTED,
        liftedAt: new Date(),
        liftedById: actorId,
      },
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

  listProviderReports() {
    return this.prisma.providerReport.findMany({
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        providerProfile: { include: { user: { select: { phone: true, fullName: true } } } },
        booking: { select: { id: true, status: true, scheduledStartAt: true } },
        reporterUser: { select: { phone: true, fullName: true } },
        assignedAdmin: { select: { phone: true, fullName: true } },
        sanctions: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async createProviderReport(
    actorId: string,
    input: {
      providerProfileId?: string;
      bookingId?: string | null;
      source?: ProviderReportSource;
      severity?: ProviderReportSeverity;
      category?: string;
      summary?: string;
      details?: string | null;
    },
  ) {
    const providerProfileId = normalizeNullable(input.providerProfileId);
    const category = normalizeNullable(input.category);
    const summary = normalizeNullable(input.summary);
    if (!providerProfileId) throw new BadRequestException('providerProfileId is required');
    if (!category) throw new BadRequestException('Report category is required');
    if (!summary) throw new BadRequestException('Report summary is required');
    if (input.source && !Object.values(ProviderReportSource).includes(input.source)) {
      throw new BadRequestException('Invalid report source');
    }
    if (input.severity && !Object.values(ProviderReportSeverity).includes(input.severity)) {
      throw new BadRequestException('Invalid report severity');
    }

    const report = await this.prisma.providerReport.create({
      data: {
        providerProfileId,
        bookingId: normalizeNullable(input.bookingId),
        source: input.source ?? ProviderReportSource.ADMIN,
        severity: input.severity ?? ProviderReportSeverity.MEDIUM,
        category,
        summary,
        details: normalizeNullable(input.details),
        reporterUserId: actorId,
        assignedAdminId: actorId,
      },
      include: { providerProfile: true, sanctions: true },
    });

    await this.writeAudit(actorId, 'provider_report.create', `provider_report:${report.id}`, {
      providerProfileId,
      category,
      severity: report.severity,
    });
    return report;
  }

  async updateProviderReport(
    actorId: string,
    reportId: string,
    input: {
      status?: ProviderReportStatus;
      severity?: ProviderReportSeverity;
      resolutionNote?: string | null;
    },
  ) {
    if (input.status && !Object.values(ProviderReportStatus).includes(input.status)) {
      throw new BadRequestException('Invalid report status');
    }
    if (input.severity && !Object.values(ProviderReportSeverity).includes(input.severity)) {
      throw new BadRequestException('Invalid report severity');
    }
    const report = await this.prisma.providerReport.update({
      where: { id: reportId },
      data: {
        status: input.status,
        severity: input.severity,
        resolutionNote: normalizeNullable(input.resolutionNote),
        resolvedAt:
          input.status === ProviderReportStatus.RESOLVED || input.status === ProviderReportStatus.DISMISSED
            ? new Date()
            : input.status === ProviderReportStatus.OPEN ||
                input.status === ProviderReportStatus.INVESTIGATING
              ? null
              : undefined,
      },
    });

    await this.writeAudit(actorId, 'provider_report.update', `provider_report:${reportId}`, {
      status: input.status,
      severity: input.severity,
      resolutionNote: normalizeNullable(input.resolutionNote),
    });
    return report;
  }

  listProviderSanctions() {
    return this.prisma.providerSanction.findMany({
      orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
      take: 100,
      include: {
        providerProfile: { include: { user: { select: { phone: true, fullName: true } } } },
        report: { select: { id: true, category: true, severity: true, status: true, summary: true } },
        issuedBy: { select: { phone: true, fullName: true } },
        liftedBy: { select: { phone: true, fullName: true } },
      },
    });
  }

  async createProviderSanction(
    actorId: string,
    providerProfileId: string,
    input: {
      type?: ProviderSanctionType;
      reason?: string;
      reportId?: string | null;
      expiresAt?: string | null;
    },
  ) {
    const reason = normalizeNullable(input.reason);
    if (!reason) throw new BadRequestException('Sanction reason is required');
    if (input.type && !Object.values(ProviderSanctionType).includes(input.type)) {
      throw new BadRequestException('Invalid sanction type');
    }
    const type = input.type ?? ProviderSanctionType.WARNING;
    if (type === ProviderSanctionType.ACCOUNT_BLOCK) {
      await this.blockProviderAccount(actorId, providerProfileId, reason);
      const accountBlock = await this.prisma.providerSanction.findFirstOrThrow({
        where: {
          providerProfileId,
          type: ProviderSanctionType.ACCOUNT_BLOCK,
          status: ProviderSanctionStatus.ACTIVE,
          reason,
        },
        orderBy: { createdAt: 'desc' },
      });
      const updated = normalizeNullable(input.reportId)
        ? await this.prisma.providerSanction.update({
            where: { id: accountBlock.id },
            data: { reportId: normalizeNullable(input.reportId) },
          })
        : accountBlock;
      await this.writeAudit(actorId, 'provider_sanction.create', `provider_sanction:${updated.id}`, {
        providerProfileId,
        reportId: normalizeNullable(input.reportId),
        type,
      });
      return updated;
    }

    const sanction = await this.prisma.providerSanction.create({
      data: {
        providerProfileId,
        reportId: normalizeNullable(input.reportId),
        type,
        reason,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        issuedById: actorId,
      },
    });

    await this.writeAudit(actorId, 'provider_sanction.create', `provider_sanction:${sanction.id}`, {
      providerProfileId,
      reportId: normalizeNullable(input.reportId),
      type,
    });
    return sanction;
  }

  async liftProviderSanction(actorId: string, sanctionId: string) {
    const sanction = await this.prisma.providerSanction.update({
      where: { id: sanctionId },
      data: {
        status: ProviderSanctionStatus.LIFTED,
        liftedAt: new Date(),
        liftedById: actorId,
      },
    });

    if (sanction.type === ProviderSanctionType.ACCOUNT_BLOCK) {
      const remainingAccountBlocks = await this.prisma.providerSanction.count({
        where: {
          providerProfileId: sanction.providerProfileId,
          type: ProviderSanctionType.ACCOUNT_BLOCK,
          status: ProviderSanctionStatus.ACTIVE,
        },
      });

      if (remainingAccountBlocks === 0) {
        const provider = await this.prisma.providerProfile.update({
          where: { id: sanction.providerProfileId },
          data: {
            blockedAt: null,
            blockedReason: null,
          },
          select: { id: true, userId: true },
        });

        await this.notifications.create({
          userId: provider.userId,
          type: 'provider.account.unblocked',
          title: 'Provider account unblocked',
          body: 'Your HANDS provider account can sign in again. Go online only when ready to receive requests.',
          data: { providerProfileId: provider.id, sanctionId },
        });
      }
    }

    await this.writeAudit(actorId, 'provider_sanction.lift', `provider_sanction:${sanctionId}`, {
      providerProfileId: sanction.providerProfileId,
      type: sanction.type,
    });
    return sanction;
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

  async reviewPublicProviderMedia(
    actorId: string,
    fileId: string,
    status: FileReviewStatus,
    reason?: string,
  ) {
    const file = await this.prisma.fileAsset.findUnique({
      where: { id: fileId },
      include: { owner: { include: { providerProfile: true } } },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (
      file.visibility !== FileVisibility.PUBLIC ||
      (file.purpose !== FilePurpose.PROFILE_IMAGE && file.purpose !== FilePurpose.PROVIDER_GALLERY)
    ) {
      throw new BadRequestException('Only public provider media can be reviewed here');
    }
    if (file.uploadStatus !== FileUploadStatus.UPLOADED) {
      throw new BadRequestException('Only completed uploads can be reviewed');
    }
    const normalizedReason = status === FileReviewStatus.REJECTED ? normalizeNullable(reason) : null;
    if (status === FileReviewStatus.REJECTED && !normalizedReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const updated = await this.prisma.fileAsset.update({
      where: { id: fileId },
      data: {
        reviewStatus: status,
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewReason: normalizedReason,
      },
    });
    await this.writeAudit(actorId, `provider_media.${status.toLowerCase()}`, `file:${fileId}`, {
      fileId,
      purpose: file.purpose,
      ownerUserId: file.ownerUserId,
      providerProfileId: file.owner?.providerProfile?.id,
      reason: normalizedReason,
    });
    if (file.ownerUserId) {
      await this.notifications.create({
        userId: file.ownerUserId,
        type: `provider.media.${status.toLowerCase()}`,
        title:
          status === FileReviewStatus.APPROVED ? 'Profile media approved' : 'Profile media needs changes',
        body:
          status === FileReviewStatus.APPROVED
            ? 'Your public profile media is now visible to customers.'
            : (normalizedReason ?? 'Please upload a clearer public profile photo.'),
        data: { fileId, purpose: file.purpose, status, reason: normalizedReason },
      });
    }
    return { ok: true, file: updated };
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

  listServices() {
    return this.prisma.massageService.findMany({
      orderBy: [{ displayOrder: 'asc' }, { serviceGroupKey: 'asc' }, { durationMin: 'asc' }],
      include: {
        payoutRules: { orderBy: [{ active: 'desc' }, { customerPrice: 'asc' }] },
        _count: { select: { providers: true, bookings: true } },
      },
    });
  }

  async createService(
    actorId: string,
    input: {
      serviceGroupKey?: string;
      name?: string;
      description?: string | null;
      durationMin?: number;
      basePrice?: number;
      priceStep?: number;
      displayOrder?: number;
      active?: boolean;
    },
  ) {
    const data = normalizeServiceInput(input, true) as Prisma.MassageServiceUncheckedCreateInput;
    const service = await this.prisma.massageService.create({
      data,
      include: { payoutRules: true },
    });
    await this.writeAudit(actorId, 'service.create', `service:${service.id}`, toJson(data));
    return service;
  }

  async updateService(
    actorId: string,
    serviceId: string,
    input: {
      serviceGroupKey?: string | null;
      name?: string;
      description?: string | null;
      durationMin?: number;
      basePrice?: number;
      priceStep?: number;
      displayOrder?: number;
      active?: boolean;
    },
  ) {
    const existing = await this.prisma.massageService.findUniqueOrThrow({ where: { id: serviceId } });
    const data = normalizeServiceInput(input, false, existing) as Prisma.MassageServiceUncheckedUpdateInput;
    return this.prisma.$transaction(async (tx) => {
      const service = await tx.massageService.update({
        where: { id: serviceId },
        data,
        include: {
          payoutRules: { orderBy: [{ active: 'desc' }, { customerPrice: 'asc' }] },
          _count: { select: { providers: true, bookings: true } },
        },
      });
      let adjustedProviderPrices = 0;
      const nextBasePrice = typeof data.basePrice === 'number' ? data.basePrice : undefined;
      if (nextBasePrice !== undefined) {
        const adjusted = await tx.providerService.updateMany({
          where: { serviceId, price: { lt: nextBasePrice } },
          data: { price: nextBasePrice },
        });
        adjustedProviderPrices = adjusted.count;
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'service.update',
          target: `service:${serviceId}`,
          metadata: toJson({ ...data, adjustedProviderPrices }),
        },
      });
      return service;
    });
  }

  async upsertServicePayoutRule(
    actorId: string,
    serviceId: string,
    input: {
      customerPrice?: number;
      providerPayoutAmount?: number;
      vatBps?: number;
      otherCostAmount?: number;
      active?: boolean;
      notes?: string | null;
    },
  ) {
    const service = await this.prisma.massageService.findUniqueOrThrow({ where: { id: serviceId } });
    const data = normalizeServicePayoutRuleInput(service, input, true);
    const rule = await this.prisma.servicePayoutRule.upsert({
      where: {
        serviceId_customerPrice: {
          serviceId,
          customerPrice: data.customerPrice,
        },
      },
      update: data,
      create: {
        ...data,
        serviceId,
      },
    });
    await this.writeAudit(actorId, 'service_payout_rule.upsert', `service:${serviceId}`, toJson(data));
    return rule;
  }

  async updateServicePayoutRule(
    actorId: string,
    ruleId: string,
    input: {
      customerPrice?: number;
      providerPayoutAmount?: number;
      vatBps?: number;
      otherCostAmount?: number;
      active?: boolean;
      notes?: string | null;
    },
  ) {
    const existing = await this.prisma.servicePayoutRule.findUniqueOrThrow({
      where: { id: ruleId },
      include: { service: true },
    });
    const data = normalizeServicePayoutRuleInput(existing.service, input, false, existing);
    const rule = await this.prisma.servicePayoutRule.update({
      where: { id: ruleId },
      data,
      include: { service: true },
    });
    await this.writeAudit(
      actorId,
      'service_payout_rule.update',
      `service_payout_rule:${ruleId}`,
      toJson(data),
    );
    return rule;
  }

  async markEarningPaid(
    actorId: string,
    earningId: string,
    input: { settlementRef?: string | null; settlementNotes?: string | null } = {},
  ) {
    const earning = await this.earnings.markPaid(earningId, input);
    await this.writeAudit(
      actorId,
      earning.netAmount < 0 ? 'earning.cash_fee_settled' : 'earning.paid',
      `earning:${earning.id}`,
      {
        bookingId: earning.bookingId,
        providerProfileId: earning.providerProfileId,
        netAmount: earning.netAmount,
        settlementRef: earning.settlementRef,
      },
    );
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

function normalizeServiceInput(
  input: {
    serviceGroupKey?: string | null;
    name?: string;
    description?: string | null;
    durationMin?: number;
    basePrice?: number;
    priceStep?: number;
    displayOrder?: number;
    active?: boolean;
  },
  creating: boolean,
  existing?: { name: string; basePrice: number; priceStep: number },
): Prisma.MassageServiceUncheckedCreateInput | Prisma.MassageServiceUncheckedUpdateInput {
  const name = input.name?.trim();
  if (creating && !name) {
    throw new BadRequestException('Service name is required');
  }
  const durationMin = input.durationMin;
  if (
    (creating || durationMin !== undefined) &&
    (!Number.isInteger(durationMin) || (durationMin ?? 0) <= 0)
  ) {
    throw new BadRequestException('Service duration must be a positive integer');
  }

  const nextPriceStep = input.priceStep ?? existing?.priceStep ?? 100000;
  if (!Number.isInteger(nextPriceStep) || nextPriceStep <= 0) {
    throw new BadRequestException('Price step must be a positive integer');
  }
  if (nextPriceStep % PRICE_STEP_UNIT_VND !== 0) {
    throw new BadRequestException(`Price step must use ${PRICE_STEP_UNIT_VND} VND increments`);
  }
  const nextBasePrice = input.basePrice ?? existing?.basePrice;
  if (
    (creating || input.basePrice !== undefined) &&
    (!Number.isInteger(nextBasePrice) || (nextBasePrice ?? 0) <= 0)
  ) {
    throw new BadRequestException('Base price must be a positive integer');
  }
  if (nextBasePrice !== undefined && nextBasePrice % nextPriceStep !== 0) {
    throw new BadRequestException(`Base price must use ${nextPriceStep} VND increments`);
  }

  const nextName = name ?? existing?.name ?? '';
  return {
    serviceGroupKey:
      input.serviceGroupKey === undefined
        ? creating
          ? slugify(nextName)
          : undefined
        : (normalizeNullable(input.serviceGroupKey) ?? null),
    name: name ?? undefined,
    description: input.description === undefined ? undefined : normalizeNullable(input.description),
    durationMin,
    basePrice: input.basePrice,
    priceStep: input.priceStep,
    displayOrder: input.displayOrder,
    active: input.active,
  };
}

function normalizeServicePayoutRuleInput(
  service: { basePrice: number; priceStep: number },
  input: {
    customerPrice?: number;
    providerPayoutAmount?: number;
    vatBps?: number;
    otherCostAmount?: number;
    active?: boolean;
    notes?: string | null;
  },
  creating: boolean,
  existing?: {
    customerPrice: number;
    providerPayoutAmount: number;
    vatBps: number;
    otherCostAmount: number;
    active: boolean;
    notes?: string | null;
  },
) {
  const customerPrice = input.customerPrice ?? existing?.customerPrice;
  if (
    (creating || input.customerPrice !== undefined) &&
    (!Number.isInteger(customerPrice) || (customerPrice ?? 0) <= 0)
  ) {
    throw new BadRequestException('Customer price must be a positive integer');
  }
  if (customerPrice !== undefined && customerPrice < service.basePrice) {
    throw new BadRequestException('Customer price cannot be lower than the admin minimum');
  }
  if (customerPrice !== undefined && customerPrice % service.priceStep !== 0) {
    throw new BadRequestException(`Customer price must use ${service.priceStep} VND increments`);
  }

  const providerPayoutAmount = input.providerPayoutAmount ?? existing?.providerPayoutAmount;
  if (
    (creating || input.providerPayoutAmount !== undefined) &&
    (!Number.isInteger(providerPayoutAmount) || (providerPayoutAmount ?? -1) < 0)
  ) {
    throw new BadRequestException('Provider payout amount must be zero or greater');
  }
  if (
    customerPrice !== undefined &&
    providerPayoutAmount !== undefined &&
    providerPayoutAmount > customerPrice
  ) {
    throw new BadRequestException('Provider payout amount cannot exceed customer price');
  }

  const vatBps = input.vatBps ?? existing?.vatBps ?? 0;
  if (!Number.isInteger(vatBps) || vatBps < 0 || vatBps > 10000) {
    throw new BadRequestException('VAT basis points must be between 0 and 10000');
  }
  const otherCostAmount = input.otherCostAmount ?? existing?.otherCostAmount ?? 0;
  if (!Number.isInteger(otherCostAmount) || otherCostAmount < 0) {
    throw new BadRequestException('Other cost amount must be zero or greater');
  }

  return {
    customerPrice: customerPrice as number,
    providerPayoutAmount: providerPayoutAmount as number,
    vatBps,
    otherCostAmount,
    currency: 'VND',
    active: input.active ?? existing?.active ?? true,
    notes: input.notes === undefined ? existing?.notes : normalizeNullable(input.notes),
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
