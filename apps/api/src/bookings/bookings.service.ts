import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  EarningStatus,
  ParticipantStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderTaxProfileStatus,
  ProviderStatus,
} from '@prisma/client';
import { EarningsService } from '../earnings/earnings.service';
import { MatchingGateway } from '../matching/matching.gateway';
import { MatchingService } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { REQUIRED_PAYOUT_AGREEMENTS } from '../provider-onboarding/provider-onboarding.policy';
import { PrismaService } from '../prisma/prisma.service';

const PROVIDER_WALLET_BLOCK_REASON = '수수료에 대한 정산이 되지 않아 예약을 받을 수 없습니다.';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly matchingGateway: MatchingGateway,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly earnings: EarningsService,
  ) {}

  async createOpenMatchingBooking(
    userId: string | undefined,
    input: {
      serviceId: string;
      providerId?: string;
      couponCode?: string;
      scheduledStartAt: string;
      address: Prisma.InputJsonValue;
      lat: number;
      lng: number;
      notes?: string;
      paymentMethod: PaymentMethod;
    },
  ) {
    if (!userId) {
      throw new BadRequestException('Authenticated customer is required');
    }

    const customer = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    const service = await this.prisma.massageService.findUniqueOrThrow({ where: { id: input.serviceId } });
    const preferredProvider = input.providerId
      ? await this.prisma.providerProfile.findUniqueOrThrow({
          where: { id: input.providerId },
          include: { user: true },
        })
      : null;
    const providerService = preferredProvider
      ? await this.prisma.providerService.findUnique({
          where: {
            providerProfileId_serviceId: {
              providerProfileId: preferredProvider.id,
              serviceId: service.id,
            },
          },
        })
      : null;
    if (preferredProvider) {
      await this.ensureProviderWalletCanAccept(preferredProvider.id);
      const configuredServiceCount = await this.prisma.providerService.count({
        where: {
          providerProfileId: preferredProvider.id,
        },
      });
      if (providerService && !providerService.active) {
        throw new BadRequestException('Provider does not offer this service');
      }
      if (!providerService && configuredServiceCount > 0) {
        throw new BadRequestException('Provider does not offer this service');
      }
    }
    const customerPrice = this.resolveCustomerPrice(service, providerService?.price);
    await this.ensureServicePayoutRuleConfigured(service.id, customerPrice);
    const coupon = input.couponCode ? await this.resolveCoupon(input.couponCode) : null;
    const scheduledStartAt = new Date(input.scheduledStartAt);
    const scheduledEndAt = new Date(scheduledStartAt.getTime() + service.durationMin * 60_000);
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const discountAmount = coupon ? this.calculateCouponDiscount(coupon.discount, customerPrice) : 0;
    const finalAmount = Math.max(0, customerPrice - discountAmount);

    let booking = await this.prisma.booking.create({
      data: {
        customerProfileId: customer.id,
        status: BookingStatus.OPEN_MATCHING,
        scheduledStartAt,
        scheduledEndAt,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        notes: input.notes,
        preferredProviderId: preferredProvider?.id,
        openedAt: new Date(),
        expiresAt,
        services: {
          create: {
            serviceId: service.id,
            price: customerPrice,
          },
        },
        payment: {
          create: this.payments.buildAuthorization(input.paymentMethod, finalAmount, 'pending-booking', {
            originalAmount: customerPrice,
            adminMinimumAmount: service.basePrice,
            discountAmount,
            couponCode: coupon?.code,
            couponId: coupon?.id,
          }),
        },
        participants: preferredProvider
          ? {
              create: {
                providerProfileId: preferredProvider.id,
                status: ParticipantStatus.JOINED,
                providerStatusAtJoin: preferredProvider.status,
              },
            }
          : undefined,
      },
      include: {
        services: { include: { service: true } },
        payment: true,
        participants: { include: { providerProfile: true } },
        preferredProvider: true,
        selectedProvider: true,
      },
    });

    if (booking.payment?.id) {
      const payment = await this.payments.refreshAuthorizationForBooking(booking.payment.id, booking.id);
      booking = { ...booking, payment };
    }

    const result = this.matching.openBooking({ booking });
    if (booking.payment?.id) {
      await this.payments.scheduleStatusCheck(booking.payment.id);
    }
    await this.matching.registerActiveBooking(booking.id, result);
    await this.matching.scheduleBookingTimeout(booking.id, booking.expiresAt ?? expiresAt);
    await this.notifications.create({
      userId,
      type: 'booking.opened',
      title: preferredProvider ? 'Booking request sent' : 'Booking opened',
      body: preferredProvider
        ? `${preferredProvider.displayName} received your booking request.`
        : 'We are looking for nearby providers.',
      data: {
        bookingId: booking.id,
        providerProfileId: preferredProvider?.id,
        couponCode: coupon?.code,
        discountAmount,
      },
    });
    if (preferredProvider?.userId) {
      await this.notifications.create({
        userId: preferredProvider.userId,
        type: 'booking.requested',
        title: 'New direct booking request',
        body: 'A customer requested one of your services.',
        data: { bookingId: booking.id, customerProfileId: customer.id },
      });
      this.matchingGateway.emitDirectBookingRequested(preferredProvider.userId, booking.id, result);
    } else {
      this.matchingGateway.emitBookingOpened(booking.id, result);
    }
    return result;
  }

  private async resolveCoupon(code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
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
    return coupon;
  }

  private calculateCouponDiscount(discount: Prisma.JsonValue, subtotal: number) {
    if (!discount || typeof discount !== 'object' || Array.isArray(discount)) {
      return 0;
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
      return 0;
    }

    return Math.min(subtotal, Math.round((subtotal * value) / 100));
  }

  private resolveCustomerPrice(
    service: { basePrice: number; priceStep?: number | null },
    providerPrice?: number | null,
  ) {
    const customerPrice = providerPrice ?? service.basePrice;
    const priceStep = service.priceStep ?? 100000;
    if (!Number.isInteger(customerPrice) || customerPrice <= 0) {
      throw new BadRequestException('Provider service price is invalid');
    }
    if (customerPrice < service.basePrice) {
      throw new BadRequestException('Provider service price cannot be lower than the admin minimum');
    }
    if (customerPrice % priceStep !== 0) {
      throw new BadRequestException(`Provider service price must use ${priceStep} VND increments`);
    }
    return customerPrice;
  }

  private async ensureServicePayoutRuleConfigured(serviceId: string, customerPrice: number) {
    const payoutRule = await this.prisma.servicePayoutRule.findFirst({
      where: {
        serviceId,
        customerPrice,
        active: true,
      },
      select: { id: true },
    });

    if (!payoutRule) {
      throw new BadRequestException('Admin payout rule is required before this service price can be booked');
    }
  }

  getBooking(id: string) {
    return this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: {
        services: { include: { service: true } },
        preferredProvider: true,
        participants: { include: { providerProfile: true } },
        payment: true,
        chatRoom: true,
      },
    });
  }

  async getCustomerBooking(id: string, customerUserId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    return this.prisma.booking.findFirstOrThrow({
      where: { id, customerProfileId: customer.id },
      include: {
        services: { include: { service: true } },
        preferredProvider: true,
        participants: { include: { providerProfile: true } },
        payment: true,
        chatRoom: true,
      },
    });
  }

  async listCustomerBookings(customerUserId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    return this.prisma.booking.findMany({
      where: { customerProfileId: customer.id },
      include: {
        services: { include: { service: true } },
        preferredProvider: true,
        participants: { include: { providerProfile: true } },
        selectedProvider: true,
        payment: true,
        chatRoom: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async cancelCustomerBooking(bookingId: string, customerUserId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    const booking = await this.prisma.booking.findFirstOrThrow({
      where: { id: bookingId, customerProfileId: customer.id },
      include: {
        preferredProvider: true,
        participants: { include: { providerProfile: true } },
        selectedProvider: true,
      },
    });

    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.IN_SERVICE ||
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REFUNDED
    ) {
      throw new BadRequestException('Booking cannot be cancelled in its current state');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        expiresAt: new Date(),
      },
      include: {
        preferredProvider: true,
        participants: { include: { providerProfile: true } },
        selectedProvider: true,
        chatRoom: true,
        services: { include: { service: true } },
        payment: true,
      },
    });
    const releasedPayment = updated.payment ? await this.payments.release(updated.payment.id) : null;
    const result = releasedPayment ? { ...updated, payment: releasedPayment } : updated;

    await this.matching.closeBooking(bookingId);
    const providerUserIds = new Set<string>();
    if (updated.preferredProvider?.userId) {
      providerUserIds.add(updated.preferredProvider.userId);
    }
    if (updated.selectedProvider?.userId) {
      providerUserIds.add(updated.selectedProvider.userId);
    }
    for (const participant of updated.participants) {
      if (participant.providerProfile?.userId) {
        providerUserIds.add(participant.providerProfile.userId);
      }
    }

    for (const providerUserId of providerUserIds) {
      await this.notifications.create({
        userId: providerUserId,
        type: 'booking.cancelled',
        title: 'Booking cancelled',
        body: 'The customer cancelled this booking request.',
        data: { bookingId },
      });
    }

    await this.notifications.create({
      userId: customerUserId,
      type: 'booking.cancelled',
      title: 'Booking cancelled',
      body: releasedPayment
        ? 'Your request has been cancelled and the payment hold was released.'
        : 'Your request has been cancelled.',
      data: { bookingId },
    });
    this.matchingGateway.emitBookingExpired(bookingId, result);
    return result;
  }

  async getOpenBookings(providerUserId?: string) {
    const provider = providerUserId ? await this.requireProvider(providerUserId) : null;
    return this.prisma.booking.findMany({
      where: {
        status: BookingStatus.OPEN_MATCHING,
        expiresAt: { gt: new Date() },
        ...(provider
          ? {
              OR: [
                {
                  preferredProviderId: provider.id,
                  participants: {
                    none: {
                      providerProfileId: provider.id,
                      status: ParticipantStatus.REJECTED,
                    },
                  },
                },
                {
                  participants: {
                    none: {
                      providerProfileId: provider.id,
                      status: ParticipantStatus.REJECTED,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        services: { include: { service: true } },
        preferredProvider: true,
        participants: { include: { providerProfile: true } },
        selectedProvider: true,
        chatRoom: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listProviderBookings(providerUserId: string) {
    const provider = await this.requireProvider(providerUserId);
    return this.prisma.booking.findMany({
      where: {
        OR: [
          { preferredProviderId: provider.id },
          { selectedProviderId: provider.id },
          { participants: { some: { providerProfileId: provider.id } } },
        ],
      },
      include: {
        services: { include: { service: true } },
        participants: true,
        preferredProvider: true,
        selectedProvider: true,
        payment: true,
        chatRoom: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async joinBooking(bookingId: string, providerUserId: string | undefined) {
    const provider = await this.requireProvider(providerUserId);
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.status !== BookingStatus.OPEN_MATCHING) {
      throw new BadRequestException('Booking is not open for matching');
    }
    await this.ensureProviderWalletCanAccept(provider.id);

    const participant = await this.prisma.bookingParticipant.upsert({
      where: { bookingId_providerProfileId: { bookingId, providerProfileId: provider.id } },
      update: { status: ParticipantStatus.JOINED, respondedAt: new Date() },
      create: {
        bookingId,
        providerProfileId: provider.id,
        status: ParticipantStatus.JOINED,
        providerStatusAtJoin: provider.status,
      },
      include: { providerProfile: true },
    });

    await this.matching.registerParticipant(bookingId, provider.id);
    const result = this.matching.joinBooking(bookingId, participant);
    const customerUserId = await this.getCustomerUserIdForBooking(bookingId);
    await this.notifications.create({
      userId: customerUserId,
      type: 'provider.joined',
      title: 'A provider joined',
      body: `${provider.displayName} joined your booking.`,
      data: { bookingId, providerProfileId: provider.id },
    });
    this.matchingGateway.emitProviderJoined(bookingId, result);
    return result;
  }

  async selectProvider(bookingId: string, customerUserId: string, providerId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    const ownedBooking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerProfileId: customer.id, status: BookingStatus.OPEN_MATCHING },
    });
    if (!ownedBooking) {
      throw new BadRequestException('Booking is not open or does not belong to this customer');
    }

    const participant = await this.prisma.bookingParticipant.findUnique({
      where: { bookingId_providerProfileId: { bookingId, providerProfileId: providerId } },
    });
    if (!participant || participant.status === ParticipantStatus.REJECTED) {
      throw new BadRequestException('Provider must join before customer selection');
    }

    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.MATCHED,
        selectedProviderId: providerId,
        participants: {
          update: {
            where: { bookingId_providerProfileId: { bookingId, providerProfileId: providerId } },
            data: { status: ParticipantStatus.SELECTED, respondedAt: new Date() },
          },
        },
        chatRoom: { create: {} },
      },
      include: { chatRoom: true, preferredProvider: true, selectedProvider: true, payment: true },
    });

    await this.matching.closeBooking(bookingId);
    const result = this.matching.selectFinalProvider(bookingId, booking);
    if (booking.selectedProvider?.userId) {
      await this.notifications.create({
        userId: booking.selectedProvider.userId,
        type: 'booking.matched',
        title: 'You were selected',
        body: 'The customer selected you for this booking.',
        data: { bookingId },
      });
    }
    await this.notifications.create({
      userId: customerUserId,
      type: 'booking.matched',
      title: 'Provider selected',
      body: 'Your chat room is ready.',
      data: { bookingId, chatRoomId: booking.chatRoom?.id },
    });
    this.matchingGateway.emitBookingMatched(bookingId, result);
    return result;
  }

  async updateParticipant(bookingId: string, providerUserId: string | undefined, status: ParticipantStatus) {
    const provider = await this.requireProvider(providerUserId);
    if (status === ParticipantStatus.ACCEPTED) {
      await this.ensureProviderWalletCanAccept(provider.id);
    }
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { customerProfile: true, preferredProvider: true, selectedProvider: true, chatRoom: true },
    });

    if (booking.preferredProviderId === provider.id) {
      if (status === ParticipantStatus.ACCEPTED) {
        const updated = await this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.MATCHED,
            selectedProviderId: provider.id,
            participants: {
              update: {
                where: { bookingId_providerProfileId: { bookingId, providerProfileId: provider.id } },
                data: { status, respondedAt: new Date() },
              },
            },
          },
          include: { participants: true, preferredProvider: true, selectedProvider: true, chatRoom: true },
        });
        await this.notifications.create({
          userId: booking.customerProfile.userId,
          type: 'booking.accepted',
          title: 'Provider accepted your booking',
          body: `${provider.displayName} accepted your request.`,
          data: { bookingId },
        });
        this.matchingGateway.emitBookingMatched(bookingId, updated);
        return updated;
      }

      if (status === ParticipantStatus.REJECTED) {
        const updated = await this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.OPEN_MATCHING,
            selectedProviderId: null,
            participants: {
              update: {
                where: { bookingId_providerProfileId: { bookingId, providerProfileId: provider.id } },
                data: { status, respondedAt: new Date() },
              },
            },
          },
          include: { participants: true, preferredProvider: true, selectedProvider: true, chatRoom: true },
        });
        await this.matching.closeBooking(bookingId);
        await this.notifications.create({
          userId: booking.customerProfile.userId,
          type: 'booking.rejected',
          title: 'Provider declined your booking',
          body: 'We are still looking for another available therapist.',
          data: { bookingId, providerProfileId: provider.id },
        });
        const result = this.matching.openBooking({ booking: updated });
        await this.matching.registerActiveBooking(bookingId, result);
        await this.matching.scheduleBookingTimeout(
          bookingId,
          updated.expiresAt ?? new Date(Date.now() + 10 * 60_000),
        );
        this.matchingGateway.emitBookingOpened(bookingId, result);
        return updated;
      }
    }

    return this.prisma.bookingParticipant.update({
      where: { bookingId_providerProfileId: { bookingId, providerProfileId: provider.id } },
      data: { status, respondedAt: new Date() },
    });
  }

  private async ensureProviderWalletCanAccept(providerProfileId: string) {
    const wallet = await this.prisma.providerEarning.aggregate({
      where: {
        providerProfileId,
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        payoutBatchId: null,
      },
      _sum: { netAmount: true },
    });
    if ((wallet._sum.netAmount ?? 0) < 0) {
      throw new BadRequestException(PROVIDER_WALLET_BLOCK_REASON);
    }
  }

  updateStatus(bookingId: string, status: BookingStatus) {
    return this.prisma.booking.update({ where: { id: bookingId }, data: { status } });
  }

  async updateProviderBookingStatus(bookingId: string, providerUserId: string, status: BookingStatus) {
    const provider = await this.requireProvider(providerUserId);
    await this.requireSelectedProvider(bookingId, provider.id);
    if (status === BookingStatus.IN_SERVICE) {
      const updated = await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status,
          chatRoom: { upsert: { create: {}, update: {} } },
        },
        include: { chatRoom: true, preferredProvider: true, selectedProvider: true, customerProfile: true },
      });
      await this.notifications.create({
        userId: updated.customerProfile.userId,
        type: 'service.started',
        title: 'Service started',
        body: 'Your provider started the service. Chat is now available.',
        data: { bookingId, chatRoomId: updated.chatRoom?.id },
      });
      if (updated.selectedProvider?.userId) {
        await this.notifications.create({
          userId: updated.selectedProvider.userId,
          type: 'service.started',
          title: 'Service started',
          body: 'Chat with the customer is now available.',
          data: { bookingId, chatRoomId: updated.chatRoom?.id },
        });
      }
      this.matchingGateway.emitServiceStarted(bookingId, updated);
      return updated;
    }
    return this.updateStatus(bookingId, status);
  }

  async complete(bookingId: string, providerUserId: string) {
    const provider = await this.requireProvider(providerUserId);
    await this.requireSelectedProvider(bookingId, provider.id);

    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.COMPLETED,
        payment: { update: { status: PaymentStatus.CAPTURED } },
      },
      include: { payment: true, selectedProvider: true },
    });
    await this.earnings.createForCompletedBooking(bookingId, provider.id);
    const result = this.matching.completeBooking(bookingId, booking);
    const customerUserId = await this.getCustomerUserIdForBooking(bookingId);
    await this.notifications.create({
      userId: customerUserId,
      type: 'service.completed',
      title: 'Service completed',
      body: 'Please leave a review when you are ready.',
      data: { bookingId },
    });
    if (booking.selectedProvider?.userId) {
      await this.notifications.create({
        userId: booking.selectedProvider.userId,
        type: 'earning.created',
        title: 'Earning created',
        body: 'Your completed service has been added to earnings.',
        data: { bookingId },
      });
      await this.notifyProviderFirstRevenuePayoutSetup(
        provider.id,
        booking.selectedProvider.userId,
        bookingId,
      );
    }
    this.matchingGateway.emitServiceCompleted(bookingId, result);
    return result;
  }

  private async notifyProviderFirstRevenuePayoutSetup(
    providerProfileId: string,
    providerUserId: string,
    bookingId: string,
  ) {
    const [completedBookingCount, provider] = await Promise.all([
      this.prisma.booking.count({
        where: {
          selectedProviderId: providerProfileId,
          status: BookingStatus.COMPLETED,
        },
      }),
      this.prisma.providerProfile.findUnique({
        where: { id: providerProfileId },
        include: {
          taxProfile: true,
          agreements: true,
        },
      }),
    ]);

    if (!provider || completedBookingCount !== 1) {
      return;
    }

    const acceptedAgreementTypes = new Set(provider.agreements.map((agreement) => agreement.type));
    const missingAgreements = REQUIRED_PAYOUT_AGREEMENTS.filter((type) => !acceptedAgreementTypes.has(type));
    const missing = {
      taxProfileApproved: provider.taxProfile?.status !== ProviderTaxProfileStatus.APPROVED,
      residentialAddress: !provider.residentialAddress,
      agreements: missingAgreements,
    };
    if (!missing.taxProfileApproved && !missing.residentialAddress && missing.agreements.length === 0) {
      return;
    }

    await this.notifications.create({
      userId: providerUserId,
      type: 'provider.payout_setup_required',
      title: 'Payout setup required',
      body: 'Your first HANDS earning is recorded. Add tax, address, and payout agreements before requesting payout.',
      data: {
        bookingId,
        providerProfileId,
        missing,
      },
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
    if (provider.status === ProviderStatus.OFFLINE) {
      throw new BadRequestException('Provider must be online before joining bookings');
    }
    return provider;
  }

  private async requireSelectedProvider(bookingId: string, providerId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.selectedProviderId !== providerId) {
      throw new BadRequestException('Provider is not selected for this booking');
    }
    return booking;
  }

  private async getCustomerUserIdForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { customerProfile: true },
    });
    return booking.customerProfile.userId;
  }
}
