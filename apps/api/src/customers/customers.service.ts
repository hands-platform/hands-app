import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
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

  async listViewedProviders(userId: string | undefined) {
    const customer = await this.requireCustomer(userId);
    return this.prisma.customerProviderProfileView.findMany({
      where: { customerProfileId: customer.id },
      orderBy: { lastViewedAt: 'desc' },
      take: 100,
      select: customerViewedProviderSelect,
    });
  }

  async recordProviderProfileView(userId: string | undefined, providerProfileId: string) {
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
    return this.prisma.customerProviderProfileView.upsert({
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
