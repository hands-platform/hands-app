import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  BookingMatchSource as PrismaBookingMatchSource,
  BookingStatus,
  CustomerWalletLedgerType,
  ParticipantStatus,
  PaymentMethod,
  PaymentAdminOperationStatus,
  PaymentStatus,
  Prisma,
  ProviderStatus,
  Role,
  ServicePublicationStatus,
} from '@prisma/client';
import { ConflictException, Logger, Optional } from '@nestjs/common';
import { EarningsService } from '../earnings/earnings.service';
import { MatchingGateway } from '../matching/matching.gateway';
import { MatchingService } from '../matching/matching.service';
import {
  MatchingPolicy,
  MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER,
  MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST,
} from '../matching/matching.policy';
import {
  NotificationsService,
  createNotifications,
  notificationBatchFailure,
  notificationRecoveryAuditPayloads,
} from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import {
  customerWalletBookingLockKey,
  customerWalletPaymentSourceKey,
} from '../payments/customer-wallet-payment';
import { paymentCaptureSourceStatuses, transitionPaymentStatus } from '../payments/payment-status-transition';
import { throwProviderWalletBlocked } from '../provider-wallet/provider-wallet.policy';
import { lockProviderWalletLedger } from '../provider-wallet/provider-wallet-lock';
import { PrismaService } from '../prisma/prisma.service';
import { assertCouponLaunchEnabled } from '../common/launch-features';
import { ProviderAvailabilityLifecycleService } from '../providers/provider-availability-lifecycle.service';
import {
  addProviderMatchingDistance,
  assertBookingPaymentMethod,
  assertBookingServiceId,
  assertCustomerDirectCancellationAllowed,
  assertPartnerResponseWindowOpen,
  assertProviderLifecycleTransitionAllowed,
  bookingAddressText,
  bookingDispatchCoordinates,
  bookingHasPartnerCommitment,
  calculateDistanceMeters,
  formatMatchingRadius,
  isCustomerSelectableParticipantForFinalChoice,
  isMarketplaceParticipationWindowOpen,
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
  customerCurrentLocationBookingDistanceGateError,
  normalizeBookingAttemptCurrentLocation,
  preferredProviderBookingDistanceGateError,
} from './bookings.gate';
import {
  bookingCreationFingerprint,
  bookingCreationLockKey,
  bookingCreationRequestFromMetadata,
  bookingCreationRequestMetadata,
} from './bookings.creation-idempotency';
import {
  preferredProviderRejectionReasonCodes,
  type PreferredProviderRejectionReasonCode,
} from './bookings.dto';
import { normalizeProviderBookingAlertPreferences } from './bookings.alert-preferences';
import {
  COUPON_RELEASE_REASON,
  consumeCouponRedemptionForBooking,
  normalizeBookingCouponCode,
  prepareCouponRedemptionReservation,
  releaseCouponRedemptionForBooking,
} from './bookings.coupon-redemption';
import {
  clientBookingResponse,
  clientBookingResponses,
  partnerBookingResponse,
  partnerBookingResponses,
  partnerOpenBookingResponses,
} from './bookings.response';
import { bookingCreateMetadata, restoreBookingMatchingPolicy } from './bookings.matching-policy';
import { bookingMatchedAuditCreateInput } from './bookings.match-audit';
import {
  bookingCompletedUpdateData,
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
  finalizeBackupProviderDispatchCandidates,
  resolveBackupProviderDispatchCandidates,
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
  assertProviderCanViewOpenBookingMarketplace,
  assertProviderOffersRequestedService,
  PROVIDER_ACTIVE_WORK_STATUS_VALUES,
  providerHasActiveSelectedBooking,
} from './bookings.provider-readiness';
import { openBookingWhereForProvider, providerBookingHistoryWhere } from './bookings.provider-query';
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
import {
  isPostMatchCancellationAutoApprovalWindow,
  POST_MATCH_CANCELLATION_APPROVED_REASON,
  POST_MATCH_CANCELLATION_PARTNER_PENDING_REASON,
  restorePostMatchCancellationEarning,
} from './post-match-cancellation';
import {
  providerCancellationReasonLabel,
  providerCancellationRequiresAdminReview,
  type ProviderCancellationReasonCode,
} from './provider-cancellation-reason';

type MatchedBookingForClientResponse = Prisma.BookingGetPayload<{
  include: typeof matchedBookingForClientInclude;
}>;

type SelectedBookingForClientResponse = Prisma.BookingGetPayload<{
  include: typeof selectedBookingForClientInclude;
}>;

type OpenBookingForClientResponse = Prisma.BookingGetPayload<{
  include: typeof openBookingForClientInclude;
}>;

type OpenBookingListOptions = {
  cursor?: string | null;
  take?: number | string | null;
};

type ProviderBookingListOptions = OpenBookingListOptions & {
  scope?: string | null;
};

type ProviderBookingDetailViewTelemetryInput = {
  durationSeconds?: number | null;
  eventType: 'heartbeat' | 'closed';
};

type FirstPickRejectedBookingResponse = Prisma.BookingGetPayload<{
  include: typeof firstPickRejectedBookingInclude;
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

const DEFAULT_PARTNER_OPEN_BOOKINGS_LIMIT = 20;
const MAX_PARTNER_OPEN_BOOKINGS_LIMIT = 50;
const DEFAULT_PARTNER_BOOKING_HISTORY_LIMIT = 10;
const MAX_PARTNER_BOOKING_HISTORY_LIMIT = 50;
const PROVIDER_BOOKING_HISTORY_STATUS_VALUES = [
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.NO_SHOW,
  BookingStatus.EXPIRED,
  BookingStatus.REFUNDED,
] as const;
const PROVIDER_OPEN_REQUEST_LIST_VIEWED_EVENT = 'OPEN_REQUEST_LIST_VIEWED';
const PROVIDER_OPEN_REQUEST_DETAIL_VIEWED_EVENT = 'OPEN_REQUEST_DETAIL_VIEWED';
const PROVIDER_OPEN_REQUEST_DETAIL_HEARTBEAT_EVENT = 'OPEN_REQUEST_DETAIL_HEARTBEAT';
const PROVIDER_OPEN_REQUEST_DETAIL_CLOSED_EVENT = 'OPEN_REQUEST_DETAIL_CLOSED';
const BOOKING_COMPLETION_CAPTURE_ACTION = 'BOOKING_COMPLETION_CAPTURE';
const BOOKING_COMPLETION_CAPTURE_IDEMPOTENCY_KEY = 'booking-completion-capture';

const matchedBookingForClientInclude = {
  services: { include: { service: true } },
  participants: true,
  preferredProvider: true,
  selectedProvider: true,
  chatRoom: true,
  addressSnapshot: true,
  payment: true,
} satisfies Prisma.BookingInclude;

const selectedBookingForClientInclude = {
  services: { include: { service: true } },
  addressSnapshot: true,
  chatRoom: true,
  preferredProvider: true,
  selectedProvider: true,
  payment: true,
} satisfies Prisma.BookingInclude;

const openBookingForClientInclude = {
  services: { include: { service: true } },
  customerProfile: {
    select: {
      gender: true,
      nationality: true,
      user: { select: { fullName: true, phone: true } },
    },
  },
  addressSnapshot: true,
  payment: true,
  participants: { include: { providerProfile: true } },
  preferredProvider: true,
  selectedProvider: true,
} satisfies Prisma.BookingInclude;

const paymentRecoveryBookingInclude = {
  ...openBookingForClientInclude,
  customerProfile: {
    select: {
      userId: true,
      gender: true,
      nationality: true,
      user: { select: { fullName: true, phone: true } },
    },
  },
} satisfies Prisma.BookingInclude;

const firstPickRejectedBookingInclude = {
  services: { include: { service: true } },
  participants: true,
  preferredProvider: true,
  selectedProvider: true,
  chatRoom: true,
  addressSnapshot: true,
  payment: true,
} satisfies Prisma.BookingInclude;

const clientBookingDetailInclude = {
  services: { include: { service: true } },
  addressSnapshot: true,
  preferredProvider: true,
  selectedProvider: {
    select: {
      id: true,
      displayName: true,
      ratingAvg: true,
      reviewCount: true,
    },
  },
  participants: { include: { providerProfile: true } },
  payment: true,
  refunds: {
    orderBy: { createdAt: 'desc' as const },
    select: { status: true },
    take: 1,
  },
  chatRoom: true,
  review: true,
  snapshots: {
    orderBy: { recordedAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.BookingInclude;

const clientBookingListInclude = {
  services: { include: { service: true } },
  customerProfile: {
    select: {
      gender: true,
      nationality: true,
      user: { select: { fullName: true, phone: true } },
    },
  },
  addressSnapshot: true,
  preferredProvider: true,
  participants: { include: { providerProfile: true } },
  payment: true,
  refunds: {
    orderBy: { createdAt: 'desc' as const },
    select: { status: true },
    take: 1,
  },
  chatRoom: true,
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

const customerCancellableBookingInclude = {
  preferredProvider: true,
  participants: { include: { providerProfile: true } },
  selectedProvider: true,
  payment: true,
  opsTasks: {
    where: { type: BookingOpsTaskType.PAYMENT_REVIEWED },
    select: { status: true, type: true },
  },
} satisfies Prisma.BookingInclude;

const providerBookingHistoryInclude = {
  services: { include: { service: true } },
  customerProfile: {
    select: {
      gender: true,
      nationality: true,
      user: { select: { fullName: true, phone: true } },
    },
  },
  addressSnapshot: true,
  participants: true,
  preferredProvider: true,
  selectedProvider: true,
  payment: true,
  chatRoom: true,
} satisfies Prisma.BookingInclude;

const providerCancellationBookingInclude = {
  ...providerBookingHistoryInclude,
  customerProfile: true,
} satisfies Prisma.BookingInclude;

const joinableBookingForPartnerInclude = {
  addressSnapshot: true,
  participants: { select: { providerProfileId: true, status: true } },
  services: { select: { serviceId: true } },
} satisfies Prisma.BookingInclude;

const participantResponseBookingInclude = {
  customerProfile: true,
  preferredProvider: true,
  selectedProvider: true,
  chatRoom: true,
  services: { select: { serviceId: true } },
  payment: true,
  opsTasks: {
    where: { type: BookingOpsTaskType.PAYMENT_REVIEWED },
    select: { status: true, type: true },
  },
} satisfies Prisma.BookingInclude;

const providerActiveWorkStatuses: BookingStatus[] = [
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
];

const providerBookingReadinessInclude = {
  verification: true,
  kyc: true,
  documents: { where: { deletedAt: null } },
  bankAccounts: { where: { deletedAt: null } },
  workingHours: { orderBy: { weekday: 'asc' as const } },
  sessions: {
    orderBy: { lastSeenAt: 'desc' as const },
    select: { lastSeenAt: true },
    take: 1,
  },
  user: {
    select: {
      createdAt: true,
      appSessions: {
        where: { role: Role.PROVIDER },
        orderBy: { lastSeenAt: 'desc' as const },
        select: { lastSeenAt: true },
        take: 1,
      },
      appUsageDailyAggregates: {
        where: { role: Role.PROVIDER },
        orderBy: { lastOccurredAt: 'desc' as const },
        select: { lastOccurredAt: true },
        take: 1,
      },
    },
  },
  selectedBookings: {
    where: { status: { in: providerActiveWorkStatuses } },
    select: { id: true, status: true },
    take: 1,
  },
} satisfies Prisma.ProviderProfileInclude;

type ProviderBookingReadiness = Prisma.ProviderProfileGetPayload<{
  include: typeof providerBookingReadinessInclude;
}>;

const preferredProviderBookingReadinessInclude = {
  ...providerBookingReadinessInclude,
} satisfies Prisma.ProviderProfileInclude;

const firstRevenuePayoutSetupProviderInclude = {
  taxProfile: true,
  agreements: true,
} satisfies Prisma.ProviderProfileInclude;

const marketplaceParticipantResponseInclude = {
  providerProfile: true,
} satisfies Prisma.BookingParticipantInclude;

const bookingCustomerProfileInclude = {
  customerProfile: true,
} satisfies Prisma.BookingInclude;

const providerPostMatchCancellableStatuses: BookingStatus[] = [
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
];

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly matchingGateway: MatchingGateway,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly earnings: EarningsService,
    @Optional()
    private readonly providerAvailabilityLifecycle?: ProviderAvailabilityLifecycleService,
  ) {}

  private async markProviderBusy(providerProfileId: string) {
    try {
      await this.providerAvailabilityLifecycle?.markBusy(providerProfileId);
    } catch (error) {
      this.logger.warn(
        `Partner availability busy sync failed for ${providerProfileId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async reconcileProviderAvailability(providerProfileId: string | null | undefined) {
    if (!providerProfileId) return;
    try {
      await this.providerAvailabilityLifecycle?.reconcile(providerProfileId);
    } catch (error) {
      this.logger.warn(
        `Partner availability release sync failed for ${providerProfileId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async runPostCommitBookingEffects(
    bookingId: string,
    effects: Array<{ label: string; run: () => Promise<unknown> }>,
  ) {
    await Promise.all(
      effects.map(async (effect) => {
        const attempts = bookingPostCommitEffectRetryable(effect.label) ? 3 : 1;
        let lastError: unknown;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
          try {
            await effect.run();
            return;
          } catch (error) {
            lastError = error;
            if (attempt < attempts) {
              await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
            }
          }
        }

        this.logger.error(
          `Booking ${bookingId} committed, but post-commit effect ${effect.label} failed: ${
            lastError instanceof Error ? lastError.message : String(lastError)
          }`,
          lastError instanceof Error ? lastError.stack : undefined,
        );
        try {
          const notificationRecoveries = notificationRecoveryAuditPayloads(lastError);
          await this.prisma.adminAuditLog.create({
            data: {
              actorId: null,
              actorKey: 'booking-post-commit-effects',
              actorType: 'SYSTEM',
              action: 'booking.post_commit_effect.failed',
              area: 'BOOKING',
              objectId: bookingId,
              objectType: 'Booking',
              outcome: 'FAILED',
              severity: 'REVIEW',
              source: 'bookings_service',
              target: `booking:${bookingId}`,
              metadata: {
                bookingId,
                effect: effect.label,
                attempts,
                error:
                  lastError instanceof Error
                  ? lastError.message.slice(0, 500)
                  : String(lastError).slice(0, 500),
                ...(notificationRecoveries ? { notificationRecoveries } : {}),
              },
            },
          });
        } catch (auditError) {
          this.logger.error(
            `Booking ${bookingId} post-commit failure evidence could not be recorded: ${
              auditError instanceof Error ? auditError.message : String(auditError)
            }`,
          );
        }
      }),
    );
  }

  private async recordBookingGateRejection(input: BookingGateRejectionAuditInput) {
    await this.prisma.adminAuditLog.create(bookingGateRejectionAuditCreateInput(input));
  }

  async createOpenMatchingBooking(
    userId: string | undefined,
    input: {
      idempotencyKey: string;
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
    if (input.couponCode?.trim()) {
      assertCouponLaunchEnabled();
    }
    const { customer, customerUserId } = await this.requireCustomerForBookingCreation(userId);
    assertBookingServiceId(input.serviceId);
    assertBookingPaymentMethod(input.paymentMethod);

    const service = await this.prisma.massageService.findFirstOrThrow({
      where: {
        id: input.serviceId,
        active: true,
        publicationStatus: ServicePublicationStatus.PUBLISHED,
      },
    });
    const { preferredProvider, providerService } = await this.resolvePreferredProviderForBooking({
      providerId: input.providerId,
      serviceId: service.id,
    });
    const { customerPrice, payoutRule, priceSummary } = await this.resolveBookingPricingForCreation({
      service,
      providerServicePrice: providerService?.price,
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
        customer: {
          name: customer.user.fullName!.trim(),
          phone: customer.user.phone.trim(),
        },
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
    const customerDistanceGateError = customerCurrentLocationBookingDistanceGateError(
      distanceGate.customerToBookingDistanceMeters,
      matchingPolicy,
    );
    if (customerDistanceGateError) {
      await this.rejectCustomerCurrentLocationTooFar({
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
        message: customerDistanceGateError.message,
        customerDistanceLimitMeters: customerDistanceGateError.limitMeters,
      });
    }
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

    const requiresPostBookingAuthorization = this.payments.requiresPostBookingAuthorization(
      input.paymentMethod,
    );
    const creation = await this.createOpenMatchingBookingRecord({
      customerProfileId: customer.id,
      idempotencyKey: input.idempotencyKey,
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
      adminMinimumAmount: service.basePrice,
      customerPrice,
      payoutRule,
      paymentMethod: input.paymentMethod,
      priceSummary,
      preferredProviderDistanceMeters: distanceGate.preferredProviderDistanceMeters,
      requiresPostBookingAuthorization,
      couponCode: input.couponCode === undefined ? null : normalizeBookingCouponCode(input.couponCode),
    });
    let booking: OpenBookingForClientResponse = creation.booking;

    if (creation.replayed) {
      booking = await this.resumeUnstartedBookingPaymentAuthorization(
        booking,
        requiresPostBookingAuthorization,
      );
      if (booking.status === BookingStatus.CREATED) {
        await this.scheduleBookingPaymentStatusCheck(booking);
        return clientBookingResponse(booking);
      }
      if (booking.status === BookingStatus.OPEN_MATCHING) {
        const eligibleBackupProviders = await this.findInitialEligibleBackupProviders({
          booking,
          serviceId: service.id,
          preferredProviderId: preferredProvider?.id,
          matchingPolicy,
        });
        return this.activateOpenMatchingBooking({
          booking,
          matchingPolicy,
          eligibleBackupProviderCount: eligibleBackupProviders.length,
          timeoutAt: booking.expiresAt ?? timing.expiresAt,
          tolerateInfrastructureFailure: true,
        });
      }
      return clientBookingResponse(booking);
    }

    booking = await this.refreshBookingPaymentAuthorization(booking);
    booking = await this.openBookingAfterPaymentAuthorization(booking, requiresPostBookingAuthorization);

    if (booking.status === BookingStatus.CREATED) {
      await this.scheduleBookingPaymentStatusCheck(booking);
      return clientBookingResponse(booking);
    }
    if (booking.status !== BookingStatus.OPEN_MATCHING) {
      return clientBookingResponse(booking);
    }

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
      tolerateInfrastructureFailure: true,
    });
    const paymentMetadata = jsonObject(booking.payment?.rawMeta);
    await this.announceInitialOpenMatchingBooking({
      userId: customerUserId,
      bookingId: booking.id,
      preferredProvider,
      couponCode: stringOrUndefined(paymentMetadata.couponCode),
      customerDiscountAmount: nonNegativeNumber(paymentMetadata.discountAmount),
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

    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: { select: { fullName: true, phone: true } } },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }
    if (!customer.user.fullName?.trim()) {
      throw new BadRequestException('Customer name is required before booking');
    }
    if (!customer.user.phone.trim()) {
      throw new BadRequestException('Customer phone is required before booking');
    }
    return { customer, customerUserId: userId };
  }

  private async resolvePreferredProviderForBooking(input: { providerId?: string; serviceId: string }) {
    const preferredProvider = input.providerId
      ? await this.prisma.providerProfile.findUniqueOrThrow({
          where: { id: input.providerId },
          include: preferredProviderBookingReadinessInclude,
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
  }) {
    const customerPrice = resolveCustomerPrice(input.service, input.providerServicePrice);
    const payoutRule = await this.requireServicePayoutRule(input.service.id, customerPrice);
    return {
      customerPrice,
      payoutRule,
      priceSummary: resolveBookingPriceSummary({
        customerPrice,
        adminMinimumAmount: input.service.basePrice,
        coupon: null,
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

  private async rejectCustomerCurrentLocationTooFar(input: {
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
    customerDistanceLimitMeters: number;
  }): Promise<never> {
    await this.recordBookingGateRejection({
      actorId: input.actorId,
      customerProfileId: input.customerProfileId,
      serviceId: input.serviceId,
      preferredProviderId: input.preferredProviderId,
      reasonCode: 'CUSTOMER_CURRENT_LOCATION_TOO_FAR',
      reason: input.message,
      bookingLat: input.bookingLat,
      bookingLng: input.bookingLng,
      addressText: input.addressText,
      customerDistanceMeters: input.customerDistanceMeters,
      preferredProviderDistanceMeters: input.preferredProviderDistanceMeters,
      customerDistanceLimitMeters: input.customerDistanceLimitMeters,
      preferredProviderDistanceLimitMeters: input.distanceGateLimits.preferredProviderDistanceLimitMeters,
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
    customer: { name: string; phone: string };
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
      addressPayload: normalizeBookingAddress(input.address, addressText, input.customer),
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
      customerGender: input.booking.customerProfile?.gender,
      customerNationality: input.booking.customerProfile?.nationality,
    });
  }

  private async activateOpenMatchingBooking(input: {
    booking: OpenBookingForClientResponse;
    matchingPolicy: MatchingPolicy;
    eligibleBackupProviderCount: number;
    timeoutAt: Date;
    tolerateInfrastructureFailure?: boolean;
  }) {
    const result = this.matching.openBooking({
      booking: clientBookingResponse(input.booking),
      policy: input.matchingPolicy,
      payload: bookingOpenMatchingPayload(input.matchingPolicy, input.eligibleBackupProviderCount),
    });
    await this.runPostCommitBookingEffects(input.booking.id, [
      {
        label: 'payment-status-check-schedule',
        run: () => this.scheduleBookingPaymentStatusCheck(input.booking),
      },
    ]);
    if (input.tolerateInfrastructureFailure) {
      await this.runPostCommitBookingEffects(input.booking.id, [
        {
          label: 'matching-active-booking-register',
          run: () => this.matching.registerActiveBooking(input.booking.id, result),
        },
        {
          label: 'matching-timeout-schedule',
          run: () => this.matching.scheduleBookingTimeout(input.booking.id, input.timeoutAt),
        },
      ]);
      return result;
    }
    await this.matching.registerActiveBooking(input.booking.id, result);
    await this.matching.scheduleBookingTimeout(input.booking.id, input.timeoutAt);
    return result;
  }

  private async announceInitialOpenMatchingBooking(input: {
    userId: string;
    bookingId: string;
    preferredProvider?: { id: string; userId: string; displayName: string } | null;
    couponCode?: string;
    customerDiscountAmount: number;
    matchingPayload: ReturnType<MatchingService['openBooking']>;
    matchingPolicy: MatchingPolicy;
    eligibleBackupProviders: BackupProviderNotificationInput['providers'];
  }) {
    await this.runPostCommitBookingEffects(input.bookingId, [
      {
        label: 'customer-opened-notification',
        run: () =>
          this.notifyCustomerBookingOpened({
            userId: input.userId,
            bookingId: input.bookingId,
            preferredProvider: input.preferredProvider,
            couponCode: input.couponCode,
            discountAmount: input.customerDiscountAmount,
          }),
      },
      ...(input.preferredProvider?.userId
        ? [
            {
              label: 'preferred-partner-notification',
              run: () =>
                this.notifyPreferredProviderRequested(input.preferredProvider!.userId, input.bookingId),
            },
            {
              label: 'preferred-partner-realtime',
              run: () =>
                this.matchingGateway.emitDirectBookingRequested(
                  input.preferredProvider!.userId,
                  input.bookingId,
                  input.matchingPayload,
                ),
            },
          ]
        : [
            {
              label: 'marketplace-opened-realtime',
              run: () => this.matchingGateway.emitBookingOpened(input.bookingId, input.matchingPayload),
            },
          ]),
      {
        label: 'backup-provider-notifications',
        run: () =>
          this.notifyBackupProvidersAndRecordTrace({
            stage: 'initial_open',
            bookingId: input.bookingId,
            providers: input.eligibleBackupProviders,
            backupProviderRadiusMeters: input.matchingPolicy.backupProviderRadiusMeters,
            backupOpenMode: input.matchingPolicy.backupOpenMode,
            backupProviderInvitationLimit: input.matchingPolicy.backupProviderInvitationLimit,
            matchingPayload: input.matchingPayload,
          }),
      },
    ]);
  }

  private async createOpenMatchingBookingRecord(input: {
    customerProfileId: string;
    idempotencyKey: string;
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
    adminMinimumAmount: number;
    customerPrice: number;
    payoutRule: {
      id: string;
      customerPrice: number;
      providerPayoutAmount: number;
      vatBps: number;
      otherCostAmount: number;
      currency: string;
    };
    paymentMethod: PaymentMethod;
    priceSummary: ReturnType<typeof resolveBookingPriceSummary>;
    preferredProviderDistanceMeters: number | null;
    requiresPostBookingAuthorization: boolean;
    couponCode?: string | null;
  }) {
    const fingerprint = bookingCreationFingerprint({
      address: input.addressPayload,
      couponCode: input.couponCode,
      lat: input.bookingLat,
      lng: input.bookingLng,
      notes: input.notes,
      paymentMethod: input.paymentMethod,
      preferredProviderId: input.preferredProvider?.id,
      serviceId: input.serviceId,
    });
    const bookingCreateArgs = (priceSummary: ReturnType<typeof resolveBookingPriceSummary>) =>
      ({
      data: {
        customerProfileId: input.customerProfileId,
          status: input.requiresPostBookingAuthorization
            ? BookingStatus.CREATED
            : BookingStatus.OPEN_MATCHING,
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
          bookingCreationRequest: bookingCreationRequestMetadata(input.idempotencyKey, fingerprint),
        }),
        services: bookingServiceLineCreate({
          serviceId: input.serviceId,
          price: input.customerPrice,
          payoutRule: input.payoutRule,
        }),
        payment: bookingPaymentCreate(
          this.payments.buildAuthorization(
            input.paymentMethod,
              priceSummary.finalAmount,
            'pending-booking',
              priceSummary.paymentMetadata,
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
      include: openBookingForClientInclude,
      }) satisfies Prisma.BookingCreateArgs;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${bookingCreationLockKey(
          input.customerProfileId,
          input.idempotencyKey,
        )}, 0))::text AS "lockResult"`,
      );
      const existing = await tx.booking.findFirst({
        where: {
          customerProfileId: input.customerProfileId,
          metadata: {
            path: ['bookingCreationRequest', 'idempotencyKey'],
            equals: input.idempotencyKey,
          },
        },
        include: openBookingForClientInclude,
      });
      if (existing) {
        const request = bookingCreationRequestFromMetadata(existing.metadata);
        if (request?.fingerprint !== fingerprint) {
          throw new ConflictException('Booking idempotency key was reused with a different request');
        }
        return { booking: existing, replayed: true as const };
      }

      const couponReservation =
        input.couponCode === null || input.couponCode === undefined
          ? null
          : await prepareCouponRedemptionReservation(tx, {
              adminMinimumAmount: input.adminMinimumAmount,
              couponCode: input.couponCode,
              customerPrice: input.customerPrice,
              customerProfileId: input.customerProfileId,
            });
      const priceSummary = couponReservation?.priceSummary ?? input.priceSummary;
      const createBooking = async () => {
        const booking = await tx.booking.create(bookingCreateArgs(priceSummary));
        if (couponReservation) {
          await tx.couponRedemption.create({
            data: {
              bookingId: booking.id,
              couponId: couponReservation.couponId,
              currency: 'VND',
              customerProfileId: input.customerProfileId,
              discountAmount: couponReservation.discountAmount,
            },
          });
        }
        return booking;
      };

      if (input.paymentMethod !== PaymentMethod.CUSTOMER_WALLET) {
        return { booking: await createBooking(), replayed: false as const };
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${customerWalletBookingLockKey(
          input.customerProfileId,
        )}, 0))::text AS "lockResult"`,
      );
      const wallet = await tx.customerWalletLedgerEntry.aggregate({
        where: { customerProfileId: input.customerProfileId, currency: 'VND' },
        _sum: { amount: true },
      });
      const balance = wallet._sum.amount ?? 0;
      if (balance < priceSummary.finalAmount) {
        throw new BadRequestException('Insufficient customer wallet balance');
      }

      const booking = await createBooking();
      if (!booking.payment?.id) {
        throw new BadRequestException('Customer wallet payment was not created');
      }
      await tx.customerWalletLedgerEntry.create({
        data: {
          amount: -priceSummary.finalAmount,
          bookingId: booking.id,
          currency: 'VND',
          customerProfileId: input.customerProfileId,
          metadata: {
            bookingId: booking.id,
            customerPaymentAmount: priceSummary.finalAmount,
            paymentId: booking.payment.id,
            paymentMethod: PaymentMethod.CUSTOMER_WALLET,
            reservationState: 'HELD',
          },
          notes: 'Customer wallet amount reserved for booking payment.',
          reference: booking.payment.id,
          sourceKey: customerWalletPaymentSourceKey(booking.id),
          type: CustomerWalletLedgerType.CUSTOMER_WALLET_PAYMENT,
        },
      });
      return { booking, replayed: false as const };
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

  private async resumeUnstartedBookingPaymentAuthorization(
    booking: OpenBookingForClientResponse,
    requiresPostBookingAuthorization: boolean,
  ) {
    if (booking.status !== BookingStatus.CREATED || !booking.payment) {
      return booking;
    }
    if (booking.payment.status === PaymentStatus.FAILED) {
      return this.finalizeFailedBookingPaymentAuthorization(booking.id, booking.payment.id);
    }
    if (jsonObject(booking.payment.rawMeta).authorizationState !== 'PENDING') return booking;

    const authorized = await this.refreshBookingPaymentAuthorization(booking);
    return this.openBookingAfterPaymentAuthorization(authorized, requiresPostBookingAuthorization);
  }

  async recoverCreatedBookingAfterPayment(bookingId: string, paymentId: string) {
    let booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: paymentRecoveryBookingInclude,
    });
    if (!booking || booking.payment?.id !== paymentId) {
      return { skipped: true, reason: 'BOOKING_PAYMENT_NOT_FOUND' };
    }
    if (booking.status === BookingStatus.OPEN_MATCHING) {
      return { skipped: true, reason: 'ALREADY_OPEN', bookingId };
    }
    if (booking.status !== BookingStatus.CREATED) {
      return { skipped: true, reason: 'BOOKING_NOT_CREATED', bookingId, status: booking.status };
    }
    if (!this.payments.requiresPostBookingAuthorization(booking.payment.method)) {
      return { skipped: true, reason: 'NOT_GATEWAY_PAYMENT', bookingId };
    }
    if (booking.payment.status === PaymentStatus.FAILED) {
      await this.finalizeFailedBookingPaymentAuthorization(booking.id, booking.payment.id);
      return { closed: true, reason: 'PAYMENT_AUTHORIZATION_FAILED', bookingId };
    }

    let paymentMetadata = jsonObject(booking.payment.rawMeta);
    if (paymentMetadata.authorizationState === 'PENDING') {
      await this.payments.refreshAuthorizationForBooking(booking.payment.id, booking.id);
      booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: paymentRecoveryBookingInclude,
      });
      if (!booking || booking.payment?.id !== paymentId) {
        return { skipped: true, reason: 'BOOKING_PAYMENT_NOT_FOUND' };
      }
      if (booking.status !== BookingStatus.CREATED) {
        return { skipped: true, reason: 'BOOKING_NOT_CREATED', bookingId, status: booking.status };
      }
      paymentMetadata = jsonObject(booking.payment.rawMeta);
      if (booking.payment.status === PaymentStatus.FAILED) {
        await this.finalizeFailedBookingPaymentAuthorization(booking.id, booking.payment.id);
        return { closed: true, reason: 'PAYMENT_AUTHORIZATION_FAILED', bookingId };
      }
    }
    if (
      paymentMetadata.authorizationState !== 'READY' ||
      !this.payments.paymentCanOpenMatching(booking.payment.method, booking.payment.status)
    ) {
      return { skipped: true, reason: 'PAYMENT_NOT_READY', bookingId };
    }
    const serviceId = booking.services[0]?.serviceId;
    if (!serviceId) {
      return { skipped: true, reason: 'BOOKING_SERVICE_NOT_FOUND', bookingId };
    }
    const matchingPolicy = this.bookingPolicy(booking, await this.matching.getPolicy());
    const refreshMatchingWindow = this.payments.paymentRequiresCaptureBeforeMatching(booking.payment.method);
    if (!refreshMatchingWindow && (!booking.expiresAt || booking.expiresAt.getTime() <= Date.now())) {
      return { skipped: true, reason: 'MATCHING_WINDOW_EXPIRED', bookingId };
    }
    const recoveredOpenedAt = new Date();
    const recoveredExpiresAt = refreshMatchingWindow
      ? new Date(recoveredOpenedAt.getTime() + matchingPolicy.providerResponseWindowMinutes * 60_000)
      : (booking.expiresAt ?? recoveredOpenedAt);
    const eligibleBackupProviders = await this.findInitialEligibleBackupProviders({
      booking,
      serviceId,
      preferredProviderId: booking.preferredProvider?.id,
      matchingPolicy,
    });
    const opened = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: BookingStatus.CREATED },
      data: {
        status: BookingStatus.OPEN_MATCHING,
        ...(refreshMatchingWindow ? { openedAt: recoveredOpenedAt, expiresAt: recoveredExpiresAt } : {}),
      },
    });
    if (opened.count !== 1) {
      return { skipped: true, reason: 'CONCURRENT_RECOVERY', bookingId };
    }

    const recoveredBooking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: paymentRecoveryBookingInclude,
    });
    let matchingPayload: ReturnType<MatchingService['openBooking']>;
    try {
      matchingPayload = await this.activateOpenMatchingBooking({
        booking: recoveredBooking,
        matchingPolicy,
        eligibleBackupProviderCount: eligibleBackupProviders.length,
        timeoutAt: recoveredBooking.expiresAt ?? recoveredExpiresAt,
      });
    } catch (error) {
      await this.matching.closeBooking(booking.id).catch(() => undefined);
      await this.prisma.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.OPEN_MATCHING },
        data: { status: BookingStatus.CREATED },
      });
      throw error;
    }

    const currentBooking = await this.prisma.booking.findUnique({
      where: { id: booking.id },
      select: { selectedProviderId: true, status: true },
    });
    if (
      !currentBooking ||
      currentBooking.status !== BookingStatus.OPEN_MATCHING ||
      currentBooking.selectedProviderId
    ) {
      await this.runPostCommitBookingEffects(booking.id, [
        { label: 'stale-recovery-matching-close', run: () => this.matching.closeBooking(booking.id) },
      ]);
      return {
        skipped: true,
        reason: 'BOOKING_NO_LONGER_OPEN',
        bookingId,
        status: currentBooking?.status ?? null,
      };
    }

    await this.announceInitialOpenMatchingBooking({
      userId: recoveredBooking.customerProfile.userId,
      bookingId: recoveredBooking.id,
      preferredProvider: recoveredBooking.preferredProvider,
      couponCode: stringOrUndefined(paymentMetadata.couponCode),
      customerDiscountAmount: nonNegativeNumber(paymentMetadata.discountAmount),
      matchingPayload,
      matchingPolicy,
      eligibleBackupProviders,
    });
    return { recovered: true, bookingId, status: BookingStatus.OPEN_MATCHING };
  }

  private async openBookingAfterPaymentAuthorization(
    booking: OpenBookingForClientResponse,
    requiresPostBookingAuthorization: boolean,
  ) {
    if (!requiresPostBookingAuthorization) {
      return booking;
    }
    if (booking.payment?.status === PaymentStatus.FAILED) {
      return this.finalizeFailedBookingPaymentAuthorization(booking.id, booking.payment.id);
    }
    if (
      booking.payment &&
      !this.payments.paymentCanOpenMatching(booking.payment.method, booking.payment.status)
    ) {
      return booking;
    }

    const result = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: BookingStatus.CREATED },
      data: { status: BookingStatus.OPEN_MATCHING },
    });
    if (result.count !== 1) {
      throw new BadRequestException('Booking payment authorization could not open matching');
    }
    return this.prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: openBookingForClientInclude,
    });
  }

  private async finalizeFailedBookingPaymentAuthorization(bookingId: string, paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockBookingLifecycle(tx, bookingId);
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: openBookingForClientInclude,
      });
      if (booking.payment?.id !== paymentId || booking.payment.status !== PaymentStatus.FAILED) {
        throw new ConflictException('Booking payment authorization state changed; reload and try again');
    }

      const alreadyClosed =
        booking.status === BookingStatus.CANCELLED && booking.closedReason === 'payment_authorization_failed';
      if (!alreadyClosed && booking.status !== BookingStatus.CREATED) {
        throw this.bookingStateChangedError();
  }

      const closedAt = booking.closedAt ?? new Date();
      if (!alreadyClosed) {
        const transition = await tx.booking.updateMany({
          where: { id: bookingId, status: BookingStatus.CREATED },
          data: {
            status: BookingStatus.CANCELLED,
            closedAt,
            closedReason: 'payment_authorization_failed',
            closedNote: 'Payment authorization failed before matching opened.',
          },
    });
        if (transition.count !== 1) throw this.bookingStateChangedError();
    }

      await releaseCouponRedemptionForBooking(tx, {
        bookingId,
        occurredAt: closedAt,
        reason: COUPON_RELEASE_REASON.PAYMENT_AUTHORIZATION_FAILED,
      });
      await tx.adminAuditLog.upsert({
        where: { eventId: `booking-payment-authorization-failed:${bookingId}` },
        update: {},
        create: {
          eventId: `booking-payment-authorization-failed:${bookingId}`,
          actorId: null,
          actorKey: 'booking-payment-recovery-worker',
          actorLabelSnapshot: 'HANDS booking payment recovery worker',
          actorType: 'SYSTEM',
          action: 'booking.payment_authorization.failed',
          area: 'BOOKING',
          objectId: bookingId,
          objectType: 'Booking',
          outcome: 'SUCCEEDED',
          source: 'booking_payment_recovery',
          target: `booking:${bookingId}`,
          metadata: { bookingId, paymentId },
        },
      });
      return tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: openBookingForClientInclude,
      });
    });
    }

  private async scheduleBookingPaymentStatusCheck(booking: OpenBookingForClientResponse) {
    if (booking.payment?.id) {
      await this.payments.scheduleStatusCheck(booking.payment.id);
    }
  }

  private async requireServicePayoutRule(serviceId: string, customerPrice: number) {
    const payoutRule = await this.prisma.servicePayoutRule.findFirst({
      where: {
        serviceId,
        customerPrice,
        active: true,
      },
      select: {
        id: true,
        customerPrice: true,
        providerPayoutAmount: true,
        vatBps: true,
        otherCostAmount: true,
        currency: true,
      },
    });

    if (!payoutRule) {
      throw new BadRequestException('Admin payout rule is required before this service price can be booked');
    }
    return payoutRule;
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

  async listCustomerBookings(customerUserId: string, options: OpenBookingListOptions = {}) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    const cursor = normalizePaginationCursor(options.cursor);
    const bookings = await this.prisma.booking.findMany({
      where: { customerProfileId: customer.id },
      include: clientBookingListInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: normalizeBoundedTake(options.take, 20, 50),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return clientBookingResponses(bookings);
  }

  async cancelCustomerBooking(bookingId: string, customerUserId: string) {
    const cancellableBooking = await this.requireCustomerCancellableBooking(bookingId, customerUserId);
    const cancellation = isCustomerPaymentClosureRetry(cancellableBooking)
      ? {
          ...(await this.bookingCancellationResultWithPaymentRelease(
            cancellableBooking,
            'Customer cancelled after gateway payment capture',
            customerUserId,
          )),
          providerUserIds: bookingCancellationProviderUserIds(cancellableBooking),
        }
      : await this.closeCustomerBookingWithPaymentRelease(
          bookingId,
          customerUserId,
          cancellableBooking.expiresAt,
        );

    const clientResult = clientBookingResponse(cancellation.result);
    await this.runPostCommitBookingEffects(bookingId, [
      { label: 'matching-close', run: () => this.matching.closeBooking(bookingId) },
      {
        label: 'cancellation-notifications',
        run: () =>
          this.notifyBookingCancelled({
            bookingId,
            customerUserId,
            providerUserIds: cancellation.providerUserIds,
            releasedPayment: cancellation.releasedPayment,
            refundRequested: cancellation.refundRequested,
          }),
      },
      {
        label: 'cancellation-realtime',
        run: () => this.matchingGateway.emitBookingExpired(bookingId, clientResult),
      },
    ]);
    return clientResult;
  }

  private async closeCustomerBookingWithPaymentRelease(
    bookingId: string,
    customerUserId: string,
    originalExpiresAt?: Date | null,
  ) {
    let updated: Prisma.BookingGetPayload<{ include: typeof clientBookingListInclude }>;
    try {
      updated = await this.prisma.$transaction(async (transaction) => {
        const closedAt = new Date();
        const booking = await transaction.booking.update({
          where: {
            id: bookingId,
            selectedProviderId: null,
            OR: [
              { status: BookingStatus.CREATED },
              {
                status: BookingStatus.OPEN_MATCHING,
                expiresAt: { gt: new Date() },
              },
            ],
          },
          data: {
            ...customerCancellationCloseData(closedAt),
            opsTasks: {
              upsert: {
                where: {
                  bookingId_type: { bookingId, type: BookingOpsTaskType.PAYMENT_REVIEWED },
                },
                update: {
                  status: BookingOpsTaskStatus.PENDING,
                  note: 'Payment closure pending after customer cancellation.',
                  actorId: customerUserId,
                },
                create: {
                  type: BookingOpsTaskType.PAYMENT_REVIEWED,
                  status: BookingOpsTaskStatus.PENDING,
                  note: 'Payment closure pending after customer cancellation.',
                  actorId: customerUserId,
                },
              },
            },
          },
          include: clientBookingListInclude,
        });
        await releaseCouponRedemptionForBooking(transaction, {
          bookingId,
          occurredAt: closedAt,
          reason: COUPON_RELEASE_REASON.CUSTOMER_CANCELLED,
        });
        await transaction.adminAuditLog.create({
          data: {
            actorId: customerUserId,
            action: 'booking.cancelled.customer_pre_match',
            target: `booking:${bookingId}`,
            metadata: {
              bookingId,
              remainingSeconds: originalExpiresAt
                ? Math.max(0, Math.ceil((originalExpiresAt.getTime() - Date.now()) / 1000))
                : null,
            },
          },
        });
        return booking;
      });
    } catch (error) {
      return this.throwStaleBookingMatchRequest(
        error,
        bookingId,
        'Booking is already matched or no longer open for customer cancellation',
      );
    }
    await this.reconcileProviderAvailability(updated.selectedProviderId);
    return {
      ...(await this.bookingCancellationResultWithPaymentRelease(
        updated,
        'Customer cancelled after gateway payment capture',
        customerUserId,
      )),
      providerUserIds: bookingCancellationProviderUserIds(updated),
    };
  }

  private async requireCustomerCancellableBooking(bookingId: string, customerUserId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    const booking = await this.prisma.booking.findFirstOrThrow({
      where: { id: bookingId, customerProfileId: customer.id },
      include: customerCancellableBookingInclude,
    });

    if (isCustomerPaymentClosureRetry(booking)) {
      return booking;
    }

    if (bookingHasPartnerCommitment(booking)) {
      throw new ConflictException({
        message:
          'Matched bookings cannot be cancelled directly. Use booking chat so HANDS operations can review the evidence.',
        booking: clientBookingResponse(booking),
      });
    }
    assertCustomerDirectCancellationAllowed(booking);
    return booking;
  }

  private async bookingCancellationResultWithPaymentRelease<
    TBooking extends { id: string; payment?: { id: string } | null },
  >(booking: TBooking, reason: string, actorId: string) {
    const closure = booking.payment
      ? await this.payments.closeUnmatchedBookingPayment(booking.payment.id, reason)
      : null;
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        opsTasks: {
          upsert: {
            where: {
              bookingId_type: { bookingId: booking.id, type: BookingOpsTaskType.PAYMENT_REVIEWED },
            },
            update: {
              status: closure?.refundRequested ? BookingOpsTaskStatus.PENDING : BookingOpsTaskStatus.DONE,
              note: closure?.refundRequested
                ? 'Captured payment refund is pending finance review.'
                : 'Payment closure completed after booking cancellation.',
              actorId,
            },
            create: {
              type: BookingOpsTaskType.PAYMENT_REVIEWED,
              status: closure?.refundRequested ? BookingOpsTaskStatus.PENDING : BookingOpsTaskStatus.DONE,
              note: closure?.refundRequested
                ? 'Captured payment refund is pending finance review.'
                : 'Payment closure completed after booking cancellation.',
              actorId,
            },
          },
        },
      },
    });
    return {
      result: bookingCancellationResultWithReleasedPayment(booking, closure?.payment),
      releasedPayment: closure?.released ?? false,
      refundRequested: closure?.refundRequested ?? false,
    };
  }

  private async readOperationalPolicyValue(key: string, fallback: string) {
    const setting = await this.prisma.operationalPolicySetting.findUnique({
      where: { key },
      select: { value: true },
    });
    return typeof setting?.value === 'string' ? setting.value : fallback;
  }

  async getOpenBookings(providerUserId?: string, options: OpenBookingListOptions = {}) {
    const provider = providerUserId ? await this.requireProvider(providerUserId) : null;
    if (provider) {
      assertProviderCanViewOpenBookingMarketplace(provider);
    }
    if (provider && providerHasActiveSelectedBooking(provider)) {
      return [];
    }

    const cursor = normalizePaginationCursor(options.cursor);
    const bookings = await this.prisma.booking.findMany({
      where: openBookingWhereForProvider(provider?.id),
      include: clientBookingListInclude,
      orderBy: { createdAt: 'desc' },
      take: normalizeBoundedTake(
        options.take,
        DEFAULT_PARTNER_OPEN_BOOKINGS_LIMIT,
        MAX_PARTNER_OPEN_BOOKINGS_LIMIT,
      ),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (!provider) {
      return clientBookingResponses(bookings);
    }

    const fallbackPolicy = await this.matching.getPolicy();
    const visibleBookings = bookings
      .map((booking) => addProviderMatchingDistance(booking, provider))
      .filter((booking) =>
        this.canProviderSeeOpenBooking(booking, provider.id, this.bookingPolicy(booking, fallbackPolicy)),
      );
    await this.recordProviderOpenRequestListView(
      provider.id,
      visibleBookings.map((booking) => booking.id),
    );
    return partnerOpenBookingResponses(visibleBookings, provider.id);
  }

  async getProviderBookingAlertPreferences(providerUserId: string) {
    const provider = await this.requireProviderAccount(providerUserId);
    return normalizeProviderBookingAlertPreferences(provider.bookingAlertPreferences);
  }

  async updateProviderBookingAlertPreferences(
    providerUserId: string,
    input: {
      enabled: boolean;
      maxDistanceKm?: number | null;
      customerGender?: string | null;
      customerNationality?: string | null;
      serviceIds: string[];
    },
  ) {
    const provider = await this.requireProviderAccount(providerUserId);
    const preferences = normalizeProviderBookingAlertPreferences(input);
    await this.prisma.providerProfile.update({
      where: { id: provider.id },
      data: { bookingAlertPreferences: preferences },
    });
    return preferences;
  }

  async getProviderBooking(bookingId: string, providerUserId: string) {
    const provider = await this.requireProvider(providerUserId);
    const { booking, isOpenRequest } = await this.requireProviderAccessibleBookingDetail(bookingId, provider);
    if (isOpenRequest) {
      await this.recordProviderOpenRequestDetailView(provider.id, booking.id);
    }

    return partnerBookingResponse(booking, provider.id);
  }

  async recordProviderBookingDetailView(
    bookingId: string,
    providerUserId: string,
    input: ProviderBookingDetailViewTelemetryInput,
  ) {
    const provider = await this.requireProvider(providerUserId);
    const { booking } = await this.requireProviderAccessibleBookingDetail(bookingId, provider);
    const eventType = providerBookingDetailViewTelemetryEvent(input.eventType);
    const durationSeconds = normalizeProviderBookingDetailViewDurationSeconds(input.durationSeconds);
    const metadata: Prisma.InputJsonObject =
      durationSeconds === null
        ? { statusAtEvent: booking.status }
        : { durationSeconds, statusAtEvent: booking.status };

    await this.prisma.providerBookingRequestEvent.create({
      data: {
        bookingId: booking.id,
        eventType,
        metadata,
        providerProfileId: provider.id,
      },
    });

    return {
      durationSeconds,
      eventType,
      recorded: true,
    };
  }

  private async recordProviderOpenRequestListView(providerProfileId: string, bookingIds: string[]) {
    if (bookingIds.length === 0) {
      return;
    }

    await this.prisma.providerBookingRequestEvent.create({
      data: {
        eventType: PROVIDER_OPEN_REQUEST_LIST_VIEWED_EVENT,
        providerProfileId,
        visibleBookingCount: bookingIds.length,
        metadata: {
          bookingIds: bookingIds.slice(0, MAX_PARTNER_OPEN_BOOKINGS_LIMIT),
        },
      },
    });
  }

  private async recordProviderOpenRequestDetailView(providerProfileId: string, bookingId: string) {
    await this.prisma.providerBookingRequestEvent.create({
      data: {
        bookingId,
        eventType: PROVIDER_OPEN_REQUEST_DETAIL_VIEWED_EVENT,
        providerProfileId,
      },
    });
  }

  private async requireProviderAccessibleBookingDetail(
    bookingId: string,
    provider: {
      currentLat: unknown;
      currentLng: unknown;
      currentLocationUpdatedAt?: Date | string | null;
      id: string;
    } & ProviderBookingReadiness,
  ) {
    const booking = await this.prisma.booking.findFirstOrThrow({
      where: {
        id: bookingId,
        OR: [openBookingWhereForProvider(provider.id), providerBookingHistoryWhere(provider.id)],
      },
      include: providerBookingHistoryInclude,
    });

    if (booking.status !== BookingStatus.OPEN_MATCHING) {
      return { booking, isOpenRequest: false };
    }

    assertProviderCanViewOpenBookingMarketplace(provider);
    const policy = this.bookingPolicy(booking, await this.matching.getPolicy());
    const visibleBooking = addProviderMatchingDistance(booking, provider);
    if (!this.canProviderSeeOpenBooking(visibleBooking, provider.id, policy)) {
      throw new NotFoundException('Booking not found');
    }

    return { booking: visibleBooking, isOpenRequest: true };
  }

  async listProviderBookings(providerUserId: string, options: ProviderBookingListOptions = {}) {
    const provider = await this.requireProvider(providerUserId);
    if (options.scope?.trim().toLowerCase() === 'history') {
      const cursor = normalizePaginationCursor(options.cursor);
      const history = await this.prisma.booking.findMany({
        where: {
          AND: [
            providerBookingHistoryWhere(provider.id),
            { status: { in: [...PROVIDER_BOOKING_HISTORY_STATUS_VALUES] } },
          ],
        },
        include: providerBookingHistoryInclude,
        orderBy: { createdAt: 'desc' },
        take: normalizeBoundedTake(
          options.take,
          DEFAULT_PARTNER_BOOKING_HISTORY_LIMIT,
          MAX_PARTNER_BOOKING_HISTORY_LIMIT,
        ),
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      return partnerBookingResponses(history, provider.id);
    }

    const activeBookings = await this.prisma.booking.findMany({
      where: {
        selectedProviderId: provider.id,
        status: { in: [...PROVIDER_ACTIVE_WORK_STATUS_VALUES] },
      },
      include: providerBookingHistoryInclude,
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const remainingLimit = Math.max(0, 20 - activeBookings.length);
    const recentBookings =
      remainingLimit === 0
        ? []
        : await this.prisma.booking.findMany({
            where: {
              AND: [
                providerBookingHistoryWhere(provider.id),
                { status: { notIn: [...PROVIDER_ACTIVE_WORK_STATUS_VALUES] } },
                ...(activeBookings.length > 0
                  ? [{ id: { notIn: activeBookings.map((booking) => booking.id) } }]
                  : []),
              ],
            },
            include: providerBookingHistoryInclude,
            orderBy: { createdAt: 'desc' },
            take: remainingLimit,
          });
    const bookings = [...activeBookings, ...recentBookings];
    return partnerBookingResponses(bookings, provider.id);
  }

  async joinBooking(bookingId: string, providerUserId: string | undefined) {
    const provider = await this.requireProvider(providerUserId);
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: joinableBookingForPartnerInclude,
    });
    this.assertBookingOpenForPartnerResponse(booking);
    assertProviderCanReceiveBooking(provider);
    await this.assertProviderOffersBookingServices(
      this.prisma,
      provider.id,
      booking.services.map((service) => service.serviceId),
    );
    const matchingPolicy = this.bookingPolicy(booking, await this.matching.getPolicy());
    const distanceMeters = this.requireProviderWithinMatchingRadius(booking, provider, matchingPolicy);

    let participant;
    try {
      participant = await this.joinProviderBookingParticipant({
        bookingId,
        providerProfileId: provider.id,
        distanceMeters,
        providerStatusAtJoin: provider.status,
      });
    } catch (error) {
      return this.throwStaleBookingMatchRequest(
        error,
        bookingId,
        'Booking is already matched or no longer open for marketplace participation',
      );
    }

    const result = this.matching.joinBooking(bookingId, participant);
    await this.runPostCommitBookingEffects(bookingId, [
      {
        label: 'matching-participant-register',
        run: () => this.matching.registerParticipant(bookingId, provider.id, matchingPolicy),
      },
      {
        label: 'provider-joined-notification',
        run: async () => {
          const customerUserId = await this.getCustomerUserIdForBooking(bookingId);
          await this.notifyCustomerProviderJoined(customerUserId, bookingId, provider);
        },
      },
      {
        label: 'provider-joined-realtime',
        run: () => this.matchingGateway.emitProviderJoined(bookingId, result),
      },
    ]);
    return result;
  }

  private async joinProviderBookingParticipant(input: {
    bookingId: string;
    providerProfileId: string;
    providerStatusAtJoin: ProviderStatus;
    distanceMeters: number | null;
  }) {
    const upsert = bookingParticipantJoinUpsert(input);
    const booking = await this.prisma.booking.update({
      where: {
        id: input.bookingId,
        status: BookingStatus.OPEN_MATCHING,
        selectedProviderId: null,
        expiresAt: { gt: new Date() },
      },
      data: { participants: { upsert } },
      select: {
        participants: {
          where: { providerProfileId: input.providerProfileId },
          include: marketplaceParticipantResponseInclude,
          take: 1,
        },
      },
    });
    return booking.participants[0];
  }

  async selectProvider(bookingId: string, customerUserId: string, providerId: string) {
    const ownedBooking = await this.requireCustomerOpenMatchingBooking(bookingId, customerUserId);
    await this.assertCustomerCanSelectProvider({
      bookingId,
      providerId,
      preferredProviderId: ownedBooking.preferredProviderId,
    });
    const booking = await this.matchCustomerSelectedProvider({
      bookingId,
      customerUserId,
      providerId,
      preferredProviderId: ownedBooking.preferredProviderId,
    });

    const result = this.matching.selectFinalProvider(bookingId, clientBookingResponse(booking));
    await this.runPostCommitBookingEffects(bookingId, [
      { label: 'matching-close', run: () => this.matching.closeBooking(bookingId) },
      {
        label: 'matched-notifications',
        run: () =>
          this.notifyCustomerSelectedPartnerMatched({
            bookingId,
            customerUserId,
            selectedProviderUserId: booking.selectedProvider?.userId,
            chatRoomId: booking.chatRoom?.id,
          }),
      },
      { label: 'matched-realtime', run: () => this.matchingGateway.emitBookingMatched(bookingId, result) },
    ]);
    return result;
  }

  private async requireCustomerOpenMatchingBooking(bookingId: string, customerUserId: string) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customerUserId },
    });
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerProfileId: customer.id },
      include: clientBookingDetailInclude,
    });
    if (!booking) {
      throw new BadRequestException('Booking does not belong to this customer');
    }
    if (
      booking.status !== BookingStatus.OPEN_MATCHING ||
      booking.selectedProviderId ||
      (booking.expiresAt && booking.expiresAt.getTime() <= Date.now())
    ) {
      throw new ConflictException({
        message: 'Booking is already matched or no longer open for customer final selection',
        booking: clientBookingResponse(booking),
      });
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
  }

  async updateParticipant(
    bookingId: string,
    providerUserId: string | undefined,
    status: ParticipantStatus,
    rejection?: { reasonCode?: PreferredProviderRejectionReasonCode; reasonDetail?: string },
  ) {
    const provider = await this.requireProvider(providerUserId);
    if (status === ParticipantStatus.ACCEPTED) {
      assertProviderCanReceiveBooking(provider);
    }
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: participantResponseBookingInclude,
    });
    if (
      status === ParticipantStatus.REJECTED &&
      isPreferredProviderPaymentClosureRetry(booking, provider.id)
    ) {
      const cancellation = await this.bookingCancellationResultWithPaymentRelease(
        booking,
        'Preferred partner rejected after gateway payment capture',
        provider.userId,
      );
      const clientResult = clientBookingResponse(cancellation.result);
      await this.runPostCommitBookingEffects(bookingId, [
        { label: 'matching-close', run: () => this.matching.closeBooking(bookingId) },
        {
          label: 'first-pick-rejected-notification',
          run: () =>
            this.notifyCustomerFirstPickRejected(booking.customerProfile.userId, bookingId, provider.id),
        },
        {
          label: 'cancellation-realtime',
          run: () => this.matchingGateway.emitBookingExpired(bookingId, clientResult),
        },
      ]);
      return clientResult;
    }
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

      const result = this.matching.selectFinalProvider(
        bookingId,
        clientBookingResponse(updated),
        MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST,
      );
      await this.runPostCommitBookingEffects(bookingId, [
        { label: 'matching-close', run: () => this.matching.closeBooking(bookingId) },
        {
          label: 'matched-notifications',
          run: () =>
            this.notifyFirstPickAcceptedMatched({
              bookingId,
              customerUserId: booking.customerProfile.userId,
              provider,
              selectedProviderUserId: updated.selectedProvider?.userId,
              chatRoomId: updated.chatRoom?.id,
            }),
        },
        { label: 'matched-realtime', run: () => this.matchingGateway.emitBookingMatched(bookingId, result) },
      ]);
      return result;
    }

    if (responseRoute === 'first-pick-rejected') {
      const rejectionReason = preferredProviderRejectionInput(rejection);
      const updated = await this.rejectFirstPickProvider({
        bookingId,
        providerId: provider.id,
        providerUserId: provider.userId,
        ...rejectionReason,
      });
      const cancellation = await this.bookingCancellationResultWithPaymentRelease(
        updated,
        'Preferred partner rejected after gateway payment capture',
        provider.userId,
      );
      const clientResult = clientBookingResponse(cancellation.result);
      await this.runPostCommitBookingEffects(bookingId, [
        { label: 'matching-close', run: () => this.matching.closeBooking(bookingId) },
        {
          label: 'first-pick-rejected-notification',
          run: () =>
            this.notifyCustomerFirstPickRejected(booking.customerProfile.userId, bookingId, provider.id),
        },
        {
          label: 'cancellation-realtime',
          run: () => this.matchingGateway.emitBookingExpired(bookingId, clientResult),
        },
      ]);
      return clientResult;
    }

    let updatedParticipant;
    try {
      const updatedBooking = await this.prisma.booking.update({
        where: {
          id: bookingId,
          status: BookingStatus.OPEN_MATCHING,
          selectedProviderId: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          participants: {
            update: {
              where: participantKey,
              data: { status, respondedAt: new Date() },
            },
          },
        },
        select: {
          participants: {
            where: { providerProfileId: provider.id },
            include: marketplaceParticipantResponseInclude,
            take: 1,
          },
        },
      });
      updatedParticipant = updatedBooking.participants[0];
    } catch (error) {
      return this.throwStaleBookingMatchRequest(
        error,
        bookingId,
        'Booking is already matched or no longer open for partner response',
      );
    }
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

  private async notifyPreferredProviderRequested(preferredProviderUserId: string, bookingId: string) {
    await this.notifications.create(
      preferredProviderRequestedNotification({
        userId: preferredProviderUserId,
        bookingId,
      }),
    );
  }

  private async notifyBookingCancelled(input: {
    bookingId: string;
    customerUserId: string;
    providerUserIds: Iterable<string>;
    releasedPayment: boolean;
    refundRequested?: boolean;
  }) {
    await createNotifications(this.notifications, [
      ...Array.from(input.providerUserIds, (providerUserId) =>
        providerBookingCancelledNotification(providerUserId, input.bookingId),
      ),
      customerBookingCancelledNotification({
          userId: input.customerUserId,
          bookingId: input.bookingId,
          releasedPayment: input.releasedPayment,
          refundRequested: input.refundRequested,
        }),
    ]);
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

  private async notifyCustomerSelectedPartnerMatched(input: {
    bookingId: string;
    customerUserId: string;
    selectedProviderUserId?: string;
    chatRoomId?: string;
  }) {
    await createNotifications(this.notifications, [
      ...(input.selectedProviderUserId
        ? [selectedPartnerMatchedProviderNotification(input.selectedProviderUserId, input.bookingId)]
        : []),
      selectedPartnerMatchedCustomerNotification({
          userId: input.customerUserId,
          bookingId: input.bookingId,
          chatRoomId: input.chatRoomId,
        }),
    ]);
  }

  private async matchCustomerSelectedProvider(input: {
    bookingId: string;
    customerUserId: string;
    providerId: string;
    preferredProviderId?: string | null;
  }): Promise<SelectedBookingForClientResponse> {
    try {
      const matchedBooking = await this.prisma.$transaction(async (transaction) => {
        await lockProviderBookingAssignment(transaction, input.providerId);
        await lockBookingLifecycle(transaction, input.bookingId);
        await lockProviderBookingReadiness(transaction, input.providerId);
        await this.assertProviderReadyForFinalAssignment(transaction, input.bookingId, input.providerId);
        await this.assertProviderHasNoOtherActiveBooking(transaction, input.bookingId, input.providerId);
        const participant = await transaction.bookingParticipant.findUnique({
          where: bookingParticipantCompoundKey(input.bookingId, input.providerId),
          select: { providerProfileId: true, status: true },
        });
        if (
          !participant ||
          !isCustomerSelectableParticipantForFinalChoice(participant, input.preferredProviderId)
        ) {
          throw new BadRequestException('Partner must participate or accept before customer selection');
        }
        await this.assertProviderWalletCanFinalizeBooking(transaction, input.providerId);
        const matchedBooking = await transaction.booking.update({
          where: {
            id: input.bookingId,
            status: BookingStatus.OPEN_MATCHING,
            selectedProviderId: null,
            expiresAt: { gt: new Date() },
          },
          data: bookingMatchedUpdateData({
            bookingId: input.bookingId,
            providerProfileId: input.providerId,
            matchSource: PrismaBookingMatchSource.CUSTOMER_SELECTED_PARTNER,
          }),
          include: selectedBookingForClientInclude,
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
      await this.markProviderBusy(input.providerId);
      return matchedBooking;
    } catch (error) {
      return this.throwStaleBookingMatchRequest(
        error,
        input.bookingId,
        'Booking is already matched or no longer open for customer final selection',
      );
    }
  }

  private async rejectFirstPickProvider(input: {
    bookingId: string;
    providerId: string;
    providerUserId: string;
    reasonCode: PreferredProviderRejectionReasonCode;
    reasonDetail: string;
  }): Promise<FirstPickRejectedBookingResponse> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const booking = await transaction.booking.update({
          where: {
            id: input.bookingId,
            status: BookingStatus.OPEN_MATCHING,
            selectedProviderId: null,
            preferredProviderId: input.providerId,
            expiresAt: { gt: new Date() },
          },
          data: {
            ...bookingFirstPickRejectedUpdateData({
              bookingId: input.bookingId,
              providerProfileId: input.providerId,
            }),
            opsTasks: {
              upsert: {
                where: {
                  bookingId_type: {
                    bookingId: input.bookingId,
                    type: BookingOpsTaskType.PAYMENT_REVIEWED,
                  },
                },
                update: {
                  status: BookingOpsTaskStatus.PENDING,
                  note: 'Payment closure pending after preferred partner rejection.',
                  actorId: input.providerUserId,
                },
                create: {
                  type: BookingOpsTaskType.PAYMENT_REVIEWED,
                  status: BookingOpsTaskStatus.PENDING,
                  note: 'Payment closure pending after preferred partner rejection.',
                  actorId: input.providerUserId,
                },
              },
            },
          },
          include: firstPickRejectedBookingInclude,
        });
        await releaseCouponRedemptionForBooking(transaction, {
          bookingId: input.bookingId,
          occurredAt: booking.closedAt ?? new Date(),
          reason: COUPON_RELEASE_REASON.PREFERRED_PARTNER_REJECTED,
        });
        await transaction.providerBookingRequestEvent.create({
          data: {
            bookingId: input.bookingId,
            providerProfileId: input.providerId,
            eventType: 'PREFERRED_PROVIDER_REJECTED',
            metadata: {
              reasonCode: input.reasonCode,
              reasonDetail: input.reasonDetail,
              statusAtEvent: BookingStatus.OPEN_MATCHING,
            },
          },
        });
        await transaction.adminAuditLog.create({
          data: {
            actorId: input.providerUserId,
            action: 'booking.closed.preferred_provider_rejected',
            target: `booking:${input.bookingId}`,
            metadata: {
              bookingId: input.bookingId,
              providerProfileId: input.providerId,
              reasonCode: input.reasonCode,
              reasonDetail: input.reasonDetail,
            },
          },
        });
        return booking;
      });
    } catch (error) {
      return this.throwStaleBookingMatchRequest(
        error,
        input.bookingId,
        'Booking is already matched or no longer open for preferred partner rejection',
      );
    }
  }

  private async matchFirstPickAcceptedProvider(input: {
    bookingId: string;
    providerId: string;
    providerUserId: string;
  }): Promise<MatchedBookingForClientResponse> {
    try {
      const matchedBooking = await this.prisma.$transaction(async (transaction) => {
        await lockProviderBookingAssignment(transaction, input.providerId);
        await lockBookingLifecycle(transaction, input.bookingId);
        await lockProviderBookingReadiness(transaction, input.providerId);
        await this.assertProviderReadyForFinalAssignment(transaction, input.bookingId, input.providerId);
        await this.assertProviderHasNoOtherActiveBooking(transaction, input.bookingId, input.providerId);
        await this.assertProviderWalletCanFinalizeBooking(transaction, input.providerId);
        const matchedBooking = await transaction.booking.update({
          where: {
            id: input.bookingId,
            status: BookingStatus.OPEN_MATCHING,
            selectedProviderId: null,
            expiresAt: { gt: new Date() },
          },
          data: bookingMatchedUpdateData({
            bookingId: input.bookingId,
            providerProfileId: input.providerId,
            matchSource: PrismaBookingMatchSource.FIRST_PICK_ACCEPTED_FIRST,
          }),
          include: matchedBookingForClientInclude,
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
      await this.markProviderBusy(input.providerId);
      return matchedBooking;
    } catch (error) {
      return this.throwStaleBookingMatchRequest(
        error,
        input.bookingId,
        'Booking is already matched or no longer open for first-pick acceptance',
      );
    }
  }

  private async assertProviderHasNoOtherActiveBooking(
    transaction: Prisma.TransactionClient,
    bookingId: string,
    providerProfileId: string,
  ) {
    const activeBookings = await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "Booking"
        WHERE "selectedProviderId" = ${providerProfileId}
          AND "id" <> ${bookingId}
          AND "status" IN (${Prisma.join(
            providerActiveWorkStatuses.map((status) => Prisma.sql`${status}::"BookingStatus"`),
          )})
        LIMIT 1
        FOR UPDATE
      `,
    );
    if (activeBookings.length > 0) {
      throw new BadRequestException(
        'Partner must complete the current booking before receiving or joining another booking',
      );
    }
  }

  private async assertProviderReadyForFinalAssignment(
    transaction: Prisma.TransactionClient,
    bookingId: string,
    providerProfileId: string,
  ) {
    const [provider, bookingServices] = await Promise.all([
      transaction.providerProfile.findUnique({
        where: { id: providerProfileId },
        include: providerBookingReadinessInclude,
      }),
      transaction.bookingService.findMany({
        where: { bookingId },
        select: { serviceId: true },
      }),
    ]);
    if (!provider) {
      throw new BadRequestException('Partner or booking is no longer available for final selection');
    }

    assertProviderCanReceiveBooking(provider);
    await this.assertProviderOffersBookingServices(
      transaction,
      providerProfileId,
      bookingServices.map((service) => service.serviceId),
    );
  }

  private async assertProviderOffersBookingServices(
    client: PrismaService | Prisma.TransactionClient,
    providerProfileId: string,
    serviceIds: string[],
  ) {
    const uniqueServiceIds = [...new Set(serviceIds)];
    if (uniqueServiceIds.length === 0) {
      throw new BadRequestException('Booking service is required before Partner participation');
    }

    const [configuredServiceCount, providerServices] = await Promise.all([
      client.providerService.count({ where: { providerProfileId } }),
      client.providerService.findMany({
        where: { providerProfileId, serviceId: { in: uniqueServiceIds } },
        select: { active: true, serviceId: true },
      }),
    ]);
    const providerServiceById = new Map(
      providerServices.map((providerService) => [providerService.serviceId, providerService]),
    );
    for (const serviceId of uniqueServiceIds) {
      assertProviderOffersRequestedService({
        providerService: providerServiceById.get(serviceId),
        configuredServiceCount,
      });
    }
  }

  private async notifyFirstPickAcceptedMatched(input: {
    bookingId: string;
    customerUserId: string;
    provider: { id: string; displayName: string };
    selectedProviderUserId?: string;
    chatRoomId?: string;
  }) {
    await createNotifications(this.notifications, [
      ...(input.selectedProviderUserId
        ? [firstPickMatchedProviderNotification(input.selectedProviderUserId, input.bookingId)]
        : []),
      firstPickMatchedCustomerNotification({
          userId: input.customerUserId,
          bookingId: input.bookingId,
          provider: input.provider,
          chatRoomId: input.chatRoomId,
        }),
    ]);
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
      await this.runPostCommitBookingEffects(input.bookingId, [
        {
          label: 'marketplace-accepted-notification',
          run: () =>
            this.notifyCustomerMarketplaceProviderAccepted(
              input.customerUserId,
              input.bookingId,
              input.provider,
            ),
        },
        {
          label: 'marketplace-accepted-realtime',
          run: () => this.matchingGateway.emitProviderAccepted(input.bookingId, input.participant),
        },
      ]);
    }

    if (input.status === ParticipantStatus.REJECTED) {
      await this.runPostCommitBookingEffects(input.bookingId, [
        {
          label: 'marketplace-rejected-notification',
          run: () =>
            this.notifyCustomerMarketplaceProviderRejected(
              input.customerUserId,
              input.bookingId,
              input.provider,
            ),
        },
        {
          label: 'marketplace-rejected-realtime',
          run: () => this.matchingGateway.emitProviderRejected(input.bookingId, input.participant),
        },
      ]);
    }
  }

  private async notifyServiceStarted(input: {
    bookingId: string;
    customerUserId: string;
    providerUserId?: string;
    chatRoomId?: string;
  }) {
    await createNotifications(this.notifications, [
      serviceStartedCustomerNotification({
          userId: input.customerUserId,
          bookingId: input.bookingId,
          chatRoomId: input.chatRoomId,
        }),
      ...(input.providerUserId
        ? [
            serviceStartedProviderNotification({
                userId: input.providerUserId,
                bookingId: input.bookingId,
                chatRoomId: input.chatRoomId,
              }),
          ]
        : []),
    ]);
  }

  private async notifyCustomerServiceCompleted(customerUserId: string, bookingId: string) {
    await this.notifications.create(customerServiceCompletedNotification(customerUserId, bookingId));
  }

  private async notifyProviderEarningCreated(providerUserId: string, bookingId: string) {
    await this.notifications.create(providerEarningCreatedNotification(providerUserId, bookingId));
  }

  private async notifyBackupProvidersAndRecordTrace(input: BackupProviderNotificationInput) {
    const { notificationError, trace, websocketError } = await this.notifyBackupProviders(input);
    await this.recordBackupNotificationTrace(input.bookingId, trace);
    if (notificationError) {
      throw notificationError;
    }
    if (websocketError) {
      throw websocketError;
    }
  }

  private async notifyBackupProviders(input: BackupProviderNotificationInput) {
    const alertPolicy = backupAlertPolicyMetadata(input);
    const notifiedProviders: Array<{
      providerProfileId: string;
      userId: string;
      distanceMeters: number;
      notificationId: string;
    }> = [];

    const notificationInputs = input.providers.map((backupProvider) =>
      backupBookingAvailableNotification({
            userId: backupProvider.userId,
            bookingId: input.bookingId,
            providerProfileId: backupProvider.id,
            distanceMeters: backupProvider.distanceMeters,
            backupProviderRadiusMeters: input.backupProviderRadiusMeters,
            alertPolicy,
          }),
    );
    const notificationResults = await Promise.allSettled(
      notificationInputs.map((notification) => this.notifications.create(notification)),
    );
    notificationResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const backupProvider = input.providers[index];
        if (!backupProvider) return;
        notifiedProviders.push({
          providerProfileId: backupProvider.id,
          userId: backupProvider.userId,
          distanceMeters: backupProvider.distanceMeters,
          notificationId: result.value.id,
        });
      }
    });
    const notificationError = notificationBatchFailure(notificationResults);
    if (notificationError) {
      this.logger.error(
        `Backup Partner notifications failed for booking ${input.bookingId}: ${
          notificationError instanceof Error ? notificationError.message : String(notificationError)
        }`,
        notificationError instanceof Error ? notificationError.stack : undefined,
      );
    }

    let websocketError: unknown;
    try {
      await this.matchingGateway.emitBackupBookingAvailable(
        input.providers.map((provider) => provider.userId),
        input.bookingId,
        input.matchingPayload,
      );
    } catch (error) {
      websocketError = error;
    }
    return {
      notificationError,
      trace: backupNotificationTrace({
        stage: input.stage,
        alertPolicy,
        notifiedProviders,
        websocketTargetCount: input.providers.length,
      }),
      websocketError,
    };
  }

  private async recordBackupNotificationTrace(bookingId: string, trace: BackupNotificationTrace) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { metadata: true, updatedAt: true },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found while recording notification evidence');
      }
      const mutation = await this.prisma.booking.updateMany({
        where: { id: bookingId, updatedAt: booking.updatedAt },
        data: {
          metadata: toJson(appendBackupNotificationTrace(booking.metadata, trace)),
        },
      });
      if (mutation.count === 1) {
        return;
      }
    }
    throw new ConflictException('Booking notification evidence changed concurrently; retry trace recording.');
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
    customerGender?: string | null;
    customerNationality?: string | null;
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
        bookingAlertPreferences: true,
      },
    });

    const dispatchCandidates = resolveBackupProviderDispatchCandidates(providers, {
      lat: input.lat,
      lng: input.lng,
      radiusMeters: policy.backupProviderRadiusMeters,
      serviceId: input.serviceId,
      customerGender: input.customerGender,
      customerNationality: input.customerNationality,
    });
    const walletTotals = await this.backupProviderWalletTotals(dispatchCandidates.matchingAlerts);

    return finalizeBackupProviderDispatchCandidates(
      dispatchCandidates.matchingAlerts,
      walletTotals,
      policy.backupProviderInvitationLimit,
    ).invited;
  }

  private async backupProviderWalletTotals<T extends { id: string }>(providers: T[]) {
    if (providers.length === 0) {
      return [];
    }

    return this.prisma.providerWalletLedgerEntry.groupBy({
      by: ['providerProfileId'],
      where: {
        providerProfileId: { in: providers.map((provider) => provider.id) },
      },
      _sum: { amount: true },
    });
  }

  private canProviderSeeOpenBooking(
    booking: {
      preferredProviderId: string | null;
      openedAt?: Date | string | null;
      distanceMeters?: number | null;
      participants?: Array<{ providerProfileId: string; status: ParticipantStatus | string }>;
    },
    providerId: string,
    policy: Awaited<ReturnType<MatchingService['getPolicy']>>,
  ) {
    if (booking.preferredProviderId === providerId) {
      return true;
    }
    return this.isBackupWindowOpen(booking, policy);
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

  private async assertProviderWalletCanFinalizeBooking(
    transaction: Prisma.TransactionClient,
    providerProfileId: string,
  ) {
    await lockProviderWalletLedger(transaction, providerProfileId);
    const wallet = await transaction.providerWalletLedgerEntry.aggregate({
      where: { providerProfileId },
      _sum: { amount: true },
    });
    const walletBalance = wallet._sum.amount ?? 0;
    if (walletBalance < 0) {
      throwProviderWalletBlocked({ providerProfileId, walletBalance });
    }
  }

  private async updateBookingStatus(input: {
    bookingId: string;
    providerProfileId: string;
    status: BookingStatus;
    allowedPreviousStatuses: BookingStatus[];
  }) {
    const transition = await this.prisma.booking.updateMany({
      where: {
        id: input.bookingId,
        selectedProviderId: input.providerProfileId,
        status: { in: input.allowedPreviousStatuses },
      },
      data: { status: input.status },
    });
    if (transition.count !== 1) {
      throw this.bookingStateChangedError();
    }
    return this.prisma.booking.findUniqueOrThrow({ where: { id: input.bookingId } });
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
    const updated = await this.updateBookingStatus({
      bookingId,
      providerProfileId: provider.id,
      status,
      allowedPreviousStatuses: allowedPreviousStatuses ?? [booking.status],
    });
    if (status === BookingStatus.ARRIVED) {
      await this.runPostCommitBookingEffects(bookingId, [
        {
          label: 'arrival-realtime',
          run: () => this.matchingGateway.emitProviderArrived(bookingId, updated),
        },
      ]);
    }
    return updated;
  }

  async cancelProviderBooking(
    bookingId: string,
    providerUserId: string,
    input: {
      lat?: number;
      lng?: number;
      addressText?: string;
      note: string;
      reasonCode: ProviderCancellationReasonCode;
    },
  ) {
    const provider = await this.requireProvider(providerUserId);
    this.assertProviderBookingActionLocationInput(input);
    const cancellation = await this.closeProviderBookingAfterMatch({
      addressText: input.addressText,
      bookingId,
      lat: input.lat,
      lng: input.lng,
      providerProfileId: provider.id,
      providerUserId: provider.userId,
      note: input.note,
      reasonCode: input.reasonCode,
    });

    const paymentClosure = cancellation.autoApproved
      ? await this.bookingCancellationResultWithPaymentRelease(
          cancellation.booking,
          'Partner post-match cancellation auto-approved',
          provider.userId,
        )
      : null;
    const bookingResult = paymentClosure?.result ?? cancellation.booking;
    const partnerResult = partnerBookingResponse(bookingResult, provider.id);
    await this.runPostCommitBookingEffects(bookingId, [
      { label: 'matching-close', run: () => this.matching.closeBooking(bookingId) },
      {
        label: 'post-match-cancellation-notification',
        run: () =>
          this.notifyProviderPostMatchCancellation({
            bookingId,
            customerUserId: cancellation.booking.customerProfile.userId,
            autoApproved: cancellation.autoApproved,
            reasonCode: cancellation.reasonCode,
            reasonLabel: cancellation.reasonLabel,
          }),
      },
      {
        label: 'cancellation-realtime',
        run: () => this.matchingGateway.emitBookingExpired(bookingId, partnerResult),
      },
    ]);

    return {
      ...partnerResult,
      postMatchCancellation: {
        autoApproved: cancellation.autoApproved,
        adminReviewRequired: !cancellation.autoApproved,
        minutesAfterMatch: cancellation.minutesAfterMatch,
        earningResult: cancellation.earningResult,
        reasonCode: cancellation.reasonCode,
        reasonLabel: cancellation.reasonLabel,
      },
    };
  }

  private async closeProviderBookingAfterMatch(input: {
    addressText?: string;
    bookingId: string;
    lat: number;
    lng: number;
    providerProfileId: string;
    providerUserId: string;
    note: string;
    reasonCode: ProviderCancellationReasonCode;
  }) {
    const closedAt = new Date();
    const partnerNote = cleanProviderCancellationNote(input.note);
    if (!partnerNote) {
      throw new BadRequestException('Partner cancellation detail is required');
    }
    const reasonLabel = providerCancellationReasonLabel(input.reasonCode);

    const result = await this.prisma.$transaction(async (tx) => {
      await lockBookingLifecycle(tx, input.bookingId);
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: input.bookingId },
        select: {
          id: true,
          status: true,
          metadata: true,
          notes: true,
          matchedAt: true,
          selectedProviderId: true,
          closedByRole: true,
          closedReason: true,
          opsTasks: {
            where: { type: BookingOpsTaskType.PAYMENT_REVIEWED },
            select: { status: true, type: true },
          },
          earning: {
            select: {
              id: true,
              bookingId: true,
              providerProfileId: true,
              netAmount: true,
              currency: true,
              status: true,
            },
          },
        },
      });

      if (booking.selectedProviderId !== input.providerProfileId) {
        throw new BadRequestException('Partner is not selected for this booking');
      }
      if (isProviderPaymentClosureRetry(booking, input.reasonCode)) {
        const updated = await tx.booking.findUniqueOrThrow({
          where: { id: input.bookingId },
          include: providerCancellationBookingInclude,
        });
        const cancellationMetadata = jsonObject(jsonObject(booking.metadata).postMatchCancellation);
        return {
          booking: updated,
          autoApproved: true,
          minutesAfterMatch: nonNegativeNumber(cancellationMetadata.minutesAfterMatch),
          earningResult: { skipped: true, reason: 'PAYMENT_CLOSURE_RETRY' },
          reasonCode: input.reasonCode,
          reasonLabel,
        };
      }
      const activePaymentOperation = await tx.paymentAdminOperationClaim.findFirst({
        where: {
          payment: { bookingId: input.bookingId },
          status: {
            in: [PaymentAdminOperationStatus.IN_PROGRESS, PaymentAdminOperationStatus.REVIEW_REQUIRED],
          },
        },
        select: { id: true, status: true },
      });
      if (activePaymentOperation) {
        throw new ConflictException({
          code: 'BOOKING_PAYMENT_OPERATION_IN_PROGRESS',
          message: 'A payment operation is in progress for this booking. Reload before cancelling.',
          operationClaimId: activePaymentOperation.id,
        });
      }
      if (!providerPostMatchCancellableStatuses.includes(booking.status)) {
        throw new BadRequestException(`Booking status ${booking.status} cannot be cancelled by Partner`);
      }

      await this.recordProviderBookingActionLocation(
        {
          addressText: input.addressText,
          bookingId: input.bookingId,
          lat: input.lat,
          lng: input.lng,
          providerProfileId: input.providerProfileId,
        },
        tx,
      );

      const { minutesAfterMatch, autoApprovalWindow } = isPostMatchCancellationAutoApprovalWindow(
        booking.matchedAt,
        closedAt,
      );
      const requiresAdminReview = providerCancellationRequiresAdminReview(input.reasonCode);
      const autoApproved = autoApprovalWindow && !requiresAdminReview;
      const closedReason = autoApproved
        ? POST_MATCH_CANCELLATION_APPROVED_REASON
        : POST_MATCH_CANCELLATION_PARTNER_PENDING_REASON;
      const closedNote = `${reasonLabel}: ${partnerNote}`;
      const notes = appendDatedBookingNote(
        booking.notes,
        autoApproved
          ? `Partner post-match cancellation auto-approved: ${closedNote}`
          : `Partner post-match cancellation pending admin review: ${closedNote}`,
        closedAt,
      );
      const earningResult = autoApproved
        ? await restorePostMatchCancellationEarning(tx, booking.earning)
        : { skipped: true, reason: 'AWAITING_ADMIN_REVIEW' };

      const transition = await tx.booking.updateMany({
        where: {
          id: input.bookingId,
          selectedProviderId: input.providerProfileId,
          status: { in: providerPostMatchCancellableStatuses },
        },
        data: {
          status: BookingStatus.CANCELLED,
          closedAt,
          closedByRole: Role.PROVIDER,
          closedReason,
          closedNote,
          metadata: toJson({
            ...(booking.metadata && typeof booking.metadata === 'object' && !Array.isArray(booking.metadata)
              ? booking.metadata
              : {}),
            postMatchCancellation: {
              reasonCode: input.reasonCode,
              reasonLabel,
              detail: partnerNote,
              requiresAdminReview: !autoApproved,
              autoApprovalWindow,
              autoApproved,
              minutesAfterMatch,
            },
          }),
          notes,
        },
      });
      if (transition.count !== 1) {
        throw this.bookingStateChangedError();
      }
      await releaseCouponRedemptionForBooking(tx, {
        bookingId: input.bookingId,
        occurredAt: closedAt,
        reason: COUPON_RELEASE_REASON.PARTNER_CANCELLED,
      });

      const updated = await tx.booking.update({
        where: { id: input.bookingId },
        data: {
          opsTasks: {
            upsert: {
              where: {
                bookingId_type: {
                  bookingId: input.bookingId,
                  type: BookingOpsTaskType.PAYMENT_REVIEWED,
                },
              },
              update: {
                status: BookingOpsTaskStatus.PENDING,
                note: closedNote,
                actorId: input.providerUserId,
              },
              create: {
                type: BookingOpsTaskType.PAYMENT_REVIEWED,
                status: BookingOpsTaskStatus.PENDING,
                note: closedNote,
                actorId: input.providerUserId,
              },
            },
          },
        },
        include: providerCancellationBookingInclude,
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: input.providerUserId,
          action: autoApproved
            ? 'booking.post_match_cancellation.auto_approve'
            : 'booking.post_match_cancellation.review_required',
          target: `booking:${input.bookingId}`,
          metadata: toJson({
            bookingId: input.bookingId,
            providerProfileId: input.providerProfileId,
            previousStatus: booking.status,
            minutesAfterMatch,
            autoApprovalWindow,
            reasonCode: input.reasonCode,
            reasonLabel,
            requiresAdminReview,
            note: closedNote,
            earningResult,
          }),
        },
      });

      return {
        booking: updated,
        autoApproved,
        minutesAfterMatch,
        earningResult,
        reasonCode: input.reasonCode,
        reasonLabel,
      };
    });
    await this.reconcileProviderAvailability(input.providerProfileId);
    return result;
  }

  private async notifyProviderPostMatchCancellation(input: {
    bookingId: string;
    customerUserId: string;
    autoApproved: boolean;
    reasonCode: ProviderCancellationReasonCode;
    reasonLabel: string;
  }) {
    await this.notifications.create({
      userId: input.customerUserId,
      sourceKey: `booking:${input.bookingId}:booking.cancelled.post-match:${input.customerUserId}`,
      targetRole: Role.CUSTOMER,
      type: 'booking.cancelled',
      title: 'Booking cancelled',
      body: input.autoApproved
        ? 'The Partner cancelled this booking within the approval window.'
        : 'The Partner cancelled this booking. HANDS operations will review the chat evidence.',
      data: {
        bookingId: input.bookingId,
        postMatchCancellation: true,
        autoApproved: input.autoApproved,
        adminReviewRequired: !input.autoApproved,
        reasonCode: input.reasonCode,
        reasonLabel: input.reasonLabel,
      },
    });
  }

  private async startProviderService(input: { bookingId: string; providerProfileId: string }) {
    const updated = await this.prisma.$transaction(async (tx) => {
      await lockBookingLifecycle(tx, input.bookingId);
      await this.assertProviderWalletCanFinalizeBooking(tx, input.providerProfileId);
      const allowedPreviousStatuses =
        providerLifecycleAllowedPreviousStatuses(BookingStatus.IN_SERVICE) ?? [];
      const transition = await tx.booking.updateMany({
        where: {
          id: input.bookingId,
          selectedProviderId: input.providerProfileId,
          status: { in: allowedPreviousStatuses },
        },
        data: { status: BookingStatus.IN_SERVICE },
      });
      if (transition.count !== 1) {
        throw this.bookingStateChangedError();
      }
      return tx.booking.update({
        where: { id: input.bookingId },
        data: bookingServiceStartedUpdateData(),
        include: serviceStartedBookingInclude,
      });
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
    await this.runPostCommitBookingEffects(input.bookingId, [
      {
        label: 'service-start-notifications',
        run: () =>
          this.notifyServiceStarted({
            bookingId: input.bookingId,
            customerUserId: input.customerUserId,
            providerUserId: input.providerUserId,
            chatRoomId: input.chatRoomId,
          }),
      },
      {
        label: 'service-start-realtime',
        run: () => this.matchingGateway.emitServiceStarted(input.bookingId, input.matchingPayload),
      },
    ]);
  }

  async complete(
    bookingId: string,
    providerUserId: string,
    input: { lat?: number; lng?: number; addressText?: string } = {},
  ) {
    const provider = await this.requireProviderCanCompleteBooking(bookingId, providerUserId);
    this.assertProviderBookingActionLocationInput(input);
    const paymentBeforeCapture = await this.prisma.payment.findUniqueOrThrow({
      where: { bookingId },
      select: { id: true, method: true, status: true },
    });
    const requiresGatewayCapture = this.payments.paymentRequiresGatewayCaptureForBookingCompletion(
      paymentBeforeCapture.method,
      paymentBeforeCapture.status,
    );
    const operationClaim = requiresGatewayCapture
      ? await this.createBookingCompletionCaptureClaim({
          actorId: providerUserId,
          bookingId,
          paymentId: paymentBeforeCapture.id,
          providerProfileId: provider.id,
        })
      : null;

    let booking: Prisma.BookingGetPayload<{ include: typeof completedBookingInclude }>;
    try {
      await this.payments.confirmGatewayCaptureForBookingCompletion(providerUserId, bookingId);
      booking = await this.prisma.$transaction(async (tx) => {
        await lockBookingLifecycle(tx, bookingId);
        await this.recordProviderBookingActionLocation(
          {
          bookingId,
          providerProfileId: provider.id,
          addressText: input.addressText,
          lat: input.lat,
          lng: input.lng,
          },
          tx,
        );
        const payment = await tx.payment.findUniqueOrThrow({
          where: { bookingId },
          select: { id: true, method: true },
        });
        await transitionPaymentStatus(tx, {
          data: { status: PaymentStatus.CAPTURED },
          fromStatuses: paymentCaptureSourceStatuses(payment.method),
          paymentId: payment.id,
          targetStatus: PaymentStatus.CAPTURED,
        });
        const allowedPreviousStatuses = providerLifecycleAllowedPreviousStatuses(BookingStatus.COMPLETED) ?? [
          BookingStatus.IN_SERVICE,
        ];
        const completedAt = new Date();
        const transition = await tx.booking.updateMany({
          where: {
            id: bookingId,
            selectedProviderId: provider.id,
            status: { in: allowedPreviousStatuses },
          },
          data: bookingCompletedUpdateData(completedAt),
        });
        if (transition.count !== 1) {
          throw this.bookingStateChangedError();
        }
        await consumeCouponRedemptionForBooking(tx, { bookingId, occurredAt: completedAt });
        await this.earnings.createForCompletedBooking(
          bookingId,
          provider.id,
          { occurredAt: completedAt },
          tx,
        );
        if (operationClaim) {
          const completedClaim = await tx.paymentAdminOperationClaim.updateMany({
            where: {
              id: operationClaim.id,
              status: PaymentAdminOperationStatus.IN_PROGRESS,
            },
            data: {
              completedAt,
              receipt: toJson({ bookingId, completedAt: completedAt.toISOString() }),
              status: PaymentAdminOperationStatus.SUCCEEDED,
            },
          });
          if (completedClaim.count !== 1) {
            throw new ConflictException('Booking completion payment claim is no longer active');
          }
        }
        return tx.booking.findUniqueOrThrow({
          where: { id: bookingId },
          include: completedBookingInclude,
        });
      });
    } catch (error) {
      if (operationClaim) {
        await this.markBookingCompletionCaptureClaimForReview(operationClaim.id, error);
      }
      throw error;
    }
    await this.reconcileProviderAvailability(provider.id);
    const result = this.matching.completeBooking(bookingId, clientBookingResponse(booking));
    await this.announceServiceCompleted({
      bookingId,
      providerProfileId: provider.id,
      selectedProviderUserId: booking.selectedProvider?.userId,
      matchingPayload: result,
    });
    return result;
  }

  private async createBookingCompletionCaptureClaim(input: {
    actorId: string;
    bookingId: string;
    paymentId: string;
    providerProfileId: string;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockBookingLifecycle(tx, input.bookingId);
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id: input.bookingId },
          select: { selectedProviderId: true, status: true },
        });
        const allowedPreviousStatuses = providerLifecycleAllowedPreviousStatuses(BookingStatus.COMPLETED) ?? [
          BookingStatus.IN_SERVICE,
        ];
        if (
          booking.selectedProviderId !== input.providerProfileId ||
          !allowedPreviousStatuses.includes(booking.status)
        ) {
          throw this.bookingStateChangedError();
        }
        return tx.paymentAdminOperationClaim.create({
          data: {
            action: BOOKING_COMPLETION_CAPTURE_ACTION,
            actorId: input.actorId,
            idempotencyKey: BOOKING_COMPLETION_CAPTURE_IDEMPOTENCY_KEY,
            paymentId: input.paymentId,
            reason: 'Gateway capture reserved for booking completion',
            requestHash: `${input.bookingId}:${input.providerProfileId}:${input.paymentId}`,
          },
          select: { id: true },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'BOOKING_PAYMENT_OPERATION_IN_PROGRESS',
          message: 'Another payment operation is already active for this booking.',
        });
      }
      throw error;
    }
  }

  private async markBookingCompletionCaptureClaimForReview(claimId: string, error: unknown) {
    try {
      await this.prisma.paymentAdminOperationClaim.updateMany({
        where: { id: claimId, status: PaymentAdminOperationStatus.IN_PROGRESS },
        data: {
          errorCode: 'BOOKING_COMPLETION_CAPTURE_REQUIRES_REVIEW',
          errorMessage: safeBookingCompletionErrorMessage(error),
          status: PaymentAdminOperationStatus.REVIEW_REQUIRED,
        },
      });
    } catch (claimError) {
      this.logger.error(
        `Could not mark booking completion payment claim ${claimId} for review`,
        claimError instanceof Error ? claimError.stack : undefined,
      );
    }
  }

  async createProviderCustomerReview(bookingId: string, providerUserId: string, input: { comment: string }) {
    const provider = await this.requireProvider(providerUserId);
    const comment = normalizeProviderCustomerReviewComment(input.comment);

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: {
          id: true,
          status: true,
          customerProfileId: true,
          selectedProviderId: true,
        },
      });

      if (booking.selectedProviderId !== provider.id) {
        throw new BadRequestException('Partner is not selected for this booking');
      }
      if (booking.status !== BookingStatus.COMPLETED) {
        throw new BadRequestException('Partner customer evaluation is allowed only after service completion');
      }

      const existingReview = await tx.providerCustomerReview.findUnique({
        where: { bookingId },
        select: { id: true },
      });
      if (existingReview) {
        throw new BadRequestException('Partner customer evaluation already exists for this booking');
      }

      return tx.providerCustomerReview.create({
        data: {
          bookingId: booking.id,
          customerProfileId: booking.customerProfileId,
          providerProfileId: provider.id,
          comment,
        },
      });
    });
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

  private assertProviderBookingActionLocationInput<T extends { lat?: number; lng?: number }>(
    input: T,
  ): asserts input is T & { lat: number; lng: number } {
    if (input.lat === undefined || input.lng === undefined) {
      throw new BadRequestException('Partner action location requires both lat and lng');
    }
  }

  private async recordProviderBookingActionLocation(
    input: {
    bookingId: string;
    providerProfileId: string;
    addressText?: string;
    lat?: number;
    lng?: number;
    },
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    this.assertProviderBookingActionLocationInput(input);
    const lat = normalizeBookingCoordinate(input.lat, 'lat');
    const lng = normalizeBookingCoordinate(input.lng, 'lng');
    if (!isVietnamBookingCoordinate(lat, lng)) {
      throw new BadRequestException('Partner action location must be inside Vietnam');
    }
    const addressText = cleanOptionalLocationAddress(input.addressText);

    await client.locationSnapshot.create({
      data: {
        bookingId: input.bookingId,
        providerProfileId: input.providerProfileId,
        ...(addressText ? { addressText } : {}),
        lat,
        lng,
      },
    });
  }

  private bookingStateChangedError() {
    return new ConflictException('Booking state changed concurrently; reload and try again');
  }

  private async announceServiceCompleted(input: {
    bookingId: string;
    providerProfileId: string;
    selectedProviderUserId?: string;
    matchingPayload: unknown;
  }) {
    await this.runPostCommitBookingEffects(input.bookingId, [
      {
        label: 'service-completed-customer-notification',
        run: async () => {
          const customerUserId = await this.getCustomerUserIdForBooking(input.bookingId);
          await this.notifyCustomerServiceCompleted(customerUserId, input.bookingId);
        },
      },
      ...(input.selectedProviderUserId
        ? [
            {
              label: 'earning-created-notification',
              run: () => this.notifyProviderEarningCreated(input.selectedProviderUserId!, input.bookingId),
            },
            {
              label: 'first-revenue-payout-setup-notification',
              run: () =>
                this.notifyProviderFirstRevenuePayoutSetup(
                  input.providerProfileId,
                  input.selectedProviderUserId!,
                  input.bookingId,
                ),
            },
          ]
        : []),
      {
        label: 'service-completed-realtime',
        run: () => this.matchingGateway.emitServiceCompleted(input.bookingId, input.matchingPayload),
      },
    ]);
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
        include: firstRevenuePayoutSetupProviderInclude,
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
      include: providerBookingReadinessInclude,
    });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }
    if (provider.status === ProviderStatus.OFFLINE) {
      throw new BadRequestException('Partner must be online before joining bookings');
    }
    return provider;
  }

  private async requireProviderAccount(userId?: string) {
    if (!userId) {
      throw new BadRequestException('Authenticated partner is required');
    }
    const provider = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }
    return provider;
  }

  private async throwStaleBookingMatchRequest(
    error: unknown,
    bookingId: string,
    message: string,
  ): Promise<never> {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: clientBookingDetailInclude,
      });
      throw new ConflictException({
        message,
        booking: booking ? clientBookingResponse(booking) : null,
      });
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

  private assertBookingOpenForPartnerResponse(booking: {
    id: string;
    status: BookingStatus;
    selectedProviderId?: string | null;
    expiresAt?: Date | null;
  }) {
    try {
      assertPartnerResponseWindowOpen(booking);
    } catch {
      throw new ConflictException({
        message: 'Booking is already matched or no longer open for partner response',
        booking: {
          id: booking.id,
          status: booking.status,
          selectedProviderId: booking.selectedProviderId ?? null,
          expiresAt: booking.expiresAt ?? null,
        },
      });
    }
  }

  private assertProviderLifecycleTransition(current: BookingStatus, allowed: BookingStatus[]) {
    assertProviderLifecycleTransitionAllowed(current, allowed);
  }

  private async getCustomerUserIdForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: bookingCustomerProfileInclude,
    });
    return booking.customerProfile.userId;
  }
}

function preferredProviderRejectionInput(input?: {
  reasonCode?: PreferredProviderRejectionReasonCode;
  reasonDetail?: string;
}) {
  const reasonCode = input?.reasonCode;
  const reasonDetail = input?.reasonDetail?.trim();
  if (
    !reasonCode ||
    !preferredProviderRejectionReasonCodes.includes(reasonCode) ||
    !reasonDetail ||
    reasonDetail.length > 1000
  ) {
    throw new BadRequestException('Preferred partner rejection reason code and detail are required');
  }
  return { reasonCode, reasonDetail };
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

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isCustomerPaymentClosureRetry(booking: {
  closedByRole?: Role | null;
  closedReason?: string | null;
  opsTasks?: Array<{ status: BookingOpsTaskStatus; type: BookingOpsTaskType }>;
  selectedProviderId?: string | null;
  status: BookingStatus;
}) {
  return (
    booking.status === BookingStatus.CANCELLED &&
    booking.closedByRole === Role.CUSTOMER &&
    booking.closedReason === 'customer_cancelled' &&
    !booking.selectedProviderId &&
    booking.opsTasks?.some(
      (task) =>
        task.type === BookingOpsTaskType.PAYMENT_REVIEWED && task.status === BookingOpsTaskStatus.PENDING,
    ) === true
  );
}

function isPreferredProviderPaymentClosureRetry(
  booking: {
    closedByRole?: Role | null;
    closedReason?: string | null;
    opsTasks?: Array<{ status: BookingOpsTaskStatus; type: BookingOpsTaskType }>;
    preferredProviderId?: string | null;
    selectedProviderId?: string | null;
    status: BookingStatus;
  },
  providerProfileId: string,
) {
  return (
    booking.status === BookingStatus.CANCELLED &&
    booking.closedByRole === Role.PROVIDER &&
    booking.closedReason === 'preferred_provider_rejected' &&
    booking.preferredProviderId === providerProfileId &&
    !booking.selectedProviderId &&
    booking.opsTasks?.some(
      (task) =>
        task.type === BookingOpsTaskType.PAYMENT_REVIEWED && task.status === BookingOpsTaskStatus.PENDING,
    ) === true
  );
}

function isProviderPaymentClosureRetry(
  booking: {
    closedByRole?: Role | null;
    closedReason?: string | null;
    metadata?: Prisma.JsonValue | null;
    opsTasks?: Array<{ status: BookingOpsTaskStatus; type: BookingOpsTaskType }>;
    status: BookingStatus;
  },
  reasonCode: ProviderCancellationReasonCode,
) {
  const cancellation = jsonObject(jsonObject(booking.metadata).postMatchCancellation);
  return (
    booking.status === BookingStatus.CANCELLED &&
    booking.closedByRole === Role.PROVIDER &&
    booking.closedReason === POST_MATCH_CANCELLATION_APPROVED_REASON &&
    cancellation.reasonCode === reasonCode &&
    booking.opsTasks?.some(
      (task) =>
        task.type === BookingOpsTaskType.PAYMENT_REVIEWED && task.status === BookingOpsTaskStatus.PENDING,
    ) === true
  );
}

function stringOrUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function nonNegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizePaginationCursor(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function providerBookingDetailViewTelemetryEvent(
  eventType: ProviderBookingDetailViewTelemetryInput['eventType'],
) {
  return eventType === 'closed'
    ? PROVIDER_OPEN_REQUEST_DETAIL_CLOSED_EVENT
    : PROVIDER_OPEN_REQUEST_DETAIL_HEARTBEAT_EVENT;
}

function normalizeProviderBookingDetailViewDurationSeconds(value: number | null | undefined) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(7200, Math.trunc(value)));
}

function cleanProviderCancellationNote(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1000) : null;
}

function normalizeProviderCustomerReviewComment(value: string | null | undefined) {
  if (typeof value !== 'string') {
    throw new BadRequestException('Partner customer evaluation comment is required');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException('Partner customer evaluation comment is required');
  }
  return trimmed.slice(0, 1000);
}

function cleanOptionalLocationAddress(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}

async function lockBookingLifecycle(tx: Prisma.TransactionClient, bookingId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`);
}

async function lockProviderBookingAssignment(tx: Prisma.TransactionClient, providerProfileId: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`provider-booking-assignment:${providerProfileId}`}, 0))::text AS "lockResult"`,
  );
}

async function lockProviderBookingReadiness(tx: Prisma.TransactionClient, providerProfileId: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "ProviderProfile" WHERE "id" = ${providerProfileId} FOR UPDATE`,
  );
}

function safeBookingCompletionErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'Booking completion failed after capture reservation';
  return message
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 500);
}

function bookingPostCommitEffectRetryable(label: string) {
  return label.startsWith('matching-') || label.includes('realtime') || label.includes('notification');
}

function appendDatedBookingNote(existingNotes: string | null | undefined, message: string, now = new Date()) {
  const entry = `[${now.toISOString()}] ${message}`;
  const trimmedNotes = existingNotes?.trim();
  return trimmedNotes ? `${trimmedNotes}\n${entry}` : entry;
}
