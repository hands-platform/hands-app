import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AppUsageEventType,
  AppUsageOrigin,
  BookingStatus,
  FilePurpose,
  FileReviewStatus,
  FileUploadStatus,
  FileVisibility,
  Prisma,
  Role,
} from '@prisma/client';
import {
  appUsageDailyAggregateBoundsUpdates,
  appUsageDailyAggregateUpsert,
} from '../app-usage/app-usage-daily-aggregate';
import { safeDistanceMeters } from '../matching/matching.policy';
import { PrismaService } from '../prisma/prisma.service';

const customerFavoriteProviderSelect = {
  id: true,
  providerProfileId: true,
  createdAt: true,
  providerProfile: {
    select: {
      id: true,
      displayName: true,
      status: true,
      ratingAvg: true,
      reviewCount: true,
      user: {
        select: {
          fullName: true,
        },
      },
    },
  },
} satisfies Prisma.CustomerFavoriteProviderSelect;

const customerViewedProviderSelect = {
  id: true,
  providerProfileId: true,
  firstViewedAt: true,
  lastViewedAt: true,
  viewCount: true,
  providerProfile: {
    select: {
      id: true,
      displayName: true,
      status: true,
      ratingAvg: true,
      reviewCount: true,
      user: {
        select: {
          fullName: true,
        },
      },
    },
  },
} satisfies Prisma.CustomerProviderProfileViewSelect;

const customerHomePartnerSelect = {
  id: true,
  displayName: true,
  status: true,
  ratingAvg: true,
  reviewCount: true,
  currentLat: true,
  currentLng: true,
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
        orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
        take: 1,
        select: {
          url: true,
          purpose: true,
        },
      },
    },
  },
} satisfies Prisma.ProviderProfileSelect;

type CustomerHomePartner = Prisma.ProviderProfileGetPayload<{
  select: typeof customerHomePartnerSelect;
}>;

const CUSTOMER_HOME_PARTNER_LIMIT = 12;
const CUSTOMER_HOME_PARTNER_CANDIDATE_LIMIT = 100;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async listFavoriteProviders(userId: string | undefined) {
    const customer = await this.requireCustomer(userId);
    return this.prisma.customerFavoriteProvider.findMany({
      where: { customerProfileId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: customerFavoriteProviderSelect,
    });
  }

  async getHomeSummary(userId: string | undefined, lat: number, lng: number) {
    const customer = await this.requireCustomer(userId);
    const [wallet, favorites, completedBookings] = await Promise.all([
      this.prisma.customerWalletLedgerEntry.aggregate({
        where: { customerProfileId: customer.id },
        _sum: { amount: true },
      }),
      this.prisma.customerFavoriteProvider.findMany({
        where: {
          customerProfileId: customer.id,
          providerProfile: {
            blockedAt: null,
            deletedAt: null,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: CUSTOMER_HOME_PARTNER_CANDIDATE_LIMIT,
        select: {
          providerProfile: {
            select: customerHomePartnerSelect,
          },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          customerProfileId: customer.id,
          status: BookingStatus.COMPLETED,
          selectedProviderId: { not: null },
          selectedProvider: {
            blockedAt: null,
            deletedAt: null,
          },
        },
        orderBy: [{ closedAt: 'desc' }, { updatedAt: 'desc' }],
        take: CUSTOMER_HOME_PARTNER_CANDIDATE_LIMIT,
        select: {
          closedAt: true,
          updatedAt: true,
          selectedProvider: {
            select: customerHomePartnerSelect,
          },
        },
      }),
    ]);

    const completedPartners = new Map<string, { provider: CustomerHomePartner; lastCompletedAt: Date }>();
    for (const booking of completedBookings) {
      const provider = booking.selectedProvider;
      if (!provider || completedPartners.has(provider.id)) {
        continue;
      }
      completedPartners.set(provider.id, {
        provider,
        lastCompletedAt: booking.closedAt ?? booking.updatedAt,
      });
    }

    return {
      wallet: {
        balance: wallet._sum.amount ?? 0,
        currency: 'VND',
      },
      favoritePartners: sortCustomerHomePartners(
        favorites.map(({ providerProfile }) => customerHomePartnerResponse(providerProfile, lat, lng)),
      ).slice(0, CUSTOMER_HOME_PARTNER_LIMIT),
      completedPartners: sortCustomerHomePartners(
        [...completedPartners.values()].map(({ provider, lastCompletedAt }) => ({
          ...customerHomePartnerResponse(provider, lat, lng),
          lastCompletedAt: lastCompletedAt.toISOString(),
        })),
      ).slice(0, CUSTOMER_HOME_PARTNER_LIMIT),
    };
  }

  async getWallet(userId: string | undefined) {
    const customer = await this.requireCustomer(userId);
    const [wallet, entries] = await Promise.all([
      this.prisma.customerWalletLedgerEntry.aggregate({
        where: { customerProfileId: customer.id },
        _sum: { amount: true },
      }),
      this.prisma.customerWalletLedgerEntry.findMany({
        where: { customerProfileId: customer.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          bookingId: true,
          referralRewardId: true,
          type: true,
          amount: true,
          currency: true,
          reference: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      balance: wallet._sum.amount ?? 0,
      currency: 'VND',
      entries: entries.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  async listViewedProviders(userId: string | undefined) {
    const customer = await this.requireCustomer(userId);
    return this.prisma.customerProviderProfileView.findMany({
      where: { customerProfileId: customer.id },
      orderBy: { lastViewedAt: 'desc' },
      take: 100,
      select: customerViewedProviderSelect,
    });
  }

  async recordProviderProfileView(
    userId: string | undefined,
    providerProfileId: string,
    rawClientEventId?: string,
  ) {
    const customer = await this.requireCustomer(userId);
    const provider = await this.prisma.providerProfile.findFirst({
      where: {
        id: providerProfileId,
        blockedAt: null,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }

    const now = new Date();
    const clientEventId = normalizedOptionalText(rawClientEventId);

    return this.prisma.$transaction(async (transaction) => {
      const existingEvent = clientEventId
        ? await transaction.appUsageEvent.findUnique({
            where: { clientEventId },
            select: { eventType: true, userId: true },
          })
        : null;

      if (
        existingEvent &&
        (existingEvent.userId !== customer.userId ||
          existingEvent.eventType !== AppUsageEventType.PROVIDER_PROFILE_VIEW)
      ) {
        throw new BadRequestException('clientEventId is already assigned to another app event');
      }

      if (existingEvent) {
        return transaction.customerProviderProfileView.findUniqueOrThrow({
          where: {
            customerProfileId_providerProfileId: {
              customerProfileId: customer.id,
              providerProfileId,
            },
          },
          select: customerViewedProviderSelect,
        });
      }

      const profileView = await transaction.customerProviderProfileView.upsert({
        where: {
          customerProfileId_providerProfileId: {
            customerProfileId: customer.id,
            providerProfileId,
          },
        },
        create: {
          customerProfileId: customer.id,
          providerProfileId,
          firstViewedAt: now,
          lastViewedAt: now,
          viewCount: 1,
        },
        update: {
          lastViewedAt: now,
          viewCount: { increment: 1 },
        },
        select: customerViewedProviderSelect,
      });

      await transaction.appUsageEvent.create({
        data: {
          clientEventId,
          userId: customer.userId,
          role: Role.CUSTOMER,
          eventType: AppUsageEventType.PROVIDER_PROFILE_VIEW,
          origin: AppUsageOrigin.PRODUCTION,
          subjectType: 'PROVIDER_PROFILE',
          subjectId: providerProfileId,
          occurredAt: now,
        },
        select: { id: true },
      });
      const aggregateInput = {
        eventType: AppUsageEventType.PROVIDER_PROFILE_VIEW,
        occurredAt: now,
        origin: AppUsageOrigin.PRODUCTION,
        role: Role.CUSTOMER,
        userId: customer.userId,
      };
      await transaction.appUsageDailyAggregate.upsert(appUsageDailyAggregateUpsert(aggregateInput));
      for (const boundsUpdate of appUsageDailyAggregateBoundsUpdates(aggregateInput)) {
        await transaction.appUsageDailyAggregate.updateMany(boundsUpdate);
      }

      return profileView;
    });
  }

  async setFavoriteProvider(userId: string | undefined, providerProfileId: string, favorite: boolean) {
    const customer = await this.requireCustomer(userId);
    const provider = await this.prisma.providerProfile.findFirst({
      where: {
        id: providerProfileId,
        blockedAt: null,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }

    if (!favorite) {
      await this.prisma.customerFavoriteProvider.deleteMany({
        where: {
          customerProfileId: customer.id,
          providerProfileId,
        },
      });
      return { favorite: false, providerProfileId };
    }

    const record = await this.prisma.customerFavoriteProvider.upsert({
      where: {
        customerProfileId_providerProfileId: {
          customerProfileId: customer.id,
          providerProfileId,
        },
      },
      create: {
        customerProfileId: customer.id,
        providerProfileId,
      },
      update: {},
      select: customerFavoriteProviderSelect,
    });

    return {
      favorite: true,
      providerProfileId,
      record,
    };
  }

  async createReview(
    userId: string | undefined,
    input: { bookingId: string; rating: number; comment?: string },
  ) {
    const customer = await this.requireCustomer(userId);
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: input.bookingId } });
    if (booking.customerProfileId !== customer.id) {
      throw new BadRequestException('Booking does not belong to this customer');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Review is allowed only after service completion');
    }
    if (!booking.selectedProviderId) {
      throw new BadRequestException('Booking has no selected partner');
    }
    if (input.rating < 1 || input.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const existingReview = await tx.review.findUnique({
        where: { bookingId: booking.id },
      });
      if (existingReview) {
        throw new BadRequestException('Review already exists for this booking');
      }

      const review = await tx.review.create({
        data: {
          bookingId: booking.id,
          customerProfileId: customer.id,
          providerProfileId: booking.selectedProviderId!,
          rating: input.rating,
          comment: normalizeNullableText(input.comment),
        },
      });

      await recalculateProviderRating(tx, booking.selectedProviderId!);
      return review;
    });

    return review;
  }

  async previewCoupon(input: { code: string; serviceId: string; subtotal: number }): Promise<{
    valid: boolean;
    code: string;
    discountAmount: number;
    finalAmount: number;
    description?: string | null;
  }> {
    const code = input.code.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('Coupon code is required');
    }

    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.active) {
      throw new BadRequestException('Coupon is not available');
    }

    const now = Date.now();
    if (coupon.startsAt && coupon.startsAt.getTime() > now) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (coupon.endsAt && coupon.endsAt.getTime() < now) {
      throw new BadRequestException('Coupon has expired');
    }

    const service = await this.prisma.massageService.findUniqueOrThrow({ where: { id: input.serviceId } });
    const subtotal = input.subtotal > 0 ? input.subtotal : service.basePrice;
    const discount = normalizePercentDiscount(coupon.discount);
    if (!discount) {
      throw new BadRequestException('Coupon format is not supported');
    }

    const discountAmount = Math.min(subtotal, Math.round((subtotal * discount.value) / 100));
    const finalAmount = Math.max(0, subtotal - discountAmount);

    return {
      valid: true,
      code: coupon.code,
      description: coupon.description,
      discountAmount,
      finalAmount,
    };
  }

  private async requireCustomer(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException('Authenticated customer is required');
    }

    return this.prisma.customerProfile.findUniqueOrThrow({ where: { userId } });
  }
}

function normalizedOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeNullableText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizePercentDiscount(discount: Prisma.JsonValue): { type: 'percent'; value: number } | null {
  if (!discount || typeof discount !== 'object' || Array.isArray(discount)) {
    return null;
  }

  const input = discount as { type?: unknown; value?: unknown };
  const type = typeof input.type === 'string' ? input.type : null;
  const value =
    typeof input.value === 'number'
      ? input.value
      : typeof input.value === 'string'
        ? Number(input.value)
        : NaN;

  if (type !== 'percent' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return { type: 'percent', value };
}

async function recalculateProviderRating(tx: Prisma.TransactionClient, providerProfileId: string) {
  const aggregate = await tx.review.aggregate({
    where: { providerProfileId, status: 'PUBLISHED' },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await tx.providerProfile.update({
    where: { id: providerProfileId },
    data: {
      ratingAvg: aggregate._avg.rating ?? 0,
      reviewCount: aggregate._count.rating,
    },
  });
}

function customerHomePartnerResponse(provider: CustomerHomePartner, lat: number, lng: number) {
  const distanceMeters = safeDistanceMeters(lat, lng, provider.currentLat, provider.currentLng);
  const media = provider.user.fileAssets;
  const profileImageUrl =
    media.find((file) => file.purpose === FilePurpose.PROFILE_IMAGE && file.url)?.url ??
    media.find((file) => file.url)?.url ??
    null;

  return {
    id: provider.id,
    displayName: provider.displayName || provider.user.fullName || 'Partner',
    status: provider.status,
    ratingAvg: Number(provider.ratingAvg),
    reviewCount: provider.reviewCount,
    profileImageUrl,
    distanceMeters: approximateCustomerHomeDistance(distanceMeters),
  };
}

function approximateCustomerHomeDistance(distanceMeters: number | null) {
  if (!Number.isFinite(distanceMeters)) {
    return null;
  }
  return Math.max(0, Math.round((distanceMeters as number) / 1000) * 1000);
}

function sortCustomerHomePartners<T extends { displayName: string; distanceMeters: number | null }>(
  partners: T[],
) {
  return partners.sort((left, right) => {
    if (left.distanceMeters === null && right.distanceMeters === null) {
      return left.displayName.localeCompare(right.displayName);
    }
    if (left.distanceMeters === null) {
      return 1;
    }
    if (right.distanceMeters === null) {
      return -1;
    }
    return left.distanceMeters - right.distanceMeters;
  });
}
