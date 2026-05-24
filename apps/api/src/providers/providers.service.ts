import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FilePurpose, FileUploadStatus, FileVisibility, ProviderStatus, VerificationStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';

@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisState: RedisStateService,
    private readonly config: ConfigService,
  ) {}

  async findNearby(lat: number, lng: number) {
    assertVietnamCoordinate(lat, lng, 'lat and lng query params are required');

    const radiusMeters = Number(this.config.get<string>('PROVIDER_SEARCH_RADIUS_METERS') ?? 5000);
    const staleAfterMinutes = Number(this.config.get<string>('PROVIDER_STALE_AFTER_MINUTES') ?? 30);
    const hideAfterHours = Number(this.config.get<string>('PROVIDER_HIDE_AFTER_HOURS') ?? 24);
    const hideBefore = new Date(Date.now() - hideAfterHours * 60 * 60_000);
    const staleBefore = new Date(Date.now() - staleAfterMinutes * 60_000);

    const providers = await this.prisma.providerProfile.findMany({
      where: {
        status: { in: [ProviderStatus.ONLINE_AVAILABLE, ProviderStatus.ONLINE_AVAILABLE_SOON] },
        blockedAt: null,
        currentLat: { not: null },
        currentLng: { not: null },
        currentLocationUpdatedAt: { gte: hideBefore },
        verification: { status: VerificationStatus.APPROVED },
      },
      include: {
        user: {
          select: {
            fullName: true,
            phone: true,
            fileAssets: {
              where: {
                purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
                visibility: FileVisibility.PUBLIC,
                uploadStatus: FileUploadStatus.UPLOADED,
              },
              orderBy: { createdAt: 'desc' },
              take: 6,
              select: { id: true, url: true, key: true, purpose: true, contentType: true },
            },
          },
        },
        services: { include: { service: true } },
        reviews: { select: { rating: true }, take: 20, orderBy: { createdAt: 'desc' } },
      },
      take: 100,
    });

    return providers
      .map((provider) => {
        const distanceMeters = roundTo100Meters(
          haversineMeters(lat, lng, Number(provider.currentLat), Number(provider.currentLng)),
        );
        const currentLocationUpdatedAt = provider.currentLocationUpdatedAt?.toISOString() ?? null;
        return {
          ...provider,
          ...publicProviderMedia(provider),
          currentLocationUpdatedAt,
          distanceMeters,
          isRecentLocation: provider.currentLocationUpdatedAt
            ? provider.currentLocationUpdatedAt >= staleBefore
            : false,
        };
      })
      .filter((provider) => provider.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters || a.status.localeCompare(b.status));
  }

  async getDetail(id: string) {
    const provider = await this.prisma.providerProfile.findFirstOrThrow({
      where: { id, blockedAt: null },
      include: {
        user: {
          select: {
            fullName: true,
            fileAssets: {
              where: {
                purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
                visibility: FileVisibility.PUBLIC,
                uploadStatus: FileUploadStatus.UPLOADED,
              },
              orderBy: { createdAt: 'desc' },
              take: 6,
              select: { id: true, url: true, key: true, purpose: true, contentType: true },
            },
          },
        },
        verification: { select: { status: true } },
        services: { include: { service: true } },
        reviews: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
    return { ...provider, ...publicProviderMedia(provider) };
  }

  async updateProfile(userId: string | undefined, input: { displayName?: string; bio?: string }) {
    const provider = await this.requireProvider(userId);
    return this.prisma.providerProfile.update({
      where: { id: provider.id },
      data: input,
    });
  }

  async setStatus(userId: string | undefined, status: ProviderStatus) {
    const provider = await this.requireProvider(userId);
    assertProviderNotBlocked(provider);
    const updated = await this.prisma.providerProfile.update({
      where: { id: provider.id },
      data: { status },
    });
    await this.redisState.setProviderStatus(provider.id, status);
    return updated;
  }

  async recordDeviceSession(
    userId: string | undefined,
    input: { deviceId?: string; platform?: string; appVersion?: string },
    ipAddress?: string,
  ) {
    const provider = await this.requireProvider(userId);
    const deviceId = normalizeRequired(input.deviceId, 'deviceId is required');
    const platform = normalizeOptional(input.platform);
    const appVersion = normalizeOptional(input.appVersion);
    const now = new Date();
    const providerBlocked = Boolean(provider.blockedAt);
    const providerBlockReason = provider.blockedReason ?? 'No reason saved';

    const [existingDevice, sharedDeviceCount] = await Promise.all([
      this.prisma.providerDevice.findUnique({
        where: {
          providerProfileId_deviceId: {
            providerProfileId: provider.id,
            deviceId,
          },
        },
      }),
      this.prisma.providerDevice.count({
        where: {
          deviceId,
          providerProfileId: { not: provider.id },
        },
      }),
    ]);

    const blocked = Boolean(existingDevice?.blockedAt);
    const suspicious = providerBlocked || blocked || sharedDeviceCount > 0;
    const suspiciousReason = providerBlocked
      ? `Blocked provider account: ${providerBlockReason}`
      : blocked
        ? `Blocked device: ${existingDevice?.blockReason ?? 'No reason saved'}`
        : sharedDeviceCount > 0
          ? `Device is already linked to ${sharedDeviceCount} other provider profile(s).`
          : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const device = existingDevice
        ? await tx.providerDevice.update({
            where: { id: existingDevice.id },
            data: {
              platform,
              appVersion,
              lastSeenAt: now,
            },
          })
        : await tx.providerDevice.create({
            data: {
              providerProfileId: provider.id,
              deviceId,
              platform,
              appVersion,
              enabled: true,
              lastSeenAt: now,
            },
          });

      const session = await tx.providerSession.create({
        data: {
          providerProfileId: provider.id,
          deviceId,
          ipAddress: normalizeOptional(ipAddress),
          appVersion,
          lastSeenAt: now,
          suspicious,
          suspiciousReason,
        },
      });

      return { device, session };
    });

    return {
      ok: !blocked && !providerBlocked,
      blocked: blocked || providerBlocked,
      blockedScope: providerBlocked ? 'provider' : blocked ? 'device' : null,
      providerBlocked,
      blockReason: providerBlocked ? providerBlockReason : existingDevice?.blockReason ?? null,
      sharedDeviceProfileCount: sharedDeviceCount,
      device: result.device,
      session: result.session,
    };
  }

  async updateLocation(userId: string | undefined, input: { lat: number; lng: number }) {
    const provider = await this.requireProvider(userId);
    assertProviderNotBlocked(provider);
    assertVietnamCoordinate(input.lat, input.lng, 'Provider location must be inside Vietnam');
    const recordedAt = new Date();
    const updated = await this.prisma.providerProfile.update({
      where: { id: provider.id },
      data: {
        currentLat: input.lat,
        currentLng: input.lng,
        currentLocationUpdatedAt: recordedAt,
        locationSnapshots: { create: { lat: input.lat, lng: input.lng, recordedAt } },
      },
    });
    await this.redisState.setProviderLocation(provider.id, {
      ...input,
      recordedAt: recordedAt.toISOString(),
    });
    return { ...updated, currentLocationUpdatedAt: recordedAt.toISOString(), locationUpdated: true };
  }

  async getVerification(userId: string | undefined) {
    const provider = await this.requireProvider(userId);
    return this.prisma.providerVerification.upsert({
      where: { providerProfileId: provider.id },
      update: {},
      create: { providerProfileId: provider.id },
      include: { files: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async submitVerification(userId: string | undefined, input: { fileIds?: string[] }) {
    const provider = await this.requireProvider(userId);
    const verification = await this.prisma.providerVerification.upsert({
      where: { providerProfileId: provider.id },
      update: {
        status: VerificationStatus.SUBMITTED,
        submittedAt: new Date(),
        rejectionReason: null,
      },
      create: {
        providerProfileId: provider.id,
        status: VerificationStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    if (input.fileIds?.length) {
      await this.prisma.fileAsset.updateMany({
        where: {
          id: { in: input.fileIds },
          visibility: FileVisibility.PRIVATE,
        },
        data: { providerVerificationId: verification.id },
      });
    }

    return this.prisma.providerVerification.findUniqueOrThrow({
      where: { id: verification.id },
      include: { files: { orderBy: { createdAt: 'desc' } } },
    });
  }

  private async requireProvider(userId?: string) {
    if (!userId) {
      throw new BadRequestException('Authenticated provider is required');
    }

    const provider = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }
    return provider;
  }
}

function roundTo100Meters(value: number) {
  return Math.round(value / 100) * 100;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function assertVietnamCoordinate(lat: number, lng: number, message: string) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isVietnamCoordinate(lat, lng)) {
    throw new BadRequestException(message);
  }
}

function assertProviderNotBlocked(provider: { blockedAt: Date | null; blockedReason: string | null }) {
  if (provider.blockedAt) {
    throw new BadRequestException(
      provider.blockedReason
        ? `Provider account is blocked by admin review: ${provider.blockedReason}`
        : 'Provider account is blocked by admin review.',
    );
  }
}

function isVietnamCoordinate(lat: number, lng: number) {
  return lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.0;
}

function normalizeRequired(value: string | undefined, message: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new BadRequestException(message);
  }
  return normalized.slice(0, 160);
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 160) : undefined;
}

function publicProviderMedia(provider: {
  user?: {
    fileAssets?: Array<{
      url: string | null;
      purpose: FilePurpose;
    }>;
  } | null;
}) {
  const media = provider.user?.fileAssets ?? [];
  const profileImage =
    media.find((file) => file.purpose === FilePurpose.PROFILE_IMAGE && file.url)?.url ??
    media.find((file) => file.url)?.url ??
    null;
  const galleryImageUrls = media
    .filter((file) => file.url)
    .map((file) => file.url as string);

  return {
    profileImageUrl: profileImage,
    galleryImageUrls,
  };
}
