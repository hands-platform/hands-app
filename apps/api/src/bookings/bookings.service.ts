import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  EarningStatus,
  ParticipantStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderBankAccountStatus,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderTaxProfileStatus,
  ProviderStatus,
  Role,
  VerificationStatus,
} from '@prisma/client';
import { EarningsService } from '../earnings/earnings.service';
import { MatchingGateway } from '../matching/matching.gateway';
import { MatchingService } from '../matching/matching.service';
import {
  BACKUP_OPEN_IMMEDIATE,
  BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
  MatchingPolicy,
  PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
} from '../matching/matching.policy';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { REQUIRED_PAYOUT_AGREEMENTS } from '../provider-onboarding/provider-onboarding.policy';
import { throwProviderWalletBlocked } from '../provider-wallet/provider-wallet.policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  addProviderMatchingDistance,
  assertBookingPaymentMethod,
  assertBookingServiceId,
  assertCustomerDirectCancellationAllowed,
  assertPartnerResponseWindowOpen,
  assertProviderLifecycleTransitionAllowed,
  bookingAddressText,
  bookingDispatchCoordinates,
  calculateDistanceMeters,
  formatMatchingRadius,
  isCustomerSelectableParticipantForFinalChoice,
  isMarketplaceParticipationWindowOpen,
  isMarketplacePartnerAction,
  isVietnamBookingCoordinate,
  normalizeBookingCoordinate,
  providerLocationFreshEnough,
  vietnamBookingCoordinateGateError,
} from './bookings.policy';
import {
  clientBookingResponse,
  clientBookingResponses,
  partnerBookingResponses,
  partnerOpenBookingResponses,
} from './bookings.response';

const REQUIRED_BOOKING_DOCUMENT_TYPES = [
  ProviderDocumentType.CCCD_FRONT,
  ProviderDocumentType.CCCD_BACK,
  ProviderDocumentType.SELFIE,
];

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

  private async recordBookingGateRejection(input: {
    actorId: string;
    customerProfileId: string;
    serviceId: string;
    preferredProviderId?: string | null;
    reasonCode: string;
    reason: string;
    bookingLat: number;
    bookingLng: number;
    addressText: string;
    customerDistanceMeters?: number | null;
    preferredProviderDistanceMeters?: number | null;
    customerDistanceLimitMeters: number;
    preferredProviderDistanceLimitMeters: number;
    currentLocationRecordedAt?: Date | null;
  }) {
    await this.prisma.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: 'booking.create.rejected',
        target: `customer:${input.customerProfileId}`,
        metadata: {
          reasonCode: input.reasonCode,
          reason: input.reason,
          customerProfileId: input.customerProfileId,
          serviceId: input.serviceId,
          preferredProviderId: input.preferredProviderId ?? null,
          bookingAddress: {
            lat: input.bookingLat,
            lng: input.bookingLng,
            addressText: input.addressText,
          },
          customerDistanceMeters: input.customerDistanceMeters ?? null,
          preferredProviderDistanceMeters: input.preferredProviderDistanceMeters ?? null,
          customerDistanceLimitMeters: input.customerDistanceLimitMeters,
          preferredProviderDistanceLimitMeters: input.preferredProviderDistanceLimitMeters,
          currentLocationRecordedAt: input.currentLocationRecordedAt?.toISOString() ?? null,
        },
      },
    });
  }

  async createOpenMatchingBooking(
    userId: string | undefined,
    input: {
      serviceId: string;
      providerId?: string;
      couponCode?: string;
      address?: Prisma.InputJsonValue;
      lat?: number;
      lng?: number;
      selectedLocationId?: string;
      notes?: string;
      paymentMethod: PaymentMethod;
      currentLat?: number;
      currentLng?: number;
      currentLocationUpdatedAt?: string;
    },
  ) {
    if (!userId) {
      throw new BadRequestException('Authenticated customer is required');
    }

    const customer = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }
    assertBookingServiceId(input.serviceId);
    assertBookingPaymentMethod(input.paymentMethod);

    const service = await this.prisma.massageService.findUniqueOrThrow({ where: { id: input.serviceId } });
    const preferredProvider = input.providerId
      ? await this.prisma.providerProfile.findUniqueOrThrow({
          where: { id: input.providerId },
          include: {
            user: true,
            verification: true,
            kyc: true,
            documents: { where: { deletedAt: null } },
            bankAccounts: { where: { deletedAt: null } },
          },
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
      assertProviderCanReceiveBooking(preferredProvider);
      const configuredServiceCount = await this.prisma.providerService.count({
        where: {
          providerProfileId: preferredProvider.id,
        },
      });
      if (providerService && !providerService.active) {
        throw new BadRequestException('Partner does not offer this service');
      }
      if (!providerService && configuredServiceCount > 0) {
        throw new BadRequestException('Partner does not offer this service');
      }
    }
    const customerPrice = this.resolveCustomerPrice(service, providerService?.price);
    await this.ensureServicePayoutRuleConfigured(service.id, customerPrice);
    const coupon = input.couponCode ? await this.resolveCoupon(input.couponCode) : null;
    // HANDS MVP is on-demand only. Keep the existing DB field as the immutable request timestamp.
    const scheduledStartAt = new Date();
    const scheduledEndAt = new Date(scheduledStartAt.getTime() + service.durationMin * 60_000);
    const selectedLocation = input.selectedLocationId
      ? await this.prisma.customerSelectedLocation.findFirst({
          where: { id: input.selectedLocationId, customerProfileId: customer.id },
        })
      : null;
    if (input.selectedLocationId && !selectedLocation) {
      throw new BadRequestException('Selected customer location was not found');
    }
    const matchingPolicy = await this.matching.getPolicy();
    const bookingLat = normalizeBookingCoordinate(input.lat ?? selectedLocation?.latitude, 'lat');
    const bookingLng = normalizeBookingCoordinate(input.lng ?? selectedLocation?.longitude, 'lng');
    const addressTextForAudit =
      bookingAddressText(input.address) ?? selectedLocation?.addressText?.trim() ?? 'Unknown booking address';
    if (matchingPolicy.bookingServiceAreaRequired) {
      const serviceAreaError = vietnamBookingCoordinateGateError(bookingLat, bookingLng);
      if (serviceAreaError) {
        await this.recordBookingGateRejection({
          actorId: userId,
          customerProfileId: customer.id,
          serviceId: service.id,
          preferredProviderId: preferredProvider?.id,
          reasonCode: 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
          reason: serviceAreaError.message,
          bookingLat,
          bookingLng,
          addressText: addressTextForAudit,
          customerDistanceMeters: null,
          preferredProviderDistanceMeters: null,
          customerDistanceLimitMeters: matchingPolicy.bookingMaxCustomerCurrentToAddressKm * 1000,
          preferredProviderDistanceLimitMeters: matchingPolicy.bookingMaxPreferredProviderDistanceKm * 1000,
          currentLocationRecordedAt: null,
        });
        throw new BadRequestException(serviceAreaError.message);
      }
    } else {
      assertWorldBookingCoordinate(bookingLat, bookingLng);
    }
    const addressText = bookingAddressText(input.address) ?? selectedLocation?.addressText?.trim();
    if (!addressText) {
      throw new BadRequestException('Booking address text is required');
    }
    const addressPayload = normalizeBookingAddress(input.address, addressText);
    const expiresAt = new Date(Date.now() + matchingPolicy.providerResponseWindowMinutes * 60_000);
    const discountAmount = coupon ? this.calculateCouponDiscount(coupon.discount, customerPrice) : 0;
    const finalAmount = Math.max(0, customerPrice - discountAmount);
    const customerCurrentLocation = normalizeBookingAttemptCurrentLocation(input, matchingPolicy);
    const customerToBookingDistanceMeters = customerCurrentLocation
      ? calculateDistanceMeters(
          customerCurrentLocation.lat,
          customerCurrentLocation.lng,
          bookingLat,
          bookingLng,
        )
      : null;
    const preferredProviderDistanceMeters = preferredProvider
      ? calculateDistanceMeters(
          bookingLat,
          bookingLng,
          preferredProvider.currentLat,
          preferredProvider.currentLng,
        )
      : null;
    const preferredProviderDistanceGateError = preferredProviderBookingDistanceGateError(
      preferredProvider,
      preferredProviderDistanceMeters,
      matchingPolicy,
    );
    if (preferredProviderDistanceGateError) {
      await this.recordBookingGateRejection({
        actorId: userId,
        customerProfileId: customer.id,
        serviceId: service.id,
        preferredProviderId: preferredProvider?.id,
        reasonCode: 'PREFERRED_PARTNER_TOO_FAR',
        reason: preferredProviderDistanceGateError.message,
        bookingLat,
        bookingLng,
        addressText,
        customerDistanceMeters: customerToBookingDistanceMeters,
        preferredProviderDistanceMeters,
        customerDistanceLimitMeters: matchingPolicy.bookingMaxCustomerCurrentToAddressKm * 1000,
        preferredProviderDistanceLimitMeters: preferredProviderDistanceGateError.limitMeters,
        currentLocationRecordedAt: customerCurrentLocation?.recordedAt,
      });
      throw new BadRequestException(preferredProviderDistanceGateError.message);
    }
    const bookingGateSnapshot = bookingDistanceGateSnapshot({
      matchingPolicy,
      bookingLat,
      bookingLng,
      addressText,
      customerCurrentLocation,
      customerToBookingDistanceMeters,
      preferredProvider,
      preferredProviderDistanceMeters,
    });

    let booking = await this.prisma.booking.create({
      data: {
        customerProfileId: customer.id,
        status: BookingStatus.OPEN_MATCHING,
        scheduledStartAt,
        scheduledEndAt,
        address: addressPayload,
        lat: bookingLat,
        lng: bookingLng,
        addressSnapshot: {
          create: {
            customerProfileId: customer.id,
            selectedLocationId: selectedLocation?.id,
            address: addressPayload,
            addressText,
            latitude: bookingLat,
            longitude: bookingLng,
          },
        },
        notes: input.notes,
        travelBufferMin: matchingPolicy.travelBufferMinutes,
        earlyAcceptMin: matchingPolicy.providerResponseWindowMinutes,
        preferredProviderId: preferredProvider?.id,
        openedAt: new Date(),
        expiresAt,
        metadata: {
          matchingPolicy: bookingMatchingPolicySnapshot(matchingPolicy),
          bookingGate: bookingGateSnapshot,
        },
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
                distanceMeters: preferredProviderDistanceMeters,
                providerStatusAtJoin: preferredProvider.status,
              },
            }
          : undefined,
      },
      include: {
        services: { include: { service: true } },
        addressSnapshot: true,
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

    const dispatchPin = bookingDispatchCoordinates(booking);
    const eligibleBackupProviders = await this.findEligibleBackupProviders({
      bookingId: booking.id,
      serviceId: service.id,
      lat: dispatchPin.lat,
      lng: dispatchPin.lng,
      preferredProviderId: preferredProvider?.id,
      backupOpenMode: matchingPolicy.backupOpenMode,
      policy: matchingPolicy,
    });
    const result = this.matching.openBooking({
      booking: clientBookingResponse(booking),
      policy: matchingPolicy,
      payload: {
        eligibleBackupProviderCount: eligibleBackupProviders.length,
        marketplaceRadiusMeters: matchingPolicy.backupProviderRadiusMeters,
        marketplaceInvitationLimit: matchingPolicy.backupProviderInvitationLimit,
        backupProviderRadiusMeters: matchingPolicy.backupProviderRadiusMeters,
        backupProviderInvitationLimit: matchingPolicy.backupProviderInvitationLimit,
      },
    });
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
        : 'We are looking for nearby partners.',
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
    const backupNotificationTrace = await this.notifyBackupProviders({
      stage: 'initial_open',
      bookingId: booking.id,
      providers: eligibleBackupProviders,
      backupProviderRadiusMeters: matchingPolicy.backupProviderRadiusMeters,
      backupOpenMode: matchingPolicy.backupOpenMode,
      backupProviderInvitationLimit: matchingPolicy.backupProviderInvitationLimit,
      matchingPayload: result,
    });
    await this.recordBackupNotificationTrace(booking.id, backupNotificationTrace);
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
      throw new BadRequestException('Partner service price is invalid');
    }
    if (customerPrice < service.basePrice) {
      throw new BadRequestException('Partner service price cannot be lower than the admin minimum');
    }
    if (customerPrice % priceStep !== 0) {
      throw new BadRequestException(`Partner service price must use ${priceStep} VND increments`);
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

  async getBooking(id: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: {
        services: { include: { service: true } },
        addressSnapshot: true,
        preferredProvider: true,
        participants: { include: { providerProfile: true } },
        payment: true,
        chatRoom: true,
      },
    });
    return clientBookingResponse(booking);
  }

  async getCustomerBooking(id: string, customerUserId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    const booking = await this.prisma.booking.findFirstOrThrow({
      where: { id, customerProfileId: customer.id },
      include: {
        services: { include: { service: true } },
        addressSnapshot: true,
        preferredProvider: true,
        participants: { include: { providerProfile: true } },
        payment: true,
        chatRoom: true,
      },
    });
    return clientBookingResponse(booking);
  }

  async listCustomerBookings(customerUserId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    const bookings = await this.prisma.booking.findMany({
      where: { customerProfileId: customer.id },
      include: {
        services: { include: { service: true } },
        addressSnapshot: true,
        preferredProvider: true,
        participants: { include: { providerProfile: true } },
        selectedProvider: true,
        payment: true,
        chatRoom: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return clientBookingResponses(bookings);
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
        payment: true,
      },
    });

    assertCustomerDirectCancellationAllowed(booking);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        expiresAt: new Date(),
        closedAt: new Date(),
        closedByRole: Role.CUSTOMER,
        closedReason: 'customer_cancelled',
        closedNote: 'Customer cancelled before partner commitment.',
      },
      include: {
        addressSnapshot: true,
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
        body: 'The customer cancelled this booking request before partner commitment.',
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
    const clientResult = clientBookingResponse(result);
    this.matchingGateway.emitBookingExpired(bookingId, clientResult);
    return clientResult;
  }

  private async readOperationalPolicyValue(key: string, fallback: string) {
    const setting = await this.prisma.operationalPolicySetting.findUnique({
      where: { key },
      select: { value: true },
    });
    return typeof setting?.value === 'string' ? setting.value : fallback;
  }

  async getOpenBookings(providerUserId?: string) {
    const provider = providerUserId ? await this.requireProvider(providerUserId) : null;
    const bookings = await this.prisma.booking.findMany({
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
        addressSnapshot: true,
        preferredProvider: true,
        participants: { include: { providerProfile: true } },
        selectedProvider: true,
        chatRoom: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!provider) {
      return clientBookingResponses(bookings);
    }

    const fallbackPolicy = await this.matching.getPolicy();
    return partnerOpenBookingResponses(
      bookings
        .map((booking) => addProviderMatchingDistance(booking, provider))
        .filter((booking) =>
          this.canProviderSeeOpenBooking(booking, provider, this.bookingPolicy(booking, fallbackPolicy)),
        ),
    );
  }

  async listProviderBookings(providerUserId: string) {
    const provider = await this.requireProvider(providerUserId);
    const bookings = await this.prisma.booking.findMany({
      where: {
        OR: [
          { preferredProviderId: provider.id },
          { selectedProviderId: provider.id },
          { participants: { some: { providerProfileId: provider.id } } },
        ],
      },
      include: {
        services: { include: { service: true } },
        addressSnapshot: true,
        participants: true,
        preferredProvider: true,
        selectedProvider: true,
        payment: true,
        chatRoom: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return partnerBookingResponses(bookings, provider.id);
  }

  async joinBooking(bookingId: string, providerUserId: string | undefined) {
    const provider = await this.requireProvider(providerUserId);
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        addressSnapshot: true,
        participants: { select: { providerProfileId: true, status: true } },
      },
    });
    if (booking.status !== BookingStatus.OPEN_MATCHING) {
      throw new BadRequestException('Booking is not open for matching');
    }
    if (booking.expiresAt && booking.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Booking request is expired');
    }
    assertProviderCanReceiveBooking(provider);
    if (isMarketplacePartnerAction(provider.id, booking.preferredProviderId)) {
      await this.ensureProviderWalletCanJoinMarketplace(provider.id);
    }
    const matchingPolicy = this.bookingPolicy(booking, await this.matching.getPolicy());
    const distanceMeters = this.requireProviderWithinMatchingRadius(booking, provider, matchingPolicy);

    const participant = await this.prisma.bookingParticipant.upsert({
      where: { bookingId_providerProfileId: { bookingId, providerProfileId: provider.id } },
      update: { status: ParticipantStatus.JOINED, respondedAt: new Date(), distanceMeters },
      create: {
        bookingId,
        providerProfileId: provider.id,
        status: ParticipantStatus.JOINED,
        distanceMeters,
        providerStatusAtJoin: provider.status,
      },
      include: { providerProfile: true },
    });

    await this.matching.registerParticipant(bookingId, provider.id, matchingPolicy);
    const result = this.matching.joinBooking(bookingId, participant);
    const customerUserId = await this.getCustomerUserIdForBooking(bookingId);
    await this.notifications.create({
      userId: customerUserId,
      type: 'provider.joined',
      title: 'A partner joined',
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
    if (!participant || !isCustomerSelectableParticipantForFinalChoice(participant, ownedBooking.preferredProviderId)) {
      throw new BadRequestException('Partner must participate or accept before customer selection');
    }
    if (isMarketplacePartnerAction(providerId, ownedBooking.preferredProviderId)) {
      await this.ensureProviderWalletCanJoinMarketplace(providerId);
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
        chatRoom: { upsert: { create: {}, update: {} } },
      },
      include: {
        addressSnapshot: true,
        chatRoom: true,
        preferredProvider: true,
        selectedProvider: true,
        payment: true,
      },
    });

    await this.matching.closeBooking(bookingId);
    const result = this.matching.selectFinalProvider(bookingId, clientBookingResponse(booking));
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
      title: 'Partner selected',
      body: 'Your chat room is ready.',
      data: { bookingId, chatRoomId: booking.chatRoom?.id },
    });
    this.matchingGateway.emitBookingMatched(bookingId, result);
    return result;
  }

  async updateParticipant(bookingId: string, providerUserId: string | undefined, status: ParticipantStatus) {
    const provider = await this.requireProvider(providerUserId);
    if (status === ParticipantStatus.ACCEPTED) {
      assertProviderCanReceiveBooking(provider);
    }
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        customerProfile: true,
        preferredProvider: true,
        selectedProvider: true,
        chatRoom: true,
        services: { select: { serviceId: true } },
      },
    });
    this.assertBookingOpenForPartnerResponse(booking);

    const participantKey = { bookingId_providerProfileId: { bookingId, providerProfileId: provider.id } };
    const existingParticipant = await this.prisma.bookingParticipant.findUnique({
      where: participantKey,
      select: { id: true },
    });
    if (!existingParticipant) {
      throw new BadRequestException(
        booking.preferredProviderId === provider.id
          ? 'Preferred partner invitation is not available for this booking'
          : 'Partner must participate in this marketplace booking before responding',
      );
    }

    if (booking.preferredProviderId === provider.id) {
      if (status === ParticipantStatus.ACCEPTED) {
        const updated = await this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.OPEN_MATCHING,
            selectedProviderId: null,
            participants: {
              update: {
                where: participantKey,
                data: { status, respondedAt: new Date() },
              },
            },
          },
          include: {
            participants: true,
            preferredProvider: true,
            selectedProvider: true,
            chatRoom: true,
            addressSnapshot: true,
          },
        });
        await this.notifications.create({
          userId: booking.customerProfile.userId,
          type: 'provider.accepted',
          title: 'Partner is ready',
          body: `${provider.displayName} accepted your request. Confirm this partner or choose another available partner.`,
          data: { bookingId, providerProfileId: provider.id },
        });
        this.matchingGateway.emitProviderAccepted(bookingId, updated);
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
                where: participantKey,
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
          title: 'Partner declined your booking',
          body: 'We are still looking for another available partner.',
          data: { bookingId, providerProfileId: provider.id },
        });
        const matchingPolicy = this.bookingPolicy(booking, await this.matching.getPolicy());
        const serviceId = booking.services[0]?.serviceId;
        const dispatchPin = bookingDispatchCoordinates(updated);
        const eligibleBackupProviders = serviceId
          ? await this.findEligibleBackupProviders({
              bookingId,
              serviceId,
              lat: dispatchPin.lat,
              lng: dispatchPin.lng,
              preferredProviderId: provider.id,
              backupOpenMode: matchingPolicy.backupOpenMode,
              forceOpen: true,
              policy: matchingPolicy,
            })
          : [];
        const result = this.matching.openBooking({
          booking: updated,
          policy: matchingPolicy,
          payload: {
            eligibleBackupProviderCount: eligibleBackupProviders.length,
            marketplaceRadiusMeters: matchingPolicy.backupProviderRadiusMeters,
            marketplaceInvitationLimit: matchingPolicy.backupProviderInvitationLimit,
            backupProviderRadiusMeters: matchingPolicy.backupProviderRadiusMeters,
            backupProviderInvitationLimit: matchingPolicy.backupProviderInvitationLimit,
            firstPickDeclined: true,
          },
        });
        await this.matching.registerActiveBooking(bookingId, result);
        await this.matching.scheduleBookingTimeout(
          bookingId,
          updated.expiresAt ?? new Date(Date.now() + matchingPolicy.providerResponseWindowMinutes * 60_000),
        );
        const backupNotificationTrace = await this.notifyBackupProviders({
          stage: 'first_pick_declined',
          bookingId,
          providers: eligibleBackupProviders,
          backupProviderRadiusMeters: matchingPolicy.backupProviderRadiusMeters,
          backupOpenMode: matchingPolicy.backupOpenMode,
          backupProviderInvitationLimit: matchingPolicy.backupProviderInvitationLimit,
          matchingPayload: result,
        });
        await this.recordBackupNotificationTrace(bookingId, backupNotificationTrace);
        return updated;
      }
    }

    if (status === ParticipantStatus.ACCEPTED && isMarketplacePartnerAction(provider.id, booking.preferredProviderId)) {
      await this.ensureProviderWalletCanJoinMarketplace(provider.id);
    }

    const updatedParticipant = await this.prisma.bookingParticipant.update({
      where: participantKey,
      data: { status, respondedAt: new Date() },
      include: { providerProfile: true },
    });

    if (status === ParticipantStatus.ACCEPTED) {
      await this.notifications.create({
        userId: booking.customerProfile.userId,
        type: 'provider.accepted',
        title: 'Marketplace partner is ready',
        body: `${provider.displayName} can take this booking. Select this partner if you want to switch.`,
        data: { bookingId, providerProfileId: provider.id },
      });
      this.matchingGateway.emitProviderAccepted(bookingId, updatedParticipant);
    }

    if (status === ParticipantStatus.REJECTED) {
      await this.notifications.create({
        userId: booking.customerProfile.userId,
        type: 'provider.rejected',
        title: 'Partner declined',
        body: `${provider.displayName} cannot take this booking.`,
        data: { bookingId, providerProfileId: provider.id },
      });
      this.matchingGateway.emitProviderRejected(bookingId, updatedParticipant);
    }

    return updatedParticipant;
  }

  private async notifyBackupProviders(input: {
    stage: 'initial_open' | 'first_pick_declined';
    bookingId: string;
    providers: Array<{ id: string; userId: string; distanceMeters: number }>;
    backupProviderRadiusMeters: number;
    backupOpenMode: string;
    backupProviderInvitationLimit: number;
    matchingPayload: unknown;
  }) {
    const notifiedProviders: Array<{
      providerProfileId: string;
      userId: string;
      distanceMeters: number;
      notificationId: string;
    }> = [];

    for (const backupProvider of input.providers) {
      const notification = await this.notifications.create({
        userId: backupProvider.userId,
        type: 'booking.backup_available',
        title: 'Nearby booking available',
        body: `A customer request within ${Math.round(
          input.backupProviderRadiusMeters / 1000,
        )}km is open for marketplace participation.`,
        data: {
          bookingId: input.bookingId,
          providerProfileId: backupProvider.id,
          distanceMeters: backupProvider.distanceMeters,
          marketplaceRadiusMeters: input.backupProviderRadiusMeters,
          marketplaceOpenMode: input.backupOpenMode,
          marketplaceInvitationLimit: input.backupProviderInvitationLimit,
          backupProviderRadiusMeters: input.backupProviderRadiusMeters,
          backupOpenMode: input.backupOpenMode,
          backupProviderInvitationLimit: input.backupProviderInvitationLimit,
        },
      });
      notifiedProviders.push({
        providerProfileId: backupProvider.id,
        userId: backupProvider.userId,
        distanceMeters: backupProvider.distanceMeters,
        notificationId: notification.id,
      });
    }
    this.matchingGateway.emitBackupBookingAvailable(
      input.providers.map((provider) => provider.userId),
      input.bookingId,
      input.matchingPayload,
    );
    return {
      stage: input.stage,
      createdAt: new Date().toISOString(),
      notifiedCount: notifiedProviders.length,
      marketplaceRadiusMeters: input.backupProviderRadiusMeters,
      marketplaceOpenMode: input.backupOpenMode,
      marketplaceInvitationLimit: input.backupProviderInvitationLimit,
      backupProviderRadiusMeters: input.backupProviderRadiusMeters,
      backupOpenMode: input.backupOpenMode,
      backupProviderInvitationLimit: input.backupProviderInvitationLimit,
      websocketTargetCount: input.providers.length,
      providers: notifiedProviders,
    };
  }

  private async recordBackupNotificationTrace(
    bookingId: string,
    trace: {
      stage: string;
      createdAt: string;
      notifiedCount: number;
      marketplaceRadiusMeters?: number;
      marketplaceOpenMode?: string;
      marketplaceInvitationLimit?: number;
      backupProviderRadiusMeters: number;
      backupOpenMode: string;
      backupProviderInvitationLimit: number;
      websocketTargetCount: number;
      providers: Array<{
        providerProfileId: string;
        userId: string;
        distanceMeters: number;
        notificationId: string;
      }>;
    },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { metadata: true },
    });
    const metadata = readPlainRecord(booking?.metadata) ?? {};
    const existingTraces = Array.isArray(metadata.backupNotificationTraces)
      ? metadata.backupNotificationTraces
      : [];
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        metadata: toJson({
          ...metadata,
          backupNotificationTraces: [...existingTraces, trace].slice(-12),
        }),
      },
    });
  }

  private bookingPolicy(
    booking: { metadata?: Prisma.JsonValue | null },
    fallback: Awaited<ReturnType<MatchingService['getPolicy']>>,
  ): Awaited<ReturnType<MatchingService['getPolicy']>> {
    const metadata = readPlainRecord(booking.metadata);
    const snapshot = readPlainRecord(metadata?.matchingPolicy);
    if (!snapshot) {
      return fallback;
    }

    return {
      providerResponseWindowMinutes: readSnapshotInteger(
        snapshot.providerResponseWindowMinutes,
        fallback.providerResponseWindowMinutes,
      ),
      backupProviderRadiusMeters: readSnapshotInteger(
        snapshot.marketplaceRadiusMeters ?? snapshot.backupProviderRadiusMeters,
        fallback.backupProviderRadiusMeters,
      ),
      travelBufferMinutes: readSnapshotInteger(snapshot.travelBufferMinutes, fallback.travelBufferMinutes),
      backupProviderLocationMaxAgeMinutes: readSnapshotInteger(
        snapshot.marketplaceLocationMaxAgeMinutes ?? snapshot.backupProviderLocationMaxAgeMinutes,
        fallback.backupProviderLocationMaxAgeMinutes,
      ),
      backupProviderInvitationLimit: readSnapshotInteger(
        snapshot.marketplaceInvitationLimit ?? snapshot.backupProviderInvitationLimit,
        fallback.backupProviderInvitationLimit,
      ),
      bookingMaxCustomerCurrentToAddressKm: readSnapshotInteger(
        snapshot.bookingMaxCustomerCurrentToAddressKm,
        fallback.bookingMaxCustomerCurrentToAddressKm,
      ),
      bookingMaxPreferredProviderDistanceKm: readSnapshotInteger(
        snapshot.bookingMaxPreferredProviderDistanceKm,
        fallback.bookingMaxPreferredProviderDistanceKm,
      ),
      bookingCurrentLocationFreshnessMinutes: readSnapshotInteger(
        snapshot.bookingCurrentLocationFreshnessMinutes,
        fallback.bookingCurrentLocationFreshnessMinutes,
      ),
      bookingDistanceGateEnabled: readSnapshotBoolean(
        snapshot.bookingDistanceGateEnabled,
        fallback.bookingDistanceGateEnabled,
      ),
      bookingServiceAreaRequired: readSnapshotBoolean(
        snapshot.bookingServiceAreaRequired,
        fallback.bookingServiceAreaRequired,
      ),
      preferredAcceptMode:
        snapshot.preferredAcceptMode === PREFERRED_ACCEPT_CUSTOMER_CONFIRM
          ? snapshot.preferredAcceptMode
          : PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
      backupOpenMode:
        snapshot.marketplaceOpenMode === BACKUP_OPEN_AFTER_FIRST_PICK_DELAY ||
        snapshot.marketplaceOpenMode === BACKUP_OPEN_IMMEDIATE
          ? snapshot.marketplaceOpenMode
          : snapshot.backupOpenMode === BACKUP_OPEN_AFTER_FIRST_PICK_DELAY ||
              snapshot.backupOpenMode === BACKUP_OPEN_IMMEDIATE
            ? snapshot.backupOpenMode
          : fallback.backupOpenMode,
    };
  }

  private async findEligibleBackupProviders(input: {
    bookingId: string;
    serviceId: string;
    lat: number;
    lng: number;
    preferredProviderId?: string;
    backupOpenMode?: Awaited<ReturnType<MatchingService['getPolicy']>>['backupOpenMode'];
    forceOpen?: boolean;
    policy?: MatchingPolicy;
  }) {
    if (!input.forceOpen && input.backupOpenMode === BACKUP_OPEN_AFTER_FIRST_PICK_DELAY) {
      return [];
    }

    const policy = input.policy ?? (await this.matching.getPolicy());
    const freshLocationAfter = new Date(Date.now() - policy.backupProviderLocationMaxAgeMinutes * 60_000);
    const providers = await this.prisma.providerProfile.findMany({
      where: {
        id: input.preferredProviderId ? { not: input.preferredProviderId } : undefined,
        status: { in: [ProviderStatus.ONLINE_AVAILABLE, ProviderStatus.ONLINE_AVAILABLE_SOON] },
        blockedAt: null,
        currentLat: { not: null },
        currentLng: { not: null },
        currentLocationUpdatedAt: { gte: freshLocationAfter },
        verification: { status: VerificationStatus.APPROVED },
        kyc: { status: ProviderKycStatus.APPROVED },
        bankAccounts: {
          some: {
            status: ProviderBankAccountStatus.APPROVED,
            deletedAt: null,
          },
        },
        AND: REQUIRED_BOOKING_DOCUMENT_TYPES.map((type) => ({
          documents: {
            some: {
              type,
              status: ProviderDocumentStatus.APPROVED,
              deletedAt: null,
            },
          },
        })),
        participants: {
          none: {
            bookingId: input.bookingId,
            status: ParticipantStatus.REJECTED,
          },
        },
        OR: [
          { services: { none: {} } },
          {
            services: {
              some: {
                serviceId: input.serviceId,
                active: true,
                service: { active: true },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        userId: true,
        currentLat: true,
        currentLng: true,
      },
    });

    return providers
      .map((provider) => ({
        ...provider,
        distanceMeters: calculateDistanceMeters(
          input.lat,
          input.lng,
          provider.currentLat,
          provider.currentLng,
        ),
      }))
      .filter(
        (provider) =>
          provider.distanceMeters !== null && provider.distanceMeters <= policy.backupProviderRadiusMeters,
      )
      .map((provider) => ({ ...provider, distanceMeters: provider.distanceMeters as number }))
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, policy.backupProviderInvitationLimit);
  }

  private canProviderSeeOpenBooking(
    booking: {
      preferredProviderId: string | null;
      openedAt?: Date | string | null;
      distanceMeters?: number | null;
      participants?: Array<{ providerProfileId: string; status: ParticipantStatus | string }>;
    },
    provider: { id: string; currentLocationUpdatedAt?: Date | string | null },
    policy: Awaited<ReturnType<MatchingService['getPolicy']>>,
  ) {
    if (booking.preferredProviderId === provider.id) {
      return true;
    }
    if (!this.isBackupWindowOpen(booking, policy)) {
      return false;
    }
    return (
      providerLocationFreshEnough(
        provider.currentLocationUpdatedAt,
        policy.backupProviderLocationMaxAgeMinutes,
      ) &&
      typeof booking.distanceMeters === 'number' &&
      booking.distanceMeters <= policy.backupProviderRadiusMeters
    );
  }

  private requireProviderWithinMatchingRadius(
    booking: {
      lat: unknown;
      lng: unknown;
      addressSnapshot?: { latitude: unknown; longitude: unknown } | null;
      openedAt?: Date | string | null;
      preferredProviderId: string | null;
      participants?: Array<{ providerProfileId: string; status: ParticipantStatus | string }>;
    },
    provider: {
      id: string;
      currentLat: unknown;
      currentLng: unknown;
      currentLocationUpdatedAt?: Date | string | null;
    },
    policy: Awaited<ReturnType<MatchingService['getPolicy']>>,
  ) {
    const dispatchPin = bookingDispatchCoordinates(booking);
    const distanceMeters = calculateDistanceMeters(
      dispatchPin.lat,
      dispatchPin.lng,
      provider.currentLat,
      provider.currentLng,
    );
    if (booking.preferredProviderId === provider.id) {
      return distanceMeters;
    }
    if (!this.isBackupWindowOpen(booking, policy)) {
      throw new BadRequestException(
        'Marketplace partners can participate after the first-pick response window opens',
      );
    }
    if (distanceMeters === null) {
      throw new BadRequestException('Partner location is required before marketplace participation');
    }
    if (
      !providerLocationFreshEnough(
        provider.currentLocationUpdatedAt,
        policy.backupProviderLocationMaxAgeMinutes,
      )
    ) {
      throw new BadRequestException(
        `Partner location must be refreshed within ${policy.backupProviderLocationMaxAgeMinutes} minutes before marketplace participation`,
      );
    }
    if (distanceMeters > policy.backupProviderRadiusMeters) {
      throw new BadRequestException(
        `Only partners within ${formatMatchingRadius(policy.backupProviderRadiusMeters)} can participate in this booking`,
      );
    }
    return distanceMeters;
  }

  private isBackupWindowOpen(
    booking: {
      preferredProviderId?: string | null;
      openedAt?: Date | string | null;
      participants?: Array<{ providerProfileId: string; status: ParticipantStatus | string }>;
    },
    policy: Awaited<ReturnType<MatchingService['getPolicy']>>,
  ) {
    return isMarketplaceParticipationWindowOpen(booking, policy);
  }

  private async ensureProviderWalletCanJoinMarketplace(providerProfileId: string) {
    const wallet = await this.prisma.providerEarning.aggregate({
      where: {
        providerProfileId,
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        payoutBatchId: null,
      },
      _sum: { netAmount: true },
    });
    const walletBalance = wallet._sum.netAmount ?? 0;
    if (walletBalance < 0) {
      throwProviderWalletBlocked({ providerProfileId, walletBalance });
    }
  }

  updateStatus(bookingId: string, status: BookingStatus) {
    return this.prisma.booking.update({ where: { id: bookingId }, data: { status } });
  }

  async updateProviderBookingStatus(bookingId: string, providerUserId: string, status: BookingStatus) {
    const provider = await this.requireProvider(providerUserId);
    const booking = await this.requireSelectedProvider(bookingId, provider.id);
    if (status === BookingStatus.ARRIVED) {
      this.assertProviderLifecycleTransition(booking.status, [
        BookingStatus.MATCHED,
        BookingStatus.PROVIDER_ON_THE_WAY,
      ]);
    }
    if (status === BookingStatus.IN_SERVICE) {
      this.assertProviderLifecycleTransition(booking.status, [
        BookingStatus.MATCHED,
        BookingStatus.PROVIDER_ON_THE_WAY,
        BookingStatus.ARRIVED,
      ]);
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
        body: 'Your partner started the service. Continue in the matched chat if needed.',
        data: { bookingId, chatRoomId: updated.chatRoom?.id },
      });
      if (updated.selectedProvider?.userId) {
        await this.notifications.create({
          userId: updated.selectedProvider.userId,
          type: 'service.started',
          title: 'Service started',
          body: 'Continue with the customer in the matched chat if needed.',
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
    const bookingBeforeComplete = await this.requireSelectedProvider(bookingId, provider.id);
    this.assertProviderLifecycleTransition(bookingBeforeComplete.status, [BookingStatus.IN_SERVICE]);

    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.COMPLETED,
        payment: { update: { status: PaymentStatus.CAPTURED } },
      },
      include: { addressSnapshot: true, payment: true, selectedProvider: true },
    });
    await this.earnings.createForCompletedBooking(bookingId, provider.id);
    const result = this.matching.completeBooking(bookingId, clientBookingResponse(booking));
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
      throw new BadRequestException('Authenticated partner is required');
    }

    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        verification: true,
        kyc: true,
        documents: { where: { deletedAt: null } },
        bankAccounts: { where: { deletedAt: null } },
      },
    });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }
    if (provider.status === ProviderStatus.OFFLINE) {
      throw new BadRequestException('Partner must be online before joining bookings');
    }
    return provider;
  }

  private async requireSelectedProvider(bookingId: string, providerId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.selectedProviderId !== providerId) {
      throw new BadRequestException('Partner is not selected for this booking');
    }
    return booking;
  }

  private assertBookingOpenForPartnerResponse(booking: { status: BookingStatus; expiresAt?: Date | null }) {
    assertPartnerResponseWindowOpen(booking);
  }

  private assertProviderLifecycleTransition(current: BookingStatus, allowed: BookingStatus[]) {
    assertProviderLifecycleTransitionAllowed(current, allowed);
  }

  private async getCustomerUserIdForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { customerProfile: true },
    });
    return booking.customerProfile.userId;
  }
}

function assertProviderCanReceiveBooking(provider: {
  blockedAt: Date | null;
  blockedReason: string | null;
  status: ProviderStatus;
  verification?: { status: VerificationStatus } | null;
  kyc?: { status: ProviderKycStatus } | null;
  documents?: Array<{
    type: ProviderDocumentType;
    status: ProviderDocumentStatus;
    deletedAt?: Date | null;
  }>;
  bankAccounts?: Array<{
    status: ProviderBankAccountStatus;
    deletedAt?: Date | null;
  }>;
}) {
  if (provider.blockedAt) {
    throw new BadRequestException(
      provider.blockedReason
        ? `Partner account is blocked by admin review: ${provider.blockedReason}`
        : 'Partner account is blocked by admin review.',
    );
  }
  if (provider.status === ProviderStatus.OFFLINE) {
    throw new BadRequestException('Partner must be online before receiving bookings');
  }
  if (provider.verification?.status !== VerificationStatus.APPROVED) {
    throw new BadRequestException('Partner verification must be approved before receiving bookings');
  }
  if (provider.kyc?.status !== ProviderKycStatus.APPROVED) {
    throw new BadRequestException('Partner KYC must be approved before receiving bookings');
  }

  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === ProviderDocumentStatus.APPROVED && !document.deletedAt)
      .map((document) => document.type),
  );
  const missingDocuments = REQUIRED_BOOKING_DOCUMENT_TYPES.filter((type) => !approvedDocuments.has(type));
  if (missingDocuments.length > 0) {
    throw new BadRequestException(
      `Partner required KYC documents must be approved before receiving bookings: ${missingDocuments.join(', ')}`,
    );
  }

  const hasApprovedBank = (provider.bankAccounts ?? []).some(
    (account) => account.status === ProviderBankAccountStatus.APPROVED && !account.deletedAt,
  );
  if (!hasApprovedBank) {
    throw new BadRequestException('Partner bank account must be approved before receiving bookings');
  }
}

function bookingMatchingPolicySnapshot(policy: Awaited<ReturnType<MatchingService['getPolicy']>>) {
  return {
    providerResponseWindowMinutes: policy.providerResponseWindowMinutes,
    marketplaceRadiusMeters: policy.backupProviderRadiusMeters,
    marketplaceLocationMaxAgeMinutes: policy.backupProviderLocationMaxAgeMinutes,
    marketplaceInvitationLimit: policy.backupProviderInvitationLimit,
    marketplaceOpenMode: policy.backupOpenMode,
    backupProviderRadiusMeters: policy.backupProviderRadiusMeters,
    backupProviderLocationMaxAgeMinutes: policy.backupProviderLocationMaxAgeMinutes,
    backupProviderInvitationLimit: policy.backupProviderInvitationLimit,
    bookingMaxCustomerCurrentToAddressKm: policy.bookingMaxCustomerCurrentToAddressKm,
    bookingMaxPreferredProviderDistanceKm: policy.bookingMaxPreferredProviderDistanceKm,
    bookingCurrentLocationFreshnessMinutes: policy.bookingCurrentLocationFreshnessMinutes,
    bookingDistanceGateEnabled: policy.bookingDistanceGateEnabled,
    bookingServiceAreaRequired: policy.bookingServiceAreaRequired,
    preferredAcceptMode: policy.preferredAcceptMode,
    backupOpenMode: policy.backupOpenMode,
    travelBufferMinutes: policy.travelBufferMinutes,
  };
}

function assertWorldBookingCoordinate(lat: number, lng: number) {
  if (!isWorldBookingCoordinate(lat, lng)) {
    throw new BadRequestException('Booking address coordinate is invalid');
  }
}

function isWorldBookingCoordinate(lat: number, lng: number) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function normalizeBookingAttemptCurrentLocation(
  input: { currentLat?: number; currentLng?: number; currentLocationUpdatedAt?: string },
  policy: MatchingPolicy,
) {
  if (!policy.bookingDistanceGateEnabled) {
    return null;
  }
  const hasAnyCurrentLocationInput =
    input.currentLat != null || input.currentLng != null || input.currentLocationUpdatedAt != null;
  if (!hasAnyCurrentLocationInput) {
    return null;
  }
  const lat = Number(input.currentLat);
  const lng = Number(input.currentLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  const recordedAt = input.currentLocationUpdatedAt ? new Date(input.currentLocationUpdatedAt) : null;
  if (!recordedAt || Number.isNaN(recordedAt.getTime())) {
    return null;
  }
  const now = Date.now();
  if (recordedAt.getTime() > now + 60_000) {
    return null;
  }
  const ageMinutes = Math.max(0, (now - recordedAt.getTime()) / 60_000);
  if (ageMinutes > policy.bookingCurrentLocationFreshnessMinutes) {
    return null;
  }
  return { lat, lng, recordedAt, ageMinutes };
}

function preferredProviderBookingDistanceGateError(
  preferredProvider: { id: string } | null,
  distanceMeters: number | null,
  policy: MatchingPolicy,
) {
  if (!policy.bookingDistanceGateEnabled || !preferredProvider) {
    return null;
  }
  const limitMeters = policy.bookingMaxPreferredProviderDistanceKm * 1000;
  if (distanceMeters === null || distanceMeters > limitMeters) {
    return {
      limitMeters,
      message: `Preferred partner must be within ${policy.bookingMaxPreferredProviderDistanceKm}km of the booking address`,
    };
  }
  return null;
}

function bookingDistanceGateSnapshot(input: {
  matchingPolicy: MatchingPolicy;
  bookingLat: number;
  bookingLng: number;
  addressText: string;
  customerCurrentLocation: ReturnType<typeof normalizeBookingAttemptCurrentLocation>;
  customerToBookingDistanceMeters: number | null;
  preferredProvider: {
    id: string;
    currentLat?: unknown;
    currentLng?: unknown;
    currentLocationUpdatedAt?: Date | null;
  } | null;
  preferredProviderDistanceMeters: number | null;
}) {
  return {
    distanceGateEnabled: input.matchingPolicy.bookingDistanceGateEnabled,
    serviceAreaRequired: input.matchingPolicy.bookingServiceAreaRequired,
    serviceArea: 'VIETNAM',
    serviceAreaValid: isVietnamBookingCoordinate(input.bookingLat, input.bookingLng),
    bookingAddress: {
      lat: input.bookingLat,
      lng: input.bookingLng,
      addressText: input.addressText,
    },
    customerCurrentLocation: input.customerCurrentLocation
      ? {
          lat: input.customerCurrentLocation.lat,
          lng: input.customerCurrentLocation.lng,
          recordedAt: input.customerCurrentLocation.recordedAt.toISOString(),
          ageMinutes: Number(input.customerCurrentLocation.ageMinutes.toFixed(2)),
        }
      : null,
    customerToBookingAddressDistanceMeters: input.customerToBookingDistanceMeters,
    customerDistanceLimitMeters: input.matchingPolicy.bookingMaxCustomerCurrentToAddressKm * 1000,
    preferredProviderId: input.preferredProvider?.id ?? null,
    preferredProviderLocation: input.preferredProvider
      ? {
          lat:
            input.preferredProvider.currentLat === null ? null : Number(input.preferredProvider.currentLat),
          lng:
            input.preferredProvider.currentLng === null ? null : Number(input.preferredProvider.currentLng),
          updatedAt: input.preferredProvider.currentLocationUpdatedAt?.toISOString() ?? null,
        }
      : null,
    preferredProviderDistanceMeters: input.preferredProviderDistanceMeters,
    preferredProviderDistanceLimitMeters: input.matchingPolicy.bookingMaxPreferredProviderDistanceKm * 1000,
    gatePassed: true,
  };
}

function normalizeBookingAddress(address: Prisma.InputJsonValue | undefined, addressText: string) {
  if (address && typeof address === 'object' && !Array.isArray(address)) {
    return { ...(address as Record<string, unknown>), addressText } as Prisma.InputJsonValue;
  }
  if (typeof address === 'string' && address.trim()) {
    return { addressText: address.trim() } as Prisma.InputJsonValue;
  }
  return { addressText } as Prisma.InputJsonValue;
}

function readPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readSnapshotInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function readSnapshotBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
