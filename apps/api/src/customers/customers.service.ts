import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    userId: string | undefined,
    input: { bookingId: string; rating: number; comment?: string },
  ) {
    if (!userId) {
      throw new BadRequestException('Authenticated customer is required');
    }

    const customer = await this.prisma.customerProfile.findUniqueOrThrow({ where: { userId } });
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
      const review = await tx.review.create({
        data: {
          bookingId: booking.id,
          customerProfileId: customer.id,
          providerProfileId: booking.selectedProviderId!,
          rating: input.rating,
          comment: input.comment,
          tipAmount: 0,
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
