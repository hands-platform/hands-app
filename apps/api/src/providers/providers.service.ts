import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  FilePurpose,
  FileReviewStatus,
  FileUploadStatus,
  FileVisibility,
  ProviderAvailabilityIntent,
  ProviderAvailabilityReason,
  ProviderStatus,
  ReviewStatus,
  Role,
  VerificationStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { groupServiceCatalogOptions } from '../services/service-catalog-groups';
import {
  MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY,
  MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY,
  resolveMatchingPolicy,
  safeDistanceMeters,
} from '../matching/matching.policy';
import {
  isVietnamServiceAreaCoordinate,
  providerLocationUpdateDecision,
} from '../locations/location-update-policy';
import {
  ACTIVE_PROVIDER_AVAILABILITY_BOOKING_STATUSES,
  PROVIDER_AVAILABILITY_TIMEZONE,
  providerLastAppActivityAt,
  resolveProviderAvailability,
  validateProviderWorkingHours,
} from './provider-availability';
import { publicProviderDiscoveryWhere, publicProviderIdentityWhere } from './provider-public-readiness';
const DEFAULT_BROWSE_COORDINATE = {
  lat: 10.7769,
  lng: 106.7009,
};
export const ACTIVE_PROVIDER_LOCATION_BOOKING_STATUSES = ACTIVE_PROVIDER_AVAILABILITY_BOOKING_STATUSES;

type PublicProviderDiscoveryOptions = {
  take?: number | string | null;
};

const DEFAULT_PUBLIC_PROVIDER_DISCOVERY_LIMIT = 20;
const MAX_PUBLIC_PROVIDER_DISCOVERY_LIMIT = 50;
const DEFAULT_PUBLIC_DIRECTORY_LIMIT = 24;
const MAX_PUBLIC_DIRECTORY_LIMIT = 48;

type PublicProviderDirectoryOptions = {
  city?: string | null;
  district?: string | null;
  page?: number | string | null;
  take?: number | string | null;
};

@Injectable()
export class ProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisState: RedisStateService,
    private readonly config: ConfigService,
  ) {}

  async findNearby(lat: number, lng: number, options: PublicProviderDiscoveryOptions = {}) {
    const origin = normalizeBrowseCoordinate(lat, lng);
    const take = normalizeBoundedTake(
      options.take,
      DEFAULT_PUBLIC_PROVIDER_DISCOVERY_LIMIT,
      MAX_PUBLIC_PROVIDER_DISCOVERY_LIMIT,
    );

    const locationFreshnessMinutes = await this.publicProviderLocationFreshnessMinutes();
    const staleBefore = new Date(Date.now() - locationFreshnessMinutes * 60_000);

    const providers = await this.prisma.providerProfile.findMany({
      where: publicProviderDiscoveryWhere(),
      include: {
        user: {
          select: {
            fullName: true,
            fileAssets: {
              where: {
                purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
                visibility: FileVisibility.PUBLIC,
                uploadStatus: FileUploadStatus.UPLOADED,
                reviewStatus: FileReviewStatus.APPROVED,
              },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              take: 6,
              select: { id: true, url: true, key: true, purpose: true, contentType: true, sortOrder: true },
            },
          },
        },
        services: {
          where: {
            active: true,
            service: { active: true },
          },
          include: {
            service: {
              include: {
                payoutRules: {
                  where: { active: true },
                  select: {
                    customerPrice: true,
                  },
                },
              },
            },
          },
        },
        reviews: {
          where: { status: ReviewStatus.PUBLISHED },
          select: { rating: true },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            selectedBookings: { where: { status: BookingStatus.COMPLETED } },
          },
        },
      },
      orderBy: [{ currentLocationUpdatedAt: 'desc' }, { updatedAt: 'desc' }],
      take,
    });

    return providers
      .map((provider) => {
        const distanceMeters = safeDistanceMeters(
          origin.lat,
          origin.lng,
          provider.currentLat,
          provider.currentLng,
        );
        const currentLocationUpdatedAt = provider.currentLocationUpdatedAt?.toISOString() ?? null;
        const bookableSummary = providerPublicBookableServiceSummary(provider.services);
        const services = publicNearbyProviderServices(provider.services);
        return {
          ...publicProviderProfile(provider),
          ...approximatePublicProviderLocation(provider.currentLat, provider.currentLng),
          user: publicProviderUser(provider.user),
          services,
          ...publicProviderMedia(provider),
          ...bookableSummary,
          completedBookingCount: provider._count.selectedBookings,
          currentLocationUpdatedAt,
          distanceMeters: approximatePublicDistanceMeters(distanceMeters),
          isRecentLocation: provider.currentLocationUpdatedAt
            ? provider.currentLocationUpdatedAt >= staleBefore
            : false,
        };
      })
      .filter(hasFiniteDistanceMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters || a.status.localeCompare(b.status));
  }

  async listPublicDirectory(options: PublicProviderDirectoryOptions = {}) {
    const page = normalizePositiveInteger(options.page, 1);
    const take = normalizeBoundedTake(
      options.take,
      DEFAULT_PUBLIC_DIRECTORY_LIMIT,
      MAX_PUBLIC_DIRECTORY_LIMIT,
    );
    const regionWhere = publicDirectoryRegionWhere(options.city, options.district);
    const where = {
      ...publicProviderIdentityWhere(),
      services: {
        some: {
          active: true,
          service: { active: true },
        },
      },
      ...(regionWhere ? { AND: regionWhere } : {}),
    };

    const [total, providers] = await Promise.all([
      this.prisma.providerProfile.count({ where }),
      this.prisma.providerProfile.findMany({
        where,
        select: {
          id: true,
          displayName: true,
          bio: true,
          bioTranslations: true,
          experienceYears: true,
          specialties: true,
          languages: true,
          serviceStyle: true,
          city: true,
          residentialAddress: true,
          level: true,
          status: true,
          ratingAvg: true,
          reviewCount: true,
          nextAvailableAt: true,
          user: {
            select: {
              fullName: true,
              fileAssets: {
                where: {
                  purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
                  visibility: FileVisibility.PUBLIC,
                  uploadStatus: FileUploadStatus.UPLOADED,
                  reviewStatus: FileReviewStatus.APPROVED,
                },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                take: 6,
                select: {
                  id: true,
                  url: true,
                  key: true,
                  purpose: true,
                  contentType: true,
                  sortOrder: true,
                },
              },
            },
          },
          services: {
            where: {
              active: true,
              service: { active: true },
            },
            select: {
              active: true,
              price: true,
              service: {
                select: {
                  active: true,
                  basePrice: true,
                  durationMin: true,
                  priceStep: true,
                  payoutRules: {
                    where: { active: true },
                    select: { customerPrice: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }, { displayName: 'asc' }],
        skip: (page - 1) * take,
        take,
      }),
    ]);

    return {
      items: providers.map((provider) => ({
        ...publicProviderProfile(provider),
        user: publicProviderUser(provider.user),
        ...publicProviderMedia(provider),
        ...providerPublicBookableServiceSummary(provider.services),
        location: publicDirectoryLocation(provider.city, provider.residentialAddress),
      })),
      pagination: {
        page,
        pageSize: take,
        total,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
    };
  }

  private async publicProviderLocationFreshnessMinutes() {
    const settings = await this.prisma.operationalPolicySetting.findMany({
      where: {
        key: {
          in: [
            MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY,
            MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY,
          ],
        },
      },
      select: { key: true, value: true },
    });
    const policy = resolveMatchingPolicy(
      this.config,
      Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
    );
    return policy.backupProviderLocationMaxAgeMinutes;
  }

  async getDetail(id: string) {
    const provider = await this.prisma.providerProfile.findFirstOrThrow({
      where: {
        id,
        ...publicProviderIdentityWhere(),
      },
      include: {
        user: {
          select: {
            fullName: true,
            fileAssets: {
              where: {
                purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
                visibility: FileVisibility.PUBLIC,
                uploadStatus: FileUploadStatus.UPLOADED,
                reviewStatus: FileReviewStatus.APPROVED,
              },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              take: 6,
              select: { id: true, url: true, key: true, purpose: true, contentType: true, sortOrder: true },
            },
          },
        },
        verification: { select: { status: true } },
        services: {
          where: {
            active: true,
            service: { active: true },
          },
          include: {
            service: {
              include: {
                payoutRules: {
                  where: { active: true },
                  orderBy: { customerPrice: 'asc' },
                },
              },
            },
          },
        },
        reviews: {
          where: { status: ReviewStatus.PUBLISHED },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return {
      ...publicProviderProfile(provider),
      user: publicProviderUser(provider.user),
      services: publicNearbyProviderServices(provider.services),
      reviews: publicProviderReviews(provider.reviews),
      ...publicProviderMedia(provider),
    };
  }

  async updateProfile(userId: string | undefined, input: { displayName?: string; bio?: string }) {
    const provider = await this.requireProvider(userId);
    return this.prisma.providerProfile.update({
      where: { id: provider.id },
      data: input,
    });
  }

  async setStatus(userId: string | undefined, status: ProviderStatus) {
    const provider = await this.requireProviderAvailability(userId);
    assertProviderNotBlocked(provider);
    const changedAt = new Date();
    const availabilityIntent =
      status === ProviderStatus.OFFLINE
        ? ProviderAvailabilityIntent.OFFLINE
        : ProviderAvailabilityIntent.AVAILABLE;
    const resolution = resolveProviderAvailability({
      activeBookingCount: provider.selectedBookings.length,
      availabilityIntent,
      // An authenticated manual availability change proves the Partner is active now.
      lastAppActivityAt: changedAt,
      now: changedAt,
      timezone: provider.workingHoursTimezone,
      workingHours: provider.workingHours,
    });
    const updated = await this.prisma.providerProfile.update({
      where: { id: provider.id },
      data: {
        availabilityChangedAt: changedAt,
        availabilityIntent: resolution.availabilityIntent,
        availabilityReason: resolution.availabilityReason,
        status: resolution.status,
      },
    });
    await this.redisState.setProviderStatus(provider.id, resolution.status);
    return {
      ...updated,
      availabilitySummary: {
        ...resolution,
        availabilityChangedAt: changedAt.toISOString(),
      },
    };
  }

  async getAvailability(userId: string | undefined) {
    const provider = await this.requireProviderAvailability(userId);
    return providerAvailabilityResponse(provider);
  }

  async updateAvailability(
    userId: string | undefined,
    input: {
      workingHours: Array<{
        weekday: number;
        enabled: boolean;
        startMinute: number;
        endMinute: number;
      }>;
    },
  ) {
    const provider = await this.requireProviderAvailability(userId);
    assertProviderNotBlocked(provider);
    try {
      validateProviderWorkingHours(input.workingHours);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Working hours are invalid');
    }

    const now = new Date();
    const resolution = resolveProviderAvailability({
      activeBookingCount: provider.selectedBookings.length,
      availabilityIntent: provider.availabilityIntent,
      // Saving availability settings is also an authenticated in-app activity.
      lastAppActivityAt: now,
      now,
      timezone: PROVIDER_AVAILABILITY_TIMEZONE,
      workingHours: input.workingHours,
    });

    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.providerWorkingHour.deleteMany({
        where: { providerProfileId: provider.id },
      });
      await transaction.providerWorkingHour.createMany({
        data: input.workingHours.map((row) => ({
          ...row,
          providerProfileId: provider.id,
        })),
      });
      return transaction.providerProfile.update({
        where: { id: provider.id },
        data: {
          availabilityChangedAt: now,
          availabilityIntent: resolution.availabilityIntent,
          availabilityReason: resolution.availabilityReason,
          status: resolution.status,
          workingHoursTimezone: PROVIDER_AVAILABILITY_TIMEZONE,
        },
        include: {
          sessions: {
            orderBy: { lastSeenAt: 'desc' },
            select: { lastSeenAt: true },
            take: 1,
          },
          workingHours: { orderBy: { weekday: 'asc' } },
          selectedBookings: {
            where: { status: { in: [...ACTIVE_PROVIDER_LOCATION_BOOKING_STATUSES] } },
            select: { id: true },
            take: 1,
          },
          user: {
            select: {
              createdAt: true,
              appSessions: {
                where: { role: Role.PROVIDER },
                orderBy: { lastSeenAt: 'desc' },
                select: { lastSeenAt: true },
                take: 1,
              },
              appUsageDailyAggregates: {
                where: { role: Role.PROVIDER },
                orderBy: { lastOccurredAt: 'desc' },
                select: { lastOccurredAt: true },
                take: 1,
              },
            },
          },
        },
      });
    });
    await this.redisState.setProviderStatus(provider.id, resolution.status);
    return providerAvailabilityResponse(updated, now);
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
      ? `Blocked partner account: ${providerBlockReason}`
      : blocked
        ? `Blocked device: ${existingDevice?.blockReason ?? 'No reason saved'}`
        : sharedDeviceCount > 0
          ? `Device is already linked to ${sharedDeviceCount} other partner profile(s).`
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
      blockReason: providerBlocked ? providerBlockReason : (existingDevice?.blockReason ?? null),
      sharedDeviceProfileCount: sharedDeviceCount,
      device: result.device,
      session: result.session,
    };
  }

  async updateLocation(
    userId: string | undefined,
    input: { lat: number; lng: number; addressText?: string; bookingId?: string },
  ) {
    const provider = await this.requireProvider(userId);
    assertProviderNotBlocked(provider);
    assertVietnamCoordinate(input.lat, input.lng, 'Partner location must be inside Vietnam');
    const bookingId = normalizeOptional(input.bookingId);
    const addressText = normalizeOptional(input.addressText);
    let hasActiveBookingContext = false;
    let isFirstBookingLocation = false;
    if (bookingId) {
      const bookingContext = await this.assertProviderLocationBookingContext(provider.id, bookingId);
      hasActiveBookingContext = true;
      isFirstBookingLocation = !bookingContext.hasLocationSnapshot;
    }
    const recordedAt = new Date();
    const decision = providerLocationUpdateDecision({
      previous: isFirstBookingLocation ? null : await this.redisState.getProviderLocation(provider.id),
      next: { lat: input.lat, lng: input.lng },
      now: recordedAt,
      hasActiveBookingContext,
    });
    if (!decision.allowed) {
      return {
        ...provider,
        currentLocationUpdatedAt: provider.currentLocationUpdatedAt?.toISOString() ?? null,
        locationUpdated: false,
        locationUpdateSkippedReason: decision.reason,
      };
    }
    const updated = await this.prisma.providerProfile.update({
      where: { id: provider.id },
      data: {
        currentLat: input.lat,
        currentLng: input.lng,
        currentLocationUpdatedAt: recordedAt,
        locationSnapshots: {
          create: {
            ...(addressText ? { addressText } : {}),
            bookingId,
            lat: input.lat,
            lng: input.lng,
            recordedAt,
          },
        },
      },
    });
    await this.redisState.setProviderLocation(provider.id, {
      lat: input.lat,
      lng: input.lng,
      recordedAt: recordedAt.toISOString(),
    });
    return { ...updated, currentLocationUpdatedAt: recordedAt.toISOString(), locationUpdated: true };
  }

  private async assertProviderLocationBookingContext(providerProfileId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        OR: [{ selectedProviderId: providerProfileId }, { participants: { some: { providerProfileId } } }],
      },
      select: {
        id: true,
        status: true,
        snapshots: {
          where: { providerProfileId },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!booking) {
      throw new BadRequestException('Partner location booking context is invalid');
    }
    if (!ACTIVE_PROVIDER_LOCATION_BOOKING_STATUSES.has(booking.status)) {
      throw new BadRequestException('Partner location booking context is inactive');
    }
    return { hasLocationSnapshot: booking.snapshots.length > 0 };
  }

  async listServices(userId: string | undefined) {
    const provider = await this.requireProvider(userId);
    const services = await this.prisma.massageService.findMany({
      where: { active: true },
      include: {
        providers: {
          where: { providerProfileId: provider.id },
          take: 1,
        },
        payoutRules: {
          where: { active: true },
          orderBy: { customerPrice: 'asc' },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { serviceGroupKey: 'asc' }, { durationMin: 'asc' }],
    });

    return services.map((service) => {
      const providerService = service.providers[0] ?? null;
      const effectivePrice = providerService?.price ?? service.basePrice;
      const payoutRule = service.payoutRules.find((rule) => rule.customerPrice === effectivePrice);
      const platformFee = payoutRule ? effectivePrice - payoutRule.providerPayoutAmount : null;
      const payoutOptions = service.payoutRules.map((rule) => ({
        customerPrice: rule.customerPrice,
        providerPayoutAmount: rule.providerPayoutAmount,
        platformFee: rule.customerPrice - rule.providerPayoutAmount,
        currency: rule.currency,
      }));
      return {
        id: service.id,
        serviceGroupKey: service.serviceGroupKey,
        name: service.name,
        description: service.description,
        durationMin: service.durationMin,
        basePrice: service.basePrice,
        priceStep: service.priceStep,
        displayOrder: service.displayOrder,
        providerServiceId: providerService?.id ?? null,
        providerPrice: providerService?.price ?? null,
        effectivePrice,
        active: providerService?.active ?? true,
        payoutRuleConfigured: Boolean(payoutRule),
        payoutOptions,
        payoutRule: payoutRule
          ? {
              id: payoutRule.id,
              customerPrice: payoutRule.customerPrice,
              providerPayoutAmount: payoutRule.providerPayoutAmount,
              platformFee,
              vatBps: payoutRule.vatBps,
              otherCostAmount: payoutRule.otherCostAmount,
              currency: payoutRule.currency,
            }
          : null,
      };
    });
  }

  async listServiceGroups(userId: string | undefined) {
    return groupServiceCatalogOptions(await this.listServices(userId));
  }

  async updateServicePrice(
    userId: string | undefined,
    serviceId: string,
    input: { price?: number; active?: boolean },
  ) {
    const provider = await this.requireProvider(userId);
    assertProviderNotBlocked(provider);
    const service = await this.prisma.massageService.findFirst({
      where: { id: serviceId, active: true },
      include: {
        payoutRules: {
          where: { active: true },
          select: { customerPrice: true },
        },
      },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const existing = await this.prisma.providerService.findUnique({
      where: {
        providerProfileId_serviceId: {
          providerProfileId: provider.id,
          serviceId,
        },
      },
    });
    const active = input.active ?? existing?.active ?? true;
    const price = input.price ?? existing?.price ?? service.basePrice;
    assertProviderServicePrice(service, price);

    const hasPayoutRule = service.payoutRules.some((rule) => rule.customerPrice === price);
    if (active && !hasPayoutRule) {
      throw new BadRequestException(
        'Admin payout rule is required before this partner price can be activated',
      );
    }

    return this.prisma.providerService.upsert({
      where: {
        providerProfileId_serviceId: {
          providerProfileId: provider.id,
          serviceId,
        },
      },
      create: {
        providerProfileId: provider.id,
        serviceId,
        price,
        active,
      },
      update: {
        price,
        active,
      },
      include: {
        service: {
          include: {
            payoutRules: {
              where: { active: true, customerPrice: price },
              take: 1,
            },
          },
        },
      },
    });
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
      throw new BadRequestException('Authenticated partner is required');
    }

    const provider = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }
    return provider;
  }

  private async requireProviderAvailability(userId?: string) {
    if (!userId) {
      throw new BadRequestException('Authenticated partner is required');
    }
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        sessions: {
          orderBy: { lastSeenAt: 'desc' },
          select: { lastSeenAt: true },
          take: 1,
        },
        workingHours: { orderBy: { weekday: 'asc' } },
        selectedBookings: {
          where: { status: { in: [...ACTIVE_PROVIDER_LOCATION_BOOKING_STATUSES] } },
          select: { id: true },
          take: 1,
        },
        user: {
          select: {
            createdAt: true,
            appSessions: {
              where: { role: Role.PROVIDER },
              orderBy: { lastSeenAt: 'desc' },
              select: { lastSeenAt: true },
              take: 1,
            },
            appUsageDailyAggregates: {
              where: { role: Role.PROVIDER },
              orderBy: { lastOccurredAt: 'desc' },
              select: { lastOccurredAt: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }
    return provider;
  }
}

function providerAvailabilityResponse(
  provider: {
    id: string;
    status: ProviderStatus;
    availabilityIntent: ProviderAvailabilityIntent;
    availabilityReason: ProviderAvailabilityReason;
    availabilityChangedAt: Date;
    workingHoursTimezone: string;
    workingHours: Array<{
      weekday: number;
      enabled: boolean;
      startMinute: number;
      endMinute: number;
    }>;
    selectedBookings: Array<{ id: string }>;
    sessions?: Array<{ lastSeenAt: Date }>;
    currentLocationUpdatedAt?: Date | null;
    user: {
      createdAt?: Date;
      appSessions?: Array<{ lastSeenAt: Date }>;
      appUsageDailyAggregates: Array<{ lastOccurredAt: Date }>;
    };
  },
  now = new Date(),
) {
  const resolution = resolveProviderAvailability({
    activeBookingCount: provider.selectedBookings.length,
    availabilityIntent: provider.availabilityIntent,
    lastAppActivityAt: providerLastAppActivityAt({
      appSessionLastSeenAt: provider.user.appSessions?.[0]?.lastSeenAt,
      currentLocationUpdatedAt: provider.currentLocationUpdatedAt,
      explicitAvailabilityChangedAt:
        provider.availabilityReason === ProviderAvailabilityReason.MANUAL_AVAILABLE ||
        provider.availabilityReason === ProviderAvailabilityReason.MANUAL_OFFLINE
          ? provider.availabilityChangedAt
          : null,
      providerSessionLastSeenAt: provider.sessions?.[0]?.lastSeenAt,
      usageLastOccurredAt: provider.user.appUsageDailyAggregates[0]?.lastOccurredAt,
      userCreatedAt: provider.user.createdAt,
    }),
    now,
    timezone: provider.workingHoursTimezone,
    workingHours: provider.workingHours,
  });
  return {
    availabilityChangedAt: provider.availabilityChangedAt.toISOString(),
    persistedReason: provider.availabilityReason,
    persistedStatus: provider.status,
    timezone: provider.workingHoursTimezone,
    workingHours: provider.workingHours,
    ...resolution,
  };
}

function assertVietnamCoordinate(lat: number, lng: number, message: string) {
  assertCoordinate(lat, lng, message);
  if (!isVietnamServiceAreaCoordinate(lat, lng)) {
    throw new BadRequestException(message);
  }
}

function normalizeBoundedTake(value: number | string | null | undefined, fallback: number, max: number) {
  const numericValue = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (
    !Number.isFinite(numericValue) ||
    numericValue === undefined ||
    numericValue === null ||
    numericValue <= 0
  ) {
    return fallback;
  }
  return Math.min(Math.trunc(numericValue), max);
}

function normalizeBrowseCoordinate(lat: number, lng: number) {
  if (isValidCoordinate(lat, lng)) {
    return { lat, lng };
  }
  return DEFAULT_BROWSE_COORDINATE;
}

function hasFiniteDistanceMeters<T extends { distanceMeters: number | null }>(
  provider: T,
): provider is T & { distanceMeters: number } {
  return Number.isFinite(provider.distanceMeters);
}

function assertCoordinate(lat: number, lng: number, message: string) {
  if (!isValidCoordinate(lat, lng)) {
    throw new BadRequestException(message);
  }
}

function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function assertProviderNotBlocked(provider: { blockedAt: Date | null; blockedReason: string | null }) {
  if (provider.blockedAt) {
    throw new BadRequestException(
      provider.blockedReason
        ? `Partner account is blocked by admin review: ${provider.blockedReason}`
        : 'Partner account is blocked by admin review.',
    );
  }
}

function assertProviderServicePrice(service: { basePrice: number; priceStep: number }, price: number) {
  if (!Number.isInteger(price) || price <= 0) {
    throw new BadRequestException('Partner service price is invalid');
  }
  if (price < service.basePrice) {
    throw new BadRequestException('Partner service price cannot be lower than the admin minimum');
  }
  if (price >= service.basePrice * 2) {
    throw new BadRequestException('Partner service price cannot be 2x or more than the admin minimum');
  }
  if (price % service.priceStep !== 0) {
    throw new BadRequestException(`Partner service price must use ${service.priceStep} VND increments`);
  }
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

const PUBLIC_DIRECTORY_CITIES = {
  'ho-chi-minh': {
    label: 'Ho Chi Minh City',
    aliases: ['ho chi minh', 'hồ chí minh', 'hcm', 'saigon', 'sài gòn'],
  },
  'ha-noi': {
    label: 'Ha Noi',
    aliases: ['ha noi', 'hà nội', 'hanoi'],
  },
  'da-nang': {
    label: 'Da Nang',
    aliases: ['da nang', 'đà nẵng'],
  },
  'nha-trang': {
    label: 'Nha Trang',
    aliases: ['nha trang'],
  },
} as const;

const PUBLIC_DIRECTORY_DISTRICTS = {
  'district-1': { label: 'District 1', aliases: ['district 1', 'quận 1', 'quan 1', 'q1'] },
  'district-2': { label: 'District 2', aliases: ['district 2', 'quận 2', 'quan 2', 'q2'] },
  'district-3': { label: 'District 3', aliases: ['district 3', 'quận 3', 'quan 3', 'q3'] },
  'district-4': { label: 'District 4', aliases: ['district 4', 'quận 4', 'quan 4', 'q4'] },
  'district-5': { label: 'District 5', aliases: ['district 5', 'quận 5', 'quan 5', 'q5'] },
  'district-7': { label: 'District 7', aliases: ['district 7', 'quận 7', 'quan 7', 'q7'] },
  'binh-thanh': {
    label: 'Binh Thanh',
    aliases: ['binh thanh', 'bình thạnh'],
  },
  'phu-nhuan': {
    label: 'Phu Nhuan',
    aliases: ['phu nhuan', 'phú nhuận'],
  },
  'thu-duc': { label: 'Thu Duc', aliases: ['thu duc', 'thủ đức'] },
  'ba-dinh': { label: 'Ba Dinh', aliases: ['ba dinh', 'ba đình'] },
  'hoan-kiem': { label: 'Hoan Kiem', aliases: ['hoan kiem', 'hoàn kiếm'] },
  'tay-ho': { label: 'Tay Ho', aliases: ['tay ho', 'tây hồ'] },
  'cau-giay': { label: 'Cau Giay', aliases: ['cau giay', 'cầu giấy'] },
  'hai-chau': { label: 'Hai Chau', aliases: ['hai chau', 'hải châu'] },
  'son-tra': { label: 'Son Tra', aliases: ['son tra', 'sơn trà'] },
} as const;

function publicDirectoryRegionWhere(city?: string | null, district?: string | null) {
  const cityDefinition = city ? PUBLIC_DIRECTORY_CITIES[city as keyof typeof PUBLIC_DIRECTORY_CITIES] : null;
  const districtDefinition = district
    ? PUBLIC_DIRECTORY_DISTRICTS[district as keyof typeof PUBLIC_DIRECTORY_DISTRICTS]
    : null;
  const filters = [];

  if (city && city !== 'vietnam') {
    if (!cityDefinition) {
      throw new BadRequestException('Unsupported public Partner city');
    }
    filters.push({
      OR: cityDefinition.aliases.flatMap((alias) => [
        { city: { contains: alias, mode: 'insensitive' as const } },
        { residentialAddress: { contains: alias, mode: 'insensitive' as const } },
      ]),
    });
  }

  if (district && district !== 'all') {
    if (!districtDefinition) {
      throw new BadRequestException('Unsupported public Partner district');
    }
    filters.push({
      OR: districtDefinition.aliases.map((alias) => ({
        residentialAddress: { contains: alias, mode: 'insensitive' as const },
      })),
    });
  }

  return filters.length ? filters : null;
}

function publicDirectoryLocation(city: string | null, residentialAddress: string | null) {
  const source = normalizeDirectoryText([city, residentialAddress].filter(Boolean).join(' '));
  const cityEntry = Object.entries(PUBLIC_DIRECTORY_CITIES).find(([, definition]) =>
    definition.aliases.some((alias) => source.includes(normalizeDirectoryText(alias))),
  );
  const districtEntry = Object.entries(PUBLIC_DIRECTORY_DISTRICTS).find(([, definition]) =>
    definition.aliases.some((alias) => source.includes(normalizeDirectoryText(alias))),
  );

  return {
    citySlug: cityEntry?.[0] ?? 'vietnam',
    cityLabel: cityEntry?.[1].label ?? city ?? 'Vietnam',
    districtSlug: districtEntry?.[0] ?? 'all',
    districtLabel: districtEntry?.[1].label ?? null,
  };
}

function normalizeDirectoryText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizePositiveInteger(value: number | string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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
  const galleryImageUrls = media.filter((file) => file.url).map((file) => file.url as string);

  return {
    profileImageUrl: profileImage,
    galleryImageUrls,
  };
}

function publicProviderUser(user?: { fullName: string | null } | null) {
  return user
    ? {
        fullName: user.fullName,
      }
    : null;
}

function publicProviderProfile(provider: {
  id: string;
  displayName: string;
  bio?: string | null;
  bioTranslations?: unknown;
  experienceYears?: number | null;
  specialties?: unknown;
  languages?: unknown;
  serviceStyle?: string | null;
  city?: string | null;
  level?: unknown;
  status: ProviderStatus;
  ratingAvg: unknown;
  reviewCount: number;
  nextAvailableAt?: Date | null;
}) {
  return {
    id: provider.id,
    displayName: provider.displayName,
    bio: provider.bio ?? null,
    bioTranslations: provider.bioTranslations ?? null,
    experienceYears: provider.experienceYears ?? null,
    specialties: provider.specialties ?? null,
    languages: provider.languages ?? null,
    serviceStyle: provider.serviceStyle ?? null,
    city: provider.city ?? null,
    level: provider.level ?? null,
    status: provider.status,
    ratingAvg: provider.ratingAvg,
    reviewCount: provider.reviewCount,
    nextAvailableAt: provider.nextAvailableAt?.toISOString() ?? null,
  };
}

function approximatePublicProviderLocation(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { currentLat: null, currentLng: null, locationPrecision: 'UNAVAILABLE' as const };
  }
  return {
    currentLat: roundCoordinate(latitude, 2),
    currentLng: roundCoordinate(longitude, 2),
    locationPrecision: 'APPROXIMATE' as const,
  };
}

function approximatePublicDistanceMeters(distanceMeters: number | null) {
  if (!Number.isFinite(distanceMeters)) {
    return null;
  }
  return Math.max(0, Math.round((distanceMeters as number) / 1000) * 1000);
}

function roundCoordinate(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function publicProviderReviews(
  reviews: Array<{
    rating: number;
    comment: string | null;
    createdAt: Date | string;
    createdByAdminId?: string | null;
    status?: ReviewStatus | string;
  }>,
) {
  return reviews
    .filter((review) => review.status === undefined || review.status === ReviewStatus.PUBLISHED)
    .map((review) => ({
      rating: review.rating,
      comment: review.comment,
      managedByAdmin: Boolean(review.createdByAdminId),
      createdAt: review.createdAt instanceof Date ? review.createdAt.toISOString() : review.createdAt,
    }));
}

function providerPublicBookableServiceSummary(
  providerServices: Array<{
    active: boolean;
    price: number;
    service: {
      active: boolean;
      basePrice: number;
      durationMin: number;
      priceStep: number;
      payoutRules?: Array<{ customerPrice: number }>;
    };
  }>,
) {
  const bookableServices = providerServices
    .map((providerService) => {
      const customerPrice = providerService.price ?? providerService.service.basePrice;
      const priceStep = providerService.service.priceStep || 100000;
      const hasPayoutRule = (providerService.service.payoutRules ?? []).some(
        (rule) => rule.customerPrice === customerPrice,
      );
      const validPrice =
        Number.isInteger(customerPrice) &&
        customerPrice >= providerService.service.basePrice &&
        customerPrice < providerService.service.basePrice * 2 &&
        customerPrice % priceStep === 0;

      return {
        active: providerService.active && providerService.service.active,
        customerPrice,
        durationMin: providerService.service.durationMin,
        hasPayoutRule,
        validPrice,
      };
    })
    .filter((service) => service.active && service.validPrice && service.hasPayoutRule)
    .sort((a, b) => a.customerPrice - b.customerPrice || a.durationMin - b.durationMin);

  const first = bookableServices[0] ?? null;
  return {
    bookableServiceCount: bookableServices.length,
    hasBookableServices: bookableServices.length > 0,
    startingPrice: first?.customerPrice ?? null,
    startingDurationMin: first?.durationMin ?? null,
  };
}

function publicNearbyProviderServices(
  providerServices: Array<{
    id: string;
    providerProfileId: string;
    serviceId: string;
    price: number;
    active: boolean;
    service: {
      id: string;
      serviceGroupKey: string | null;
      name: string;
      description: string | null;
      durationMin: number;
      basePrice: number;
      priceStep: number;
      displayOrder: number;
      active: boolean;
      payoutRules?: Array<{ customerPrice: number; active?: boolean }>;
    };
  }>,
) {
  return providerServices.map((providerService) => {
    const customerPrice = providerService.price ?? providerService.service.basePrice;
    const priceStep = providerService.service.priceStep || 100000;
    const validPrice =
      Number.isInteger(customerPrice) &&
      customerPrice >= providerService.service.basePrice &&
      customerPrice < providerService.service.basePrice * 2 &&
      customerPrice % priceStep === 0;
    const hasPayoutRule = (providerService.service.payoutRules ?? []).some(
      (rule) => rule.active !== false && rule.customerPrice === customerPrice,
    );

    return {
      id: providerService.id,
      providerProfileId: providerService.providerProfileId,
      serviceId: providerService.serviceId,
      price: providerService.price,
      active: providerService.active,
      bookable: providerService.active && providerService.service.active && validPrice && hasPayoutRule,
      service: {
        id: providerService.service.id,
        serviceGroupKey: providerService.service.serviceGroupKey,
        name: providerService.service.name,
        description: providerService.service.description,
        durationMin: providerService.service.durationMin,
        basePrice: providerService.service.basePrice,
        priceStep: providerService.service.priceStep,
        displayOrder: providerService.service.displayOrder,
        active: providerService.service.active,
      },
    };
  });
}
