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

const clientBookingDetailInclude = {
  services: { include: { service: true } },
  addressSnapshot: true,
  preferredProvider: true,
  participants: { include: { providerProfile: true } },
  payment: true,
  chatRoom: true,
} satisfies Prisma.BookingInclude;

const clientBookingListInclude = {
  ...clientBookingDetailInclude,
  selectedProvider: true,
} satisfies Prisma.BookingInclude;

const serviceStartedBookingInclude = {
  chatRoom: true,
  preferredProvider: true,
  selectedProvider: true,
  customerProfile: true,
} satisfies Prisma.BookingInclude;

const completedBookingInclude = {
  addressSnapshot: true,
  payment: true,
  selectedProvider: true,
} satisfies Prisma.BookingInclude;

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
    const { customer, customerUserId } = await this.requireCustomerForBookingCreation(userId);
    assertBookingServiceId(input.serviceId);
    assertBookingPaymentMethod(input.paymentMethod);

    const service = await this.prisma.massageService.findUniqueOrThrow({ where: { id: input.serviceId } });
    const { preferredProvider, providerService } = await this.resolvePreferredProviderForBooking({
      providerId: input.providerId,
      serviceId: service.id,
    });
    const { coupon, customerPrice, priceSummary } = await this.resolveBookingPricingForCreation({
      service,
      providerServicePrice: providerService?.price,
      couponCode: input.couponCode,
    });
    const selectedLocation = await this.resolveCustomerSelectedBookingLocation({
      customerProfileId: customer.id,
      selectedLocationId: input.selectedLocationId,
    });
    const matchingPolicy = await this.matching.getPolicy();
    const distanceGateLimits = bookingDistanceGateLimits(matchingPolicy);
    const { addressPayload, addressText, addressTextForAudit, bookingLat, bookingLng } =
      this.resolveBookingAddressInput({
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        selectedLocation,
      });
    if (matchingPolicy.bookingServiceAreaRequired) {
      const serviceAreaError = vietnamBookingCoordinateGateError(bookingLat, bookingLng);
      if (serviceAreaError) {
        await this.rejectBookingOutsideServiceArea({
          actorId: customerUserId,
          customerProfileId: customer.id,
          serviceId: service.id,
          preferredProviderId: preferredProvider?.id,
          bookingLat,
          bookingLng,
          addressText: addressTextForAudit,
          distanceGateLimits,
          message: serviceAreaError.message,
        });
      }
    } else {
      assertWorldBookingCoordinate(bookingLat, bookingLng);
    }
    // HANDS MVP is on-demand only. Keep the DB schedule fields as the immutable request clock.
    const timing = openBookingRequestTiming({
      durationMin: service.durationMin,
      providerResponseWindowMinutes: matchingPolicy.providerResponseWindowMinutes,
    });
    const distanceGate = this.resolveBookingDistanceGate({
      attemptInput: input,
      matchingPolicy,
      bookingLat,
      bookingLng,
      addressText,
      preferredProvider,
    });
    const preferredProviderDistanceGateError = preferredProviderBookingDistanceGateError(
      preferredProvider,
      distanceGate.preferredProviderDistanceMeters,
      matchingPolicy,
    );
    if (preferredProviderDistanceGateError) {
      await this.rejectPreferredProviderTooFar({
        actorId: customerUserId,
        customerProfileId: customer.id,
        serviceId: service.id,
        preferredProviderId: preferredProvider?.id,
        bookingLat,
        bookingLng,
        addressText,
        customerDistanceMeters: distanceGate.customerToBookingDistanceMeters,
        preferredProviderDistanceMeters: distanceGate.preferredProviderDistanceMeters,
        currentLocationRecordedAt: distanceGate.customerCurrentLocation?.recordedAt,
        distanceGateLimits,
        message: preferredProviderDistanceGateError.message,
        preferredProviderDistanceLimitMeters: preferredProviderDistanceGateError.limitMeters,
      });
    }

    let booking: OpenBookingForClientResponse = await this.createOpenMatchingBookingRecord({
      customerProfileId: customer.id,
      selectedLocationId: selectedLocation?.id,
      addressPayload,
      addressText,
      bookingLat,
      bookingLng,
      notes: input.notes,
      matchingPolicy,
      timing,
      preferredProvider,
      bookingGateSnapshot: distanceGate.bookingGateSnapshot,
      serviceId: service.id,
      customerPrice,
      paymentMethod: input.paymentMethod,
      priceSummary,
      preferredProviderDistanceMeters: distanceGate.preferredProviderDistanceMeters,
    });

    booking = await this.refreshBookingPaymentAuthorization(booking);

    const eligibleBackupProviders = await this.findInitialEligibleBackupProviders({
      booking,
      serviceId: service.id,
      preferredProviderId: preferredProvider?.id,
      matchingPolicy,
    });
    const result = await this.activateOpenMatchingBooking({
      booking,
      matchingPolicy,
      eligibleBackupProviderCount: eligibleBackupProviders.length,
      timeoutAt: booking.expiresAt ?? timing.expiresAt,
    });
    await this.announceInitialOpenMatchingBooking({
      userId: customerUserId,
      bookingId: booking.id,
      customerProfileId: customer.id,
      preferredProvider,
      couponCode: coupon?.code,
      customerDiscountAmount: priceSummary.discountAmount,
      matchingPayload: result,
      matchingPolicy,
      eligibleBackupProviders,
    });
    return result;
  }

  private async requireCustomerForBookingCreation(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException('Authenticated customer is required');
    }

    const customer = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }
    return { customer, customerUserId: userId };
  }

  private async resolvePreferredProviderForBooking(input: {
    providerId?: string;
    serviceId: string;
  }) {
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
              serviceId: input.serviceId,
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

    return { preferredProvider, providerService };
  }

  private async resolveCustomerSelectedBookingLocation(input: {
    customerProfileId: string;
    selectedLocationId?: string;
  }) {
    if (!input.selectedLocationId) {
      return null;
    }

    const selectedLocation = await this.prisma.customerSelectedLocation.findFirst({
      where: { id: input.selectedLocationId, customerProfileId: input.customerProfileId },
    });
    if (!selectedLocation) {
      throw new BadRequestException('Selected customer location was not found');
    }
    return selectedLocation;
  }

  private async resolveBookingPricingForCreation(input: {
    service: { id: string; basePrice: number; priceStep?: number | null };
    providerServicePrice?: number | null;
    couponCode?: string;
  }) {
    const customerPrice = resolveCustomerPrice(input.service, input.providerServicePrice);
    await this.ensureServicePayoutRuleConfigured(input.service.id, customerPrice);
    const coupon = input.couponCode ? await this.resolveCoupon(input.couponCode) : null;
    return {
      coupon,
      customerPrice,
      priceSummary: resolveBookingPriceSummary({
        customerPrice,
        adminMinimumAmount: input.service.basePrice,
        coupon,
      }),
    };
  }

  private async rejectBookingOutsideServiceArea(input: {
    actorId: string;
    customerProfileId: string;
    serviceId: string;
    preferredProviderId?: string | null;
    bookingLat: number;
    bookingLng: number;
    addressText: string;
    distanceGateLimits: ReturnType<typeof bookingDistanceGateLimits>;
    message: string;
  }): Promise<never> {
    await this.recordBookingGateRejection({
      actorId: input.actorId,
      customerProfileId: input.customerProfileId,
      serviceId: input.serviceId,
      preferredProviderId: input.preferredProviderId,
      reasonCode: 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
      reason: input.message,
      bookingLat: input.bookingLat,
      bookingLng: input.bookingLng,
      addressText: input.addressText,
      customerDistanceMeters: null,
      preferredProviderDistanceMeters: null,
      customerDistanceLimitMeters: input.distanceGateLimits.customerDistanceLimitMeters,
      preferredProviderDistanceLimitMeters: input.distanceGateLimits.preferredProviderDistanceLimitMeters,
      currentLocationRecordedAt: null,
    });
    throw new BadRequestException(input.message);
  }

  private async rejectPreferredProviderTooFar(input: {
    actorId: string;
    customerProfileId: string;
    serviceId: string;
    preferredProviderId?: string | null;
    bookingLat: number;
    bookingLng: number;
    addressText: string;
    customerDistanceMeters: number | null;
    preferredProviderDistanceMeters: number | null;
    currentLocationRecordedAt?: Date | null;
    distanceGateLimits: ReturnType<typeof bookingDistanceGateLimits>;
    message: string;
    preferredProviderDistanceLimitMeters: number;
  }): Promise<never> {
    await this.recordBookingGateRejection({
      actorId: input.actorId,
      customerProfileId: input.customerProfileId,
      serviceId: input.serviceId,
      preferredProviderId: input.preferredProviderId,
      reasonCode: 'PREFERRED_PARTNER_TOO_FAR',
      reason: input.message,
      bookingLat: input.bookingLat,
      bookingLng: input.bookingLng,
      addressText: input.addressText,
      customerDistanceMeters: input.customerDistanceMeters,
      preferredProviderDistanceMeters: input.preferredProviderDistanceMeters,
      customerDistanceLimitMeters: input.distanceGateLimits.customerDistanceLimitMeters,
      preferredProviderDistanceLimitMeters: input.preferredProviderDistanceLimitMeters,
      currentLocationRecordedAt: input.currentLocationRecordedAt,
    });
    throw new BadRequestException(input.message);
  }

  private resolveBookingDistanceGate(input: {
    attemptInput: {
      currentLat?: number;
      currentLng?: number;
      currentLocationUpdatedAt?: string;
    };
    matchingPolicy: MatchingPolicy;
    bookingLat: number;
    bookingLng: number;
    addressText: string;
    preferredProvider: {
      id: string;
      currentLat?: unknown;
      currentLng?: unknown;
      currentLocationUpdatedAt?: Date | null;
    } | null;
  }) {
    const customerCurrentLocation = normalizeBookingAttemptCurrentLocation(
      input.attemptInput,
      input.matchingPolicy,
    );
    const customerToBookingDistanceMeters = customerCurrentLocation
      ? calculateDistanceMeters(
          customerCurrentLocation.lat,
          customerCurrentLocation.lng,
          input.bookingLat,
          input.bookingLng,
        )
      : null;
    const preferredProviderDistanceMeters = input.preferredProvider
      ? calculateDistanceMeters(
          input.bookingLat,
          input.bookingLng,
          input.preferredProvider.currentLat,
          input.preferredProvider.currentLng,
        )
      : null;

    return {
      bookingGateSnapshot: bookingDistanceGateSnapshot({
        matchingPolicy: input.matchingPolicy,
        bookingLat: input.bookingLat,
        bookingLng: input.bookingLng,
        addressText: input.addressText,
        customerCurrentLocation,
        customerToBookingDistanceMeters,
        preferredProvider: input.preferredProvider,
        preferredProviderDistanceMeters,
      }),
      customerCurrentLocation,
      customerToBookingDistanceMeters,
      preferredProviderDistanceMeters,
    };
  }

  private resolveBookingAddressInput(input: {
    address?: Prisma.InputJsonValue;
    lat?: number;
    lng?: number;
    selectedLocation?: { latitude?: unknown; longitude?: unknown; addressText?: string | null } | null;
  }) {
    const bookingLat = normalizeBookingCoordinate(input.lat ?? input.selectedLocation?.latitude, 'lat');
    const bookingLng = normalizeBookingCoordinate(input.lng ?? input.selectedLocation?.longitude, 'lng');
    const addressTextForAudit =
      bookingAddressText(input.address) ??
      input.selectedLocation?.addressText?.trim() ??
      'Unknown booking address';
    const addressText = bookingAddressText(input.address) ?? input.selectedLocation?.addressText?.trim();
    if (!addressText) {
      throw new BadRequestException('Booking address text is required');
    }
    return {
      addressPayload: normalizeBookingAddress(input.address, addressText),
      addressText,
      addressTextForAudit,
      bookingLat,
      bookingLng,
    };
  }

  private async findInitialEligibleBackupProviders(input: {
    booking: OpenBookingForClientResponse;
    serviceId: string;
    preferredProviderId?: string;
    matchingPolicy: MatchingPolicy;
  }) {
    const dispatchPin = bookingDispatchCoordinates(input.booking);
    return this.findEligibleBackupProviders({
      bookingId: input.booking.id,
      serviceId: input.serviceId,
      lat: dispatchPin.lat,
      lng: dispatchPin.lng,
      preferredProviderId: input.preferredProviderId,
      backupOpenMode: input.matchingPolicy.backupOpenMode,
      policy: input.matchingPolicy,
    });
  }

  private async activateOpenMatchingBooking(input: {
    booking: OpenBookingForClientResponse;
    matchingPolicy: MatchingPolicy;
    eligibleBackupProviderCount: number;
    timeoutAt: Date;
  }) {
    const result = this.matching.openBooking({
      booking: clientBookingResponse(input.booking),
      policy: input.matchingPolicy,
      payload: bookingOpenMatchingPayload(input.matchingPolicy, input.eligibleBackupProviderCount),
    });
    await this.scheduleBookingPaymentStatusCheck(input.booking);
    await this.matching.registerActiveBooking(input.booking.id, result);
    await this.matching.scheduleBookingTimeout(input.booking.id, input.timeoutAt);
    return result;
  }

  private async announceInitialOpenMatchingBooking(input: {
    userId: string;
    bookingId: string;
    customerProfileId: string;
    preferredProvider?: { id: string; userId: string; displayName: string } | null;
    couponCode?: string;
    customerDiscountAmount: number;
    matchingPayload: ReturnType<MatchingService['openBooking']>;
    matchingPolicy: MatchingPolicy;
    eligibleBackupProviders: BackupProviderNotificationInput['providers'];
  }) {
    await this.announceOpenBooking(input);
    await this.notifyBackupProvidersAndRecordTrace({
      stage: 'initial_open',
      bookingId: input.bookingId,
      providers: input.eligibleBackupProviders,
      backupProviderRadiusMeters: input.matchingPolicy.backupProviderRadiusMeters,
      backupOpenMode: input.matchingPolicy.backupOpenMode,
      backupProviderInvitationLimit: input.matchingPolicy.backupProviderInvitationLimit,
      matchingPayload: input.matchingPayload,
    });
  }

  private createOpenMatchingBookingRecord(input: {
    customerProfileId: string;
    selectedLocationId?: string | null;
    addressPayload: Prisma.InputJsonValue;
    addressText: string;
    bookingLat: number;
    bookingLng: number;
    notes?: string;
    matchingPolicy: MatchingPolicy;
    timing: ReturnType<typeof openBookingRequestTiming>;
    preferredProvider?: { id: string; status: ProviderStatus } | null;
    bookingGateSnapshot: unknown;
    serviceId: string;
    customerPrice: number;
    paymentMethod: PaymentMethod;
    priceSummary: ReturnType<typeof resolveBookingPriceSummary>;
    preferredProviderDistanceMeters: number | null;
  }) {
    return this.prisma.booking.create({
      data: {
        customerProfileId: input.customerProfileId,
        status: BookingStatus.OPEN_MATCHING,
        scheduledStartAt: input.timing.scheduledStartAt,
        scheduledEndAt: input.timing.scheduledEndAt,
        address: input.addressPayload,
        lat: input.bookingLat,
        lng: input.bookingLng,
        addressSnapshot: bookingAddressSnapshotCreate({
          customerProfileId: input.customerProfileId,
          selectedLocationId: input.selectedLocationId,
          address: input.addressPayload,
          addressText: input.addressText,
          latitude: input.bookingLat,
          longitude: input.bookingLng,
        }),
        notes: input.notes,
        travelBufferMin: input.matchingPolicy.travelBufferMinutes,
        earlyAcceptMin: input.matchingPolicy.providerResponseWindowMinutes,
        preferredProviderId: input.preferredProvider?.id,
        openedAt: input.timing.openedAt,
        expiresAt: input.timing.expiresAt,
        metadata: bookingCreateMetadata({
          policy: input.matchingPolicy,
          bookingGate: input.bookingGateSnapshot as Prisma.InputJsonValue,
        }),
        services: bookingServiceLineCreate({ serviceId: input.serviceId, price: input.customerPrice }),
        payment: bookingPaymentCreate(
          this.payments.buildAuthorization(
            input.paymentMethod,
            input.priceSummary.finalAmount,
            'pending-booking',
            input.priceSummary.paymentMetadata,
          ),
        ),
        participants: input.preferredProvider
          ? preferredProviderInitialParticipantCreate({
              providerProfileId: input.preferredProvider.id,
              distanceMeters: input.preferredProviderDistanceMeters,
              providerStatusAtJoin: input.preferredProvider.status,
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
    const eligibleBackupProviders = await this.findFirstPickDeclinedBackupProviders({
      bookingId: input.bookingId,
      reopenedBooking: input.reopenedBooking,
      serviceId,
      preferredProviderId: input.preferredProviderId,
      matchingPolicy,
    });
    const result = await this.activateFirstPickDeclinedOpenMatching({
      bookingId: input.bookingId,
      reopenedBooking: input.reopenedBooking,
      matchingPolicy,
      eligibleBackupProviderCount: eligibleBackupProviders.length,
    });
    await this.notifyFirstPickDeclinedBackupProviders({
      bookingId: input.bookingId,
      matchingPolicy,
      eligibleBackupProviders,
      matchingPayload: result,
    });
  }

  private async findFirstPickDeclinedBackupProviders(input: {
    bookingId: string;
    reopenedBooking: FirstPickRejectedBookingResponse;
    serviceId?: string;
    preferredProviderId: string;
    matchingPolicy: MatchingPolicy;
  }) {
    if (!input.serviceId) {
      return [];
    }

    const dispatchPin = bookingDispatchCoordinates(input.reopenedBooking);
    return this.findEligibleBackupProviders({
      bookingId: input.bookingId,
      serviceId: input.serviceId,
      lat: dispatchPin.lat,
      lng: dispatchPin.lng,
      preferredProviderId: input.preferredProviderId,
      backupOpenMode: input.matchingPolicy.backupOpenMode,
      forceOpen: true,
      policy: input.matchingPolicy,
    });
  }

  private async activateFirstPickDeclinedOpenMatching(input: {
    bookingId: string;
    reopenedBooking: FirstPickRejectedBookingResponse;
    matchingPolicy: MatchingPolicy;
    eligibleBackupProviderCount: number;
  }) {
    const result = this.matching.openBooking({
      booking: input.reopenedBooking,
      policy: input.matchingPolicy,
      payload: bookingOpenMatchingPayload(input.matchingPolicy, input.eligibleBackupProviderCount, {
        firstPickDeclined: true,
      }),
    });
    await this.matching.registerActiveBooking(input.bookingId, result);
    await this.matching.scheduleBookingTimeout(
      input.bookingId,
      bookingResponseTimeoutAt({
        expiresAt: input.reopenedBooking.expiresAt,
        providerResponseWindowMinutes: input.matchingPolicy.providerResponseWindowMinutes,
      }),
    );
    return result;
  }

  private async notifyFirstPickDeclinedBackupProviders(input: {
    bookingId: string;
    matchingPolicy: MatchingPolicy;
    eligibleBackupProviders: BackupProviderNotificationInput['providers'];
    matchingPayload: ReturnType<MatchingService['openBooking']>;
  }) {
    await this.notifyBackupProvidersAndRecordTrace({
      stage: 'first_pick_declined',
      bookingId: input.bookingId,
      providers: input.eligibleBackupProviders,
      backupProviderRadiusMeters: input.matchingPolicy.backupProviderRadiusMeters,
      backupOpenMode: input.matchingPolicy.backupOpenMode,
      backupProviderInvitationLimit: input.matchingPolicy.backupProviderInvitationLimit,
      matchingPayload: input.matchingPayload,
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
      include: clientBookingDetailInclude,
    });
    return clientBookingResponse(booking);
  }

  async getCustomerBooking(id: string, customerUserId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    const booking = await this.prisma.booking.findFirstOrThrow({
      where: { id, customerProfileId: customer.id },
      include: clientBookingDetailInclude,
    });
    return clientBookingResponse(booking);
  }

  async listCustomerBookings(customerUserId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    const bookings = await this.prisma.booking.findMany({
      where: { customerProfileId: customer.id },
      include: clientBookingListInclude,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return clientBookingResponses(bookings);
  }

  async cancelCustomerBooking(bookingId: string, customerUserId: string) {
    await this.requireCustomerCancellableBooking(bookingId, customerUserId);
    const cancellation = await this.closeCustomerBookingWithPaymentRelease(bookingId);

    await this.matching.closeBooking(bookingId);
    const clientResult = clientBookingResponse(cancellation.result);
    await this.announceCustomerBookingCancelled({
      bookingId,
      customerUserId,
      providerUserIds: cancellation.providerUserIds,
      releasedPayment: cancellation.releasedPayment,
      matchingPayload: clientResult,
    });
    return clientResult;
  }

  private async closeCustomerBookingWithPaymentRelease(bookingId: string) {
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: customerCancellationCloseData(),
      include: clientBookingListInclude,
    });
    return {
      ...(await this.bookingCancellationResultWithPaymentRelease(updated)),
      providerUserIds: bookingCancellationProviderUserIds(updated),
    };
  }

  private async requireCustomerCancellableBooking(bookingId: string, customerUserId: string) {
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
    return booking;
  }

  private async bookingCancellationResultWithPaymentRelease<TBooking extends { payment?: { id: string } | null }>(
    booking: TBooking,
  ) {
    const releasedPayment = booking.payment ? await this.payments.release(booking.payment.id) : null;
    return {
      result: bookingCancellationResultWithReleasedPayment(booking, releasedPayment),
      releasedPayment: Boolean(releasedPayment),
    };
  }

  private async announceCustomerBookingCancelled(input: {
    bookingId: string;
    customerUserId: string;
    providerUserIds: Iterable<string>;
    releasedPayment: boolean;
    matchingPayload: unknown;
  }) {
    await this.notifyBookingCancelled({
      bookingId: input.bookingId,
      customerUserId: input.customerUserId,
      providerUserIds: input.providerUserIds,
      releasedPayment: input.releasedPayment,
    });
    this.matchingGateway.emitBookingExpired(input.bookingId, input.matchingPayload);
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
      include: clientBookingListInclude,
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

    const participant = await this.joinProviderBookingParticipant({
      bookingId,
      providerProfileId: provider.id,
      distanceMeters,
      providerStatusAtJoin: provider.status,
    });

    await this.matching.registerParticipant(bookingId, provider.id, matchingPolicy);
    const result = this.matching.joinBooking(bookingId, participant);
    await this.announceProviderJoined({ bookingId, provider, matchingPayload: result });
    return result;
  }

  private joinProviderBookingParticipant(input: {
    bookingId: string;
    providerProfileId: string;
    providerStatusAtJoin: ProviderStatus;
    distanceMeters: number | null;
  }) {
    return this.prisma.bookingParticipant.upsert({
      ...bookingParticipantJoinUpsert(input),
    });
  }

  async selectProvider(bookingId: string, customerUserId: string, providerId: string) {
    const ownedBooking = await this.requireCustomerOpenMatchingBooking(bookingId, customerUserId);
    await this.assertCustomerCanSelectProvider({
      bookingId,
      providerId,
      preferredProviderId: ownedBooking.preferredProviderId,
    });
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

  private async requireCustomerOpenMatchingBooking(bookingId: string, customerUserId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerProfileId: customer.id, status: BookingStatus.OPEN_MATCHING },
    });
    if (!booking) {
      throw new BadRequestException('Booking is not open or does not belong to this customer');
    }
    return booking;
  }

  private async assertCustomerCanSelectProvider(input: {
    bookingId: string;
    providerId: string;
    preferredProviderId?: string | null;
  }) {
    const participant = await this.prisma.bookingParticipant.findUnique({
      where: bookingParticipantCompoundKey(input.bookingId, input.providerId),
    });
    if (
      !participant ||
      !isCustomerSelectableParticipantForFinalChoice(participant, input.preferredProviderId)
    ) {
      throw new BadRequestException('Partner must participate or accept before customer selection');
    }
    if (isMarketplacePartnerAction(input.providerId, input.preferredProviderId)) {
      await this.ensureProviderWalletCanJoinMarketplace(input.providerId);
    }
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

    const { participantKey, responseRoute } = await this.requireParticipantResponseTarget({
      bookingId,
      providerId: provider.id,
      preferredProviderId: booking.preferredProviderId,
      status,
    });
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
      await this.announceFirstPickAcceptedMatched({
        bookingId,
        customerUserId: booking.customerProfile.userId,
        provider,
        selectedProviderUserId: updated.selectedProvider?.userId,
        chatRoomId: updated.chatRoom?.id,
        matchingPayload: result,
      });
      return result;
    }

    if (responseRoute === 'first-pick-rejected') {
      const updated = await this.rejectFirstPickProvider({ bookingId, providerId: provider.id });
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

  private async requireParticipantResponseTarget(input: {
    bookingId: string;
    providerId: string;
    preferredProviderId?: string | null;
    status: ParticipantStatus;
  }) {
    const participantKey = bookingParticipantCompoundKey(input.bookingId, input.providerId);
    const existingParticipant = await this.prisma.bookingParticipant.findUnique({
      where: participantKey,
      select: { id: true },
    });
    if (!existingParticipant) {
      throw new BadRequestException(
        bookingParticipantResponseUnavailableMessage(input.preferredProviderId, input.providerId),
      );
    }

    return {
      participantKey,
      responseRoute: bookingParticipantResponseRoute(
        input.preferredProviderId,
        input.providerId,
        input.status,
      ),
    };
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

  private async rejectFirstPickProvider(input: {
    bookingId: string;
    providerId: string;
  }): Promise<FirstPickRejectedBookingResponse> {
    return this.prisma.booking.update({
      where: { id: input.bookingId },
      data: bookingFirstPickRejectedUpdateData({
        bookingId: input.bookingId,
        providerProfileId: input.providerId,
      }),
      include: {
        participants: true,
        preferredProvider: true,
        selectedProvider: true,
        chatRoom: true,
        addressSnapshot: true,
      },
    });
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

  private async announceFirstPickAcceptedMatched(input: {
    bookingId: string;
    customerUserId: string;
    provider: { id: string; displayName: string };
    selectedProviderUserId?: string;
    chatRoomId?: string;
    matchingPayload: unknown;
  }) {
    await this.notifyFirstPickAcceptedMatched(input);
    this.matchingGateway.emitBookingMatched(input.bookingId, input.matchingPayload);
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

  private updateBookingStatus(bookingId: string, status: BookingStatus) {
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
      return this.startProviderService({ bookingId, providerProfileId: provider.id });
    }
    return this.updateBookingStatus(bookingId, status);
  }

  private async startProviderService(input: { bookingId: string; providerProfileId: string }) {
    await this.ensureProviderWalletCanJoinMarketplace(input.providerProfileId);
    const updated = await this.prisma.booking.update({
      where: { id: input.bookingId },
      data: bookingServiceStartedUpdateData(),
      include: serviceStartedBookingInclude,
    });
    await this.announceServiceStarted({
      bookingId: input.bookingId,
      customerUserId: updated.customerProfile.userId,
      providerUserId: updated.selectedProvider?.userId,
      chatRoomId: updated.chatRoom?.id,
      matchingPayload: updated,
    });
    return updated;
  }

  private async announceServiceStarted(input: {
    bookingId: string;
    customerUserId: string;
    providerUserId?: string;
    chatRoomId?: string;
    matchingPayload: unknown;
  }) {
    await this.notifyServiceStarted({
      bookingId: input.bookingId,
      customerUserId: input.customerUserId,
      providerUserId: input.providerUserId,
      chatRoomId: input.chatRoomId,
    });
    this.matchingGateway.emitServiceStarted(input.bookingId, input.matchingPayload);
  }

  async complete(bookingId: string, providerUserId: string) {
    const provider = await this.requireProviderCanCompleteBooking(bookingId, providerUserId);
    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: bookingCompletedUpdateData(),
      include: completedBookingInclude,
    });
    await this.earnings.createForCompletedBooking(bookingId, provider.id);
    const result = this.matching.completeBooking(bookingId, clientBookingResponse(booking));
    await this.announceServiceCompleted({
      bookingId,
      providerProfileId: provider.id,
      selectedProviderUserId: booking.selectedProvider?.userId,
      matchingPayload: result,
    });
    return result;
  }

  private async requireProviderCanCompleteBooking(bookingId: string, providerUserId: string) {
    const provider = await this.requireProvider(providerUserId);
    const bookingBeforeComplete = await this.requireSelectedProvider(bookingId, provider.id);
    this.assertProviderLifecycleTransition(
      bookingBeforeComplete.status,
      providerLifecycleAllowedPreviousStatuses(BookingStatus.COMPLETED) ?? [BookingStatus.IN_SERVICE],
    );
    return provider;
  }

  private async announceServiceCompleted(input: {
    bookingId: string;
    providerProfileId: string;
    selectedProviderUserId?: string;
    matchingPayload: unknown;
  }) {
    const customerUserId = await this.getCustomerUserIdForBooking(input.bookingId);
    await this.notifyCustomerServiceCompleted(customerUserId, input.bookingId);
    if (input.selectedProviderUserId) {
      await this.notifyProviderEarningCreated(input.selectedProviderUserId, input.bookingId);
      await this.notifyProviderFirstRevenuePayoutSetup(
        input.providerProfileId,
        input.selectedProviderUserId,
        input.bookingId,
      );
    }
    this.matchingGateway.emitServiceCompleted(input.bookingId, input.matchingPayload);
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
