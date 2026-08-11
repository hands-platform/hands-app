import {
  AdminOperatorPermissionCategory,
  BookingStatus,
  EarningStatus,
  PaymentStatus,
  Prisma,
  ProviderKycStatus,
  VerificationStatus,
} from '@prisma/client';

import { cashSettlementDebtCteSql } from '../earnings/cash-settlement-query';
import { adminBookingProductionDataSql } from './admin-booking-list-query';
import { adminNotificationProductionDataSql } from './admin-notification-production-data';
import { ADMIN_REFUND_ACTIVE_STATUSES } from './admin-refund-queue';

export type AdminOpenOperationsCaseRow = {
  caseId: string;
  key: string;
};

export const ADMIN_OPEN_OPERATIONS_CASE_QUEUES = {
  'payment-holds': {
    category: AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING,
    href: '/payments?status=AUTHORIZED',
    label: 'Payment holds',
    priority: 1,
  },
  'cancellation-review': {
    category: AdminOperatorPermissionCategory.BOOKINGS_CANCELLATIONS,
    href: '/bookings/post-match-cancellations',
    label: 'Cancellation review',
    priority: 2,
  },
  'refund-review': {
    category: AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
    href: '/refunds?status=open',
    label: 'Refund review',
    priority: 3,
  },
  'matching-delays': {
    category: AdminOperatorPermissionCategory.BOOKINGS_REALTIME,
    href: '/bookings?view=realtime&status=OPEN_MATCHING',
    label: 'Matching delays',
    priority: 4,
  },
  'partner-approvals': {
    category: AdminOperatorPermissionCategory.PARTNERS_UNAPPROVED,
    href: '/partners?review=approval-pending&sort=oldest',
    label: 'Partner approvals',
    priority: 5,
  },
  'cash-reconciliation': {
    category: AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
    href: '/cash-settlements',
    label: 'Cash reconciliation',
    priority: 6,
  },
  'notification-failures': {
    category: AdminOperatorPermissionCategory.NOTIFICATIONS_DELIVERY,
    href: '/notifications?review=failed',
    label: 'Notification failures',
    priority: 7,
  },
} as const;

export type AdminOpenOperationsCaseQueueKey = keyof typeof ADMIN_OPEN_OPERATIONS_CASE_QUEUES;

export function adminOpenOperationsCaseQueue(value: string) {
  return value in ADMIN_OPEN_OPERATIONS_CASE_QUEUES
    ? ADMIN_OPEN_OPERATIONS_CASE_QUEUES[value as AdminOpenOperationsCaseQueueKey]
    : null;
}

export function adminStartShiftOpenCaseCtes(providerProductionDataSql: Prisma.Sql) {
  return Prisma.sql`
    ${cashSettlementDebtCteSql()},
    pending_cancellations AS (
      SELECT booking.id, booking."createdAt" AS "occurredAt"
      FROM "Booking" booking
      LEFT JOIN "ProviderEarning" earning ON earning."bookingId" = booking.id
      WHERE booking.status::text IN (${BookingStatus.CANCELLED}, ${BookingStatus.NO_SHOW})
        AND ${adminBookingProductionDataSql()}
        AND (booking."matchedAt" IS NOT NULL OR booking."selectedProviderId" IS NOT NULL)
        AND LOWER(COALESCE(booking."closedReason", '')) NOT LIKE '%approved%'
        AND LOWER(COALESCE(booking."closedReason", '')) NOT LIKE '%held%'
        AND LOWER(COALESCE(booking."closedReason", '')) NOT LIKE '%hold%'
        AND NOT (
          COALESCE(earning.status::text, '') = ${EarningStatus.CANCELLED}
          OR COALESCE(earning."netAmount", 1) = 0
        )
        AND NOT (
          booking.status::text = ${BookingStatus.CANCELLED}
          AND booking."matchedAt" IS NOT NULL
          AND COALESCE(booking."closedAt", booking."updatedAt", booking."createdAt") >= booking."matchedAt"
          AND COALESCE(booking."closedAt", booking."updatedAt", booking."createdAt")
            < booking."matchedAt" + (11 * INTERVAL '1 minute')
        )
    ),
    open_refunds AS (
      SELECT refund.id, refund."bookingId", refund.amount, refund."createdAt" AS "occurredAt"
      FROM "Refund" refund
      INNER JOIN "Booking" booking ON booking.id = refund."bookingId"
      WHERE ${adminBookingProductionDataSql()}
        AND UPPER(refund.status) IN (${Prisma.join(ADMIN_REFUND_ACTIVE_STATUSES)})
    ),
    unresolved_notification_failures AS (
      SELECT notification.id, notification."createdAt" AS "occurredAt"
      FROM "Notification" notification
      INNER JOIN "NotificationDelivery" delivery ON delivery."notificationId" = notification.id
      WHERE UPPER(delivery.status) = 'FAILED'
        AND ${adminNotificationProductionDataSql()}
        AND NOT EXISTS (
          SELECT 1 FROM "NotificationDelivery" success
          WHERE success."notificationId" = notification.id
            AND UPPER(success.status) IN ('SENT', 'DELIVERED', 'SUCCESS')
        )
      GROUP BY notification.id, notification."createdAt"
    ),
    action_items AS (
      SELECT
        'payment-holds'::text AS "key",
        booking.id::text AS "caseId",
        booking."updatedAt" AS "occurredAt",
        payment.amount::bigint AS amount
      FROM "Payment" payment
      INNER JOIN "Booking" booking ON booking.id = payment."bookingId"
      WHERE ${adminBookingProductionDataSql()}
        AND payment.status::text = ${PaymentStatus.AUTHORIZED}
      UNION ALL
      SELECT 'matching-delays', booking.id, booking."createdAt", 0::bigint
      FROM "Booking" booking
      WHERE booking.status::text = ${BookingStatus.OPEN_MATCHING}
        AND ${adminBookingProductionDataSql()}
        AND (
          booking."expiresAt" <= CURRENT_TIMESTAMP
          OR NOT EXISTS (
            SELECT 1 FROM "BookingParticipant" participant
            WHERE participant."bookingId" = booking.id
          )
        )
      UNION ALL
      SELECT 'cancellation-review', id, "occurredAt", 0::bigint
      FROM pending_cancellations
      UNION ALL
      SELECT 'refund-review', "bookingId", "occurredAt", amount::bigint
      FROM open_refunds
      UNION ALL
      SELECT DISTINCT 'partner-approvals', provider.id, provider."updatedAt", 0::bigint
      FROM "ProviderProfile" provider
      LEFT JOIN "ProviderVerification" verification ON verification."providerProfileId" = provider.id
      LEFT JOIN "ProviderKyc" kyc ON kyc."providerProfileId" = provider.id
      WHERE ${providerProductionDataSql}
        AND (
          verification.status::text = ${VerificationStatus.SUBMITTED}
          OR kyc.status::text = ${ProviderKycStatus.PENDING}
        )
      UNION ALL
      SELECT
        'cash-reconciliation',
        debt."bookingId",
        debt."createdAt",
        debt."remainingDebtAmount"
      FROM cash_settlement_debt debt
      WHERE debt."remainingDebtAmount" > 0
      UNION ALL
      SELECT 'notification-failures', id, "occurredAt", 0::bigint
      FROM unresolved_notification_failures
    )
  `;
}
