import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingMatchSource as PrismaBookingMatchSource,
  BookingStatus,
  EarningStatus,
  ParticipantStatus,
  PaymentMethod,
  Prisma,
  ProviderStatus,
} from '@prisma/client';
import { EarningsService } from '../earnings/earnings.service';
import { MatchingGateway } from '../matching/matching.gateway';
import { MatchingService } from '../matching/matching.service';
import {
  MatchingPolicy,
  MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER,
  MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST,
} from '../matching/matching.policy';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
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
  providerLifecycleAllowedPreviousStatuses,
  providerLocationFreshEnough,
  vietnamBookingCoordinateGateError,
} from './bookings.policy';
import {
  assertWorldBookingCoordinate,
  bookingDistanceGateLimits,
  bookingDistanceGateSnapshot,
  bookingGateRejectionAuditCreateInput,
  type BookingGateRejectionAuditInput,
  normalizeBookingAttemptCurrentLocation,
  preferredProviderBookingDistanceGateError,
} from './bookings.gate';
import {
  clientBookingResponse,
  clientBookingResponses,
  partnerBookingResponses,
  partnerOpenBookingResponses,
} from './bookings.response';
import {
  bookingCreateMetadata,
  restoreBookingMatchingPolicy,
} from './bookings.matching-policy';
import { bookingMatchedAuditCreateInput } from './bookings.match-audit';
import {
  bookingCompletedUpdateData,
  bookingResponseTimeoutAt,
  bookingServiceStartedUpdateData,
  openBookingRequestTiming,
} from './bookings.lifecycle';
import {
  providerPayoutSetupMissingRequirements,
  providerPayoutSetupNeedsNotification,
} from './bookings.payout-setup';
import { bookingOpenMatchingPayload } from './bookings.matching-payload';
import {
  appendBackupNotificationTrace,
  backupAlertPolicyMetadata,
  backupNotificationTrace,
  type BackupNotificationTrace,
  type BackupNotificationTraceStage,
} from './bookings.backup-notification-trace';
import {
  backupProviderCandidateWhere,
  backupProvidersWithinRadius,
  nearestBackupProviders,
} from './bookings.backup-providers';
import {
  backupBookingAvailableNotification,
  bookingOpenedNotification,
  customerBookingCancelledNotification,
  customerFirstPickRejectedNotification,
  customerMarketplaceProviderAcceptedNotification,
  customerMarketplaceProviderRejectedNotification,
  customerProviderJoinedNotification,
  customerServiceCompletedNotification,
  firstPickMatchedCustomerNotification,
  firstPickMatchedProviderNotification,
  preferredProviderRequestedNotification,
  providerBookingCancelledNotification,
  providerEarningCreatedNotification,
  providerPayoutSetupRequiredNotification,
  selectedPartnerMatchedCustomerNotification,
  selectedPartnerMatchedProviderNotification,
  serviceStartedCustomerNotification,
  serviceStartedProviderNotification,
} from './bookings.notifications';
import {
  assertProviderCanReceiveBooking,
  assertProviderOffersRequestedService,
} from './bookings.provider-readiness';
import {
  openBookingWhereForProvider,
  providerBookingHistoryWhere,
} from './bookings.provider-query';
import {
  bookingAddressSnapshotCreate,
  bookingCancellationResultWithReleasedPayment,
  bookingCancellationProviderUserIds,
  bookingPaymentCreate,
  bookingServiceLineCreate,
  customerCancellationCloseData,
  normalizeBookingAddress,
  toJson,
} from './bookings.payload';
import {
  bookingFirstPickRejectedUpdateData,
  bookingMatchedUpdateData,
  bookingParticipantCompoundKey,
  bookingParticipantJoinUpsert,
  bookingParticipantResponseRoute,
  bookingParticipantResponseUnavailableMessage,
  preferredProviderInitialParticipantCreate,
} from './bookings.participants';
import { resolveBookingPriceSummary, resolveCustomerPrice } from './bookings.pricing';

type MatchedBookingForClientResponse = Prisma.BookingGetPayload<{
  include: {
    participants: true;
    preferredProvider: true;
    selectedProvider: true;
    chatRoom: true;
    addressSnapshot: true;
    payment: true;
  };
}>;

type SelectedBookingForClientResponse = Prisma.BookingGetPayload<{
  include: {
    addressSnapshot: true;
    chatRoom: true;
    preferredProvider: true;
    selectedProvider: true;
    payment: true;
  };
}>;

type OpenBookingForClientResponse = Prisma.BookingGetPayload<{
  include: {
    services: { include: { service: true } };
    addressSnapshot: true;
    payment: true;
    participants: { include: { providerProfile: true } };
    preferredProvider: true;
    selectedProvider: true;
  };
}>;

type FirstPickRejectedBookingResponse = Prisma.BookingGetPayload<{
  include: {
    participants: true;
    preferredProvider: true;
    selectedProvider: true;
    chatRoom: true;
    addressSnapshot: true;
  };
}>;

type BackupProviderNotificationInput = {
  stage: BackupNotificationTraceStage;
  bookingId: string;
  providers: Array<{ id: string; userId: string; distanceMeters: number }>;
  backupProviderRadiusMeters: number;
  backupOpenMode: string;
  backupProviderInvitationLimit: number;
  matchingPayload: unknown;
};

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

  private async recordBookingGateRejection(input: BookingGateRejectionAuditInput) {
    await this.prisma.adminAuditLog.create(bookingGateRejectionAuditCreateInput(input));
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
      assertProviderOffersRequestedService({ providerService, configuredServiceCount });
    }
    const customerPrice = resolveCustomerPrice(service, providerService?.price);
    await this.ensureServicePayoutRuleConfigured(service.id, customerPrice);
    const coupon = input.couponCode ? await this.resolveCoupon(input.couponCode) : null;
    const selectedLocation = input.selectedLocationId
      ? await this.prisma.customerSelectedLocation.findFirst({
          where: { id: input.selectedLocationId, customerProfileId: customer.id },
        })
      : null;
    if (input.selectedLocationId && !selectedLocation) {
      throw new BadRequestException('Selected customer location was not found');
    }
    const matchingPolicy = await this.matching.getPolicy();
    const distanceGateLimits = bookingDistanceGateLimits(matchingPolicy);
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
          customerDistanceLimitMeters: distanceGateLimits.customerDistanceLimitMeters,
          preferredProviderDistanceLimitMeters: distanceGateLimits.preferredProviderDistanceLimitMeters,
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
    // HANDS MVP is on-demand only. Keep the DB schedule fields as the immutable request clock.
    const timing = openBookingRequestTiming({
      durationMin: service.durationMin,
      providerResponseWindowMinutes: matchingPolicy.providerResponseWindowMinutes,
    });
    const priceSummary = resolveBookingPriceSummary({
      customerPrice,
      adminMinimumAmount: service.basePrice,
      coupon,
    });
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
        customerDistanceLimitMeters: distanceGateLimits.customerDistanceLimitMeters,
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

    let booking: OpenBookingForClientResponse = await this.prisma.booking.create({
      data: {
        customerProfileId: customer.id,
        status: BookingStatus.OPEN_MATCHING,
        scheduledStartAt: timing.scheduledStartAt,
        scheduledEndAt: timing.scheduledEndAt,
        address: addressPayload,
        lat: bookingLat,
        lng: bookingLng,
        addressSnapshot: bookingAddressSnapshotCreate({
          customerProfileId: customer.id,
          selectedLocationId: selectedLocation?.id,
          address: addressPayload,
          addressText,
          latitude: bookingLat,
          longitude: bookingLng,
        }),
        notes: input.notes,
        travelBufferMin: matchingPolicy.travelBufferMinutes,
        earlyAcceptMin: matchingPolicy.providerResponseWindowMinutes,
        preferredProviderId: preferredProvider?.id,
        openedAt: timing.openedAt,
        expiresAt: timing.expiresAt,
        metadata: bookingCreateMetadata({
          policy: matchingPolicy,
          bookingGate: bookingGateSnapshot as Prisma.InputJsonValue,
        }),
        services: bookingServiceLineCreate({ serviceId: service.id, price: customerPrice }),
        payment: bookingPaymentCreate(
          this.payments.buildAuthorization(
            input.paymentMethod,
            priceSummary.finalAmount,
            'pending-booking',
            priceSummary.paymentMetadata,
          ),
        ),
        participants: preferredProvider
          ? preferredProviderInitialParticipantCreate({
              providerProfileId: preferredProvider.id,
              distanceMeters: preferredProviderDistanceMeters,
              providerStatusAtJoin: preferredProvider.status,
            })
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

    booking = await this.refreshBookingPaymentAuthorization(booking);

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
      payload: bookingOpenMatchingPayload(matchingPolicy, eligibleBackupProviders.length),
    });
    await this.scheduleBookingPaymentStatusCheck(booking);
    await this.matching.registerActiveBooking(booking.id, result);
    await this.matching.scheduleBookingTimeout(booking.id, booking.expiresAt ?? timing.expiresAt);
    await this.announceOpenBooking({
      userId,
      bookingId: booking.id,
      customerProfileId: customer.id,
      preferredProvider,
      couponCode: coupon?.code,
      customerDiscountAmount: priceSummary.discountAmount,
      matchingPayload: result,
    });
    await this.notifyBackupProvidersAndRecordTrace({
      stage: 'initial_open',
      bookingId: booking.id,
      providers: eligibleBackupProviders,
      backupProviderRadiusMeters: matchingPolicy.backupProviderRadiusMeters,
      backupOpenMode: matchingPolicy.backupOpenMode,
      backupProviderInvitationLimit: matchingPolicy.backupProviderInvitationLimit,
      matchingPayload: result,
    });
    return result;
  }

  private async refreshBookingPaymentAuthorization(booking: OpenBookingForClientResponse) {
    if (!booking.payment?.id) {
      return booking;
    }

    const payment = await this.payments.refreshAuthorizationForBooking(booking.payment.id, booking.id);
    return { ...booking, payment };
  }

  private async scheduleBookingPaymentStatusCheck(booking: OpenBookingForClientResponse) {
    if (booking.payment?.id) {
      await this.payments.scheduleStatusCheck(booking.payment.id);
    }
  }

  private async reopenBookingAfterFirstPickRejected(input: {
    bookingId: string;
    booking: { metadata?: Prisma.JsonValue | null; services: Array<{ serviceId: string }> };
    reopenedBooking: FirstPickRejectedBookingResponse;
    preferredProviderId: string;
  }) {
    const matchingPolicy = this.bookingPolicy(input.booking, await this.matching.getPolicy());
    const serviceId = input.booking.services[0]?.serviceId;
    const dispatchPin = bookingDispatchCoordinates(input.reopenedBooking);
    const eligibleBackupProviders = serviceId
      ? await this.findEligibleBackupProviders({
          bookingId: input.bookingId,
          serviceId,
          lat: dispatchPin.lat,
          lng: dispatchPin.lng,
          preferredProviderId: input.preferredProviderId,
          backupOpenMode: matchingPolicy.backupOpenMode,
          forceOpen: true,
          policy: matchingPolicy,
        })
      : [];
    const result = this.matching.openBooking({
      booking: input.reopenedBooking,
      policy: matchingPolicy,
      payload: bookingOpenMatchingPayload(matchingPolicy, eligibleBackupProviders.length, {
        firstPickDeclined: true,
      }),
    });
    await this.matching.registerActiveBooking(input.bookingId, result);
    await this.matching.scheduleBookingTimeout(
      input.bookingId,
      bookingResponseTimeoutAt({
        expiresAt: input.reopenedBooking.expiresAt,
        providerResponseWindowMinutes: matchingPolicy.providerResponseWindowMinutes,
      }),
    );
    await this.notifyBackupProvidersAndRecordTrace({
      stage: 'first_pick_declined',
      bookingId: input.bookingId,
      providers: eligibleBackupProviders,
      backupProviderRadiusMeters: matchingPolicy.backupProviderRadiusMeters,
      backupOpenMode: matchingPolicy.backupOpenMode,
      backupProviderInvitationLimit: matchingPolicy.backupProviderInvitationLimit,
      matchingPayload: result,
    });
  }

  private async announceOpenBooking(input: {
    userId: string;
    bookingId: string;
    customerProfileId: string;
    preferredProvider?: { id: string; userId: string; displayName: string } | null;
    couponCode?: string;
    customerDiscountAmount: number;
    matchingPayload: ReturnType<MatchingService['openBooking']>;
  }) {
    await this.notifyCustomerBookingOpened({
      userId: input.userId,
      bookingId: input.bookingId,
      preferredProvider: input.preferredProvider,
      couponCode: input.couponCode,
      discountAmount: input.customerDiscountAmount,
    });

    if (input.preferredProvider?.userId) {
      await this.notifyPreferredProviderRequested(
        input.preferredProvider.userId,
        input.bookingId,
        input.customerProfileId,
      );
      this.matchingGateway.emitDirectBookingRequested(
        input.preferredProvider.userId,
        input.bookingId,
        input.matchingPayload,
      );
      return;
    }

    this.matchingGateway.emitBookingOpened(input.bookingId, input.matchingPayload);
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
      data: customerCancellationCloseData(),
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
    const result = bookingCancellationResultWithReleasedPayment(updated, releasedPayment);

    await this.matching.closeBooking(bookingId);
    await this.notifyBookingCancelled({
      bookingId,
      customerUserId,
      providerUserIds: bookingCancellationProviderUserIds(updated),
      releasedPayment: Boolean(releasedPayment),
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
      where: openBookingWhereForProvider(provider?.id),
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
      where: providerBookingHistoryWhere(provider.id),
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
    this.assertBookingOpenForPartnerResponse(booking);
    assertProviderCanReceiveBooking(provider);
    const matchingPolicy = this.bookingPolicy(booking, await this.matching.getPolicy());
    const distanceMeters = this.requireProviderWithinMatchingRadius(booking, provider, matchingPolicy);

    const participant = await this.prisma.bookingParticipant.upsert({
      ...bookingParticipantJoinUpsert({
        bookingId,
        providerProfileId: provider.id,
        distanceMeters,
        providerStatusAtJoin: provider.status,
      }),
    });

    await this.matching.registerParticipant(bookingId, provider.id, matchingPolicy);
    const result = this.matching.joinBooking(bookingId, participant);
    await this.announceProviderJoined({ bookingId, provider, matchingPayload: result });
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
      where: bookingParticipantCompoundKey(bookingId, providerId),
    });
    if (
      !participant ||
      !isCustomerSelectableParticipantForFinalChoice(participant, ownedBooking.preferredProviderId)
    ) {
      throw new BadRequestException('Partner must participate or accept before customer selection');
    }
    if (isMarketplacePartnerAction(providerId, ownedBooking.preferredProviderId)) {
      await this.ensureProviderWalletCanJoinMarketplace(providerId);
    }
    const booking = await this.matchCustomerSelectedProvider({ bookingId, customerUserId, providerId });

    await this.matching.closeBooking(bookingId);
    const result = this.matching.selectFinalProvider(bookingId, clientBookingResponse(booking));
    await this.announceCustomerSelectedPartnerMatched({
      bookingId,
      customerUserId,
      selectedProviderUserId: booking.selectedProvider?.userId,
      chatRoomId: booking.chatRoom?.id,
      matchingPayload: result,
    });
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

    const participantKey = bookingParticipantCompoundKey(bookingId, provider.id);
    const existingParticipant = await this.prisma.bookingParticipant.findUnique({
      where: participantKey,
      select: { id: true },
    });
    if (!existingParticipant) {
      throw new BadRequestException(
        bookingParticipantResponseUnavailableMessage(booking.preferredProviderId, provider.id),
      );
    }

    const responseRoute = bookingParticipantResponseRoute(booking.preferredProviderId, provider.id, status);
    if (responseRoute === 'first-pick-accepted') {
      const updated = await this.matchFirstPickAcceptedProvider({
        bookingId,
        providerId: provider.id,
        providerUserId: provider.userId,
      });

      await this.matching.closeBooking(bookingId);
      const result = this.matching.selectFinalProvider(
        bookingId,
        clientBookingResponse(updated),
        MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST,
      );
      await this.notifyFirstPickAcceptedMatched({
        bookingId,
        customerUserId: booking.customerProfile.userId,
        provider,
        selectedProviderUserId: updated.selectedProvider?.userId,
        chatRoomId: updated.chatRoom?.id,
      });
      this.matchingGateway.emitBookingMatched(bookingId, result);
      return result;
    }

    if (responseRoute === 'first-pick-rejected') {
      const updated: FirstPickRejectedBookingResponse = await this.prisma.booking.update({
        where: { id: bookingId },
        data: bookingFirstPickRejectedUpdateData({
          bookingId,
          providerProfileId: provider.id,
        }),
        include: {
          participants: true,
          preferredProvider: true,
          selectedProvider: true,
          chatRoom: true,
          addressSnapshot: true,
        },
      });
      await this.matching.closeBooking(bookingId);
      await this.notifyCustomerFirstPickRejected(booking.customerProfile.userId, bookingId, provider.id);
      await this.reopenBookingAfterFirstPickRejected({
        bookingId,
        booking,
        reopenedBooking: updated,
        preferredProviderId: provider.id,
      });
      return updated;
    }

    if (
      status === ParticipantStatus.ACCEPTED &&
      isMarketplacePartnerAction(provider.id, booking.preferredProviderId)
    ) {
      await this.ensureProviderWalletCanJoinMarketplace(provider.id);
    }

    const updatedParticipant = await this.prisma.bookingParticipant.update({
      where: participantKey,
      data: { status, respondedAt: new Date() },
      include: { providerProfile: true },
    });
    await this.announceMarketplaceParticipantResponse({
      status,
      bookingId,
      customerUserId: booking.customerProfile.userId,
      provider,
      participant: updatedParticipant,
    });

    return updatedParticipant;
  }

  private async notifyCustomerBookingOpened(input: {
    userId: string;
    bookingId: string;
    preferredProvider?: { id: string; displayName: string } | null;
    couponCode?: string;
    discountAmount: number;
  }) {
    await this.notifications.create(bookingOpenedNotification(input));
  }

  private async notifyPreferredProviderRequested(
    preferredProviderUserId: string,
    bookingId: string,
    customerProfileId: string,
  ) {
    await this.notifications.create(
      preferredProviderRequestedNotification({
        userId: preferredProviderUserId,
        bookingId,
        customerProfileId,
      }),
    );
  }

  private async notifyBookingCancelled(input: {
    bookingId: string;
    customerUserId: string;
    providerUserIds: Iterable<string>;
    releasedPayment: boolean;
  }) {
    for (const providerUserId of input.providerUserIds) {
      await this.notifications.create(providerBookingCancelledNotification(providerUserId, input.bookingId));
    }

    await this.notifications.create(
      customerBookingCancelledNotification({
        userId: input.customerUserId,
        bookingId: input.bookingId,
        releasedPayment: input.releasedPayment,
      }),
    );
  }

  private async notifyCustomerProviderJoined(
    customerUserId: string,
    bookingId: string,
    provider: { id: string; displayName: string },
  ) {
    await this.notifications.create(
      customerProviderJoinedNotification({ userId: customerUserId, bookingId, provider }),
    );
  }

  private async announceProviderJoined(input: {
    bookingId: string;
    provider: { id: string; displayName: string };
    matchingPayload: unknown;
  }) {
    const customerUserId = await this.getCustomerUserIdForBooking(input.bookingId);
    await this.notifyCustomerProviderJoined(customerUserId, input.bookingId, input.provider);
    this.matchingGateway.emitProviderJoined(input.bookingId, input.matchingPayload);
  }

  private async notifyCustomerSelectedPartnerMatched(input: {
    bookingId: string;
    customerUserId: string;
    selectedProviderUserId?: string;
    chatRoomId?: string;
  }) {
    if (input.selectedProviderUserId) {
      await this.notifications.create(
        selectedPartnerMatchedProviderNotification(input.selectedProviderUserId, input.bookingId),
      );
    }
    await this.notifications.create(
      selectedPartnerMatchedCustomerNotification({
        userId: input.customerUserId,
        bookingId: input.bookingId,
        chatRoomId: input.chatRoomId,
      }),
    );
  }

  private async announceCustomerSelectedPartnerMatched(input: {
    bookingId: string;
    customerUserId: string;
    selectedProviderUserId?: string;
    chatRoomId?: string;
    matchingPayload: unknown;
  }) {
    await this.notifyCustomerSelectedPartnerMatched(input);
    this.matchingGateway.emitBookingMatched(input.bookingId, input.matchingPayload);
  }

  private async matchCustomerSelectedProvider(input: {
    bookingId: string;
    customerUserId: string;
    providerId: string;
  }): Promise<SelectedBookingForClientResponse> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const matchedBooking = await transaction.booking.update({
          where: { id: input.bookingId, status: BookingStatus.OPEN_MATCHING, selectedProviderId: null },
          data: bookingMatchedUpdateData({
            bookingId: input.bookingId,
            providerProfileId: input.providerId,
            matchSource: PrismaBookingMatchSource.CUSTOMER_SELECTED_PARTNER,
          }),
          include: {
            addressSnapshot: true,
            chatRoom: true,
            preferredProvider: true,
            selectedProvider: true,
            payment: true,
          },
        });
        await transaction.adminAuditLog.create(
          bookingMatchedAuditCreateInput({
            actorId: input.customerUserId,
            action: 'booking.matched.customer_selected',
            bookingId: input.bookingId,
            providerProfileId: input.providerId,
            matchSource: MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER,
          }),
        );
        return matchedBooking;
      });
    } catch (error) {
      this.throwStaleBookingMatchRequest(
        error,
        'Booking is already matched or no longer open for customer final selection',
      );
    }
  }

  private async matchFirstPickAcceptedProvider(input: {
    bookingId: string;
    providerId: string;
    providerUserId: string;
  }): Promise<MatchedBookingForClientResponse> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const matchedBooking = await transaction.booking.update({
          where: { id: input.bookingId, status: BookingStatus.OPEN_MATCHING, selectedProviderId: null },
          data: bookingMatchedUpdateData({
            bookingId: input.bookingId,
            providerProfileId: input.providerId,
            matchSource: PrismaBookingMatchSource.FIRST_PICK_ACCEPTED_FIRST,
          }),
          include: {
            participants: true,
            preferredProvider: true,
            selectedProvider: true,
            chatRoom: true,
            addressSnapshot: true,
            payment: true,
          },
        });
        await transaction.adminAuditLog.create(
          bookingMatchedAuditCreateInput({
            actorId: input.providerUserId,
            action: 'booking.matched.first_pick_accepted',
            bookingId: input.bookingId,
            providerProfileId: input.providerId,
            matchSource: MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST,
          }),
        );
        return matchedBooking;
      });
    } catch (error) {
      this.throwStaleBookingMatchRequest(
        error,
        'Booking is already matched or no longer open for first-pick acceptance',
      );
    }
  }

  private async notifyFirstPickAcceptedMatched(input: {
    bookingId: string;
    customerUserId: string;
    provider: { id: string; displayName: string };
    selectedProviderUserId?: string;
    chatRoomId?: string;
  }) {
    if (input.selectedProviderUserId) {
      await this.notifications.create(
        firstPickMatchedProviderNotification(input.selectedProviderUserId, input.bookingId),
      );
    }
    await this.notifications.create(
      firstPickMatchedCustomerNotification({
        userId: input.customerUserId,
        bookingId: input.bookingId,
        provider: input.provider,
        chatRoomId: input.chatRoomId,
      }),
    );
  }

  private async notifyCustomerFirstPickRejected(
    customerUserId: string,
    bookingId: string,
    providerProfileId: string,
  ) {
    await this.notifications.create(
      customerFirstPickRejectedNotification({ userId: customerUserId, bookingId, providerProfileId }),
    );
  }

  private async notifyCustomerMarketplaceProviderAccepted(
    customerUserId: string,
    bookingId: string,
    provider: { id: string; displayName: string },
  ) {
    await this.notifications.create(
      customerMarketplaceProviderAcceptedNotification({ userId: customerUserId, bookingId, provider }),
    );
  }

  private async notifyCustomerMarketplaceProviderRejected(
    customerUserId: string,
    bookingId: string,
    provider: { id: string; displayName: string },
  ) {
    await this.notifications.create(
      customerMarketplaceProviderRejectedNotification({ userId: customerUserId, bookingId, provider }),
    );
  }

  private async announceMarketplaceParticipantResponse(input: {
    status: ParticipantStatus;
    bookingId: string;
    customerUserId: string;
    provider: { id: string; displayName: string };
    participant: unknown;
  }) {
    if (input.status === ParticipantStatus.ACCEPTED) {
      await this.notifyCustomerMarketplaceProviderAccepted(
        input.customerUserId,
        input.bookingId,
        input.provider,
      );
      this.matchingGateway.emitProviderAccepted(input.bookingId, input.participant);
    }

    if (input.status === ParticipantStatus.REJECTED) {
      await this.notifyCustomerMarketplaceProviderRejected(
        input.customerUserId,
        input.bookingId,
        input.provider,
      );
      this.matchingGateway.emitProviderRejected(input.bookingId, input.participant);
    }
  }

  private async notifyServiceStarted(input: {
    bookingId: string;
    customerUserId: string;
    providerUserId?: string;
    chatRoomId?: string;
  }) {
    await this.notifications.create(
      serviceStartedCustomerNotification({
        userId: input.customerUserId,
        bookingId: input.bookingId,
        chatRoomId: input.chatRoomId,
      }),
    );
    if (input.providerUserId) {
      await this.notifications.create(
        serviceStartedProviderNotification({
          userId: input.providerUserId,
          bookingId: input.bookingId,
          chatRoomId: input.chatRoomId,
        }),
      );
    }
  }

  private async notifyCustomerServiceCompleted(customerUserId: string, bookingId: string) {
    await this.notifications.create(customerServiceCompletedNotification(customerUserId, bookingId));
  }

  private async notifyProviderEarningCreated(providerUserId: string, bookingId: string) {
    await this.notifications.create(providerEarningCreatedNotification(providerUserId, bookingId));
  }

  private async notifyBackupProvidersAndRecordTrace(input: BackupProviderNotificationInput) {
    const trace = await this.notifyBackupProviders(input);
    await this.recordBackupNotificationTrace(input.bookingId, trace);
  }

  private async notifyBackupProviders(input: BackupProviderNotificationInput) {
    const alertPolicy = backupAlertPolicyMetadata(input);
    const notifiedProviders: Array<{
      providerProfileId: string;
      userId: string;
      distanceMeters: number;
      notificationId: string;
    }> = [];

    for (const backupProvider of input.providers) {
      const notification = await this.notifications.create(
        backupBookingAvailableNotification({
          userId: backupProvider.userId,
          bookingId: input.bookingId,
          providerProfileId: backupProvider.id,
          distanceMeters: backupProvider.distanceMeters,
          backupProviderRadiusMeters: input.backupProviderRadiusMeters,
          alertPolicy,
        }),
      );
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
    return backupNotificationTrace({
      stage: input.stage,
      alertPolicy,
      notifiedProviders,
      websocketTargetCount: input.providers.length,
    });
  }

  private async recordBackupNotificationTrace(bookingId: string, trace: BackupNotificationTrace) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { metadata: true },
    });
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        metadata: toJson(appendBackupNotificationTrace(booking?.metadata, trace)),
      },
    });
  }

  private bookingPolicy(
    booking: { metadata?: Prisma.JsonValue | null },
    fallback: Awaited<ReturnType<MatchingService['getPolicy']>>,
  ): Awaited<ReturnType<MatchingService['getPolicy']>> {
    return restoreBookingMatchingPolicy(booking.metadata, fallback);
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
    const policy = input.policy ?? (await this.matching.getPolicy());
    const freshLocationAfter = new Date(Date.now() - policy.backupProviderLocationMaxAgeMinutes * 60_000);
    const providers = await this.prisma.providerProfile.findMany({
      where: backupProviderCandidateWhere({ ...input, freshLocationAfter }),
      select: {
        id: true,
        userId: true,
        currentLat: true,
        currentLng: true,
      },
    });

    const providersWithinRadius = backupProvidersWithinRadius(providers, {
      lat: input.lat,
      lng: input.lng,
      radiusMeters: policy.backupProviderRadiusMeters,
    });
    const providersWithClearWallets = await this.excludeNegativeWalletProviders(providersWithinRadius);

    return nearestBackupProviders(providersWithClearWallets, policy.backupProviderInvitationLimit);
  }

  private async excludeNegativeWalletProviders<T extends { id: string }>(providers: T[]) {
    if (providers.length === 0) {
      return providers;
    }

    const walletRows = await this.prisma.providerEarning.groupBy({
      by: ['providerProfileId'],
      where: {
        providerProfileId: { in: providers.map((provider) => provider.id) },
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        payoutBatchId: null,
      },
      _sum: { netAmount: true },
    });
    const blockedProviderIds = new Set(
      walletRows.filter((row) => (row._sum.netAmount ?? 0) < 0).map((row) => row.providerProfileId),
    );

    return providers.filter((provider) => !blockedProviderIds.has(provider.id));
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
    const allowedPreviousStatuses = providerLifecycleAllowedPreviousStatuses(status);
    if (allowedPreviousStatuses) {
      this.assertProviderLifecycleTransition(booking.status, allowedPreviousStatuses);
    }
    if (status === BookingStatus.IN_SERVICE) {
      await this.ensureProviderWalletCanJoinMarketplace(provider.id);
      const updated = await this.prisma.booking.update({
        where: { id: bookingId },
        data: bookingServiceStartedUpdateData(),
        include: { chatRoom: true, preferredProvider: true, selectedProvider: true, customerProfile: true },
      });
      await this.notifyServiceStarted({
        bookingId,
        customerUserId: updated.customerProfile.userId,
        providerUserId: updated.selectedProvider?.userId,
        chatRoomId: updated.chatRoom?.id,
      });
      this.matchingGateway.emitServiceStarted(bookingId, updated);
      return updated;
    }
    return this.updateStatus(bookingId, status);
  }

  async complete(bookingId: string, providerUserId: string) {
    const provider = await this.requireProvider(providerUserId);
    const bookingBeforeComplete = await this.requireSelectedProvider(bookingId, provider.id);
    this.assertProviderLifecycleTransition(
      bookingBeforeComplete.status,
      providerLifecycleAllowedPreviousStatuses(BookingStatus.COMPLETED) ?? [BookingStatus.IN_SERVICE],
    );

    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: bookingCompletedUpdateData(),
      include: { addressSnapshot: true, payment: true, selectedProvider: true },
    });
    await this.earnings.createForCompletedBooking(bookingId, provider.id);
    const result = this.matching.completeBooking(bookingId, clientBookingResponse(booking));
    const customerUserId = await this.getCustomerUserIdForBooking(bookingId);
    await this.notifyCustomerServiceCompleted(customerUserId, bookingId);
    if (booking.selectedProvider?.userId) {
      await this.notifyProviderEarningCreated(booking.selectedProvider.userId, bookingId);
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

    const missing = providerPayoutSetupMissingRequirements(provider);
    if (!providerPayoutSetupNeedsNotification(missing)) {
      return;
    }

    await this.notifications.create(
      providerPayoutSetupRequiredNotification({
        userId: providerUserId,
        bookingId,
        providerProfileId,
        missing,
      }),
    );
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

  private throwStaleBookingMatchRequest(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new BadRequestException(message);
    }

    throw error;
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
