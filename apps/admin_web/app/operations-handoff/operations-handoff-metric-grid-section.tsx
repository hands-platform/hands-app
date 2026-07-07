import { AdminMetricGrid } from '../../components/admin-page-template';
import { MoneyText } from '../../components/money-text';
import type { AdminCashSettlementSummary } from '../../lib/admin-api';

type OperationsHandoffMetricGridSectionProps = {
  readonly activeBookingCount: number;
  readonly matchingBookingCount: number;
  readonly inServiceBookingCount: number;
  readonly canViewAppSessionDiagnostics?: boolean;
  readonly cashSummary: AdminCashSettlementSummary;
  readonly presence: {
    readonly customerLive: number;
    readonly customerRecent: number;
    readonly partnerLive: number;
    readonly partnerRecent: number;
  };
  readonly chatSignals: {
    readonly roomCount: number;
    readonly recentMessageCount: number;
  };
  readonly failedNotificationCount: number;
  readonly latestFcmSent: {
    readonly helper: string;
    readonly href: string;
    readonly value: string;
  } | null;
};

export function OperationsHandoffMetricGridSection({
  activeBookingCount,
  matchingBookingCount,
  inServiceBookingCount,
  canViewAppSessionDiagnostics = false,
  cashSummary,
  presence,
  chatSignals,
  failedNotificationCount,
  latestFcmSent,
}: OperationsHandoffMetricGridSectionProps) {
  return (
    <AdminMetricGrid
      ariaLabel="Operations handoff metrics"
      className="admin-mt-16 admin-mb-16"
      metrics={[
        {
          label: 'Active bookings',
          value: activeBookingCount,
          helper: 'Matching, on the way, arrived, or in service',
          href: '/bookings?view=attention',
        },
        {
          label: 'Matching wait',
          value: matchingBookingCount,
          helper: 'Customer can still receive marketplace participants',
          href: '/bookings?view=matching',
        },
        {
          label: 'In service',
          value: inServiceBookingCount,
          helper: 'Chat should be live until Partner completion',
          href: '/bookings?view=closeout',
        },
        {
          label: 'Cash fee debt',
          value: cashSummary.providerCount,
          helper: (
            <>
              <MoneyText amount={cashSummary.totalDebtAmount} currency={cashSummary.currency} /> across Partner wallet gates
            </>
          ),
          href: '/cash-settlements',
        },
        {
          label: 'Customer app online',
          value: presence.customerLive,
          helper: `${presence.customerRecent} customer session(s) seen recently`,
          href: canViewAppSessionDiagnostics ? '/app-sessions?role=CUSTOMER&state=live' : undefined,
        },
        {
          label: 'Partner app online',
          value: presence.partnerLive,
          helper: `${presence.partnerRecent} Partner session(s) seen recently`,
          href: canViewAppSessionDiagnostics ? '/app-sessions?role=PROVIDER&state=live' : undefined,
        },
        {
          label: 'Chat rooms',
          value: chatSignals.roomCount,
          helper: `${chatSignals.recentMessageCount} recent message(s) visible to admin`,
          href: '/chat-archive',
        },
        {
          label: 'Failed notifications',
          value: failedNotificationCount,
          helper: 'Push/SMS/app delivery rows needing retry or device check',
          href: '/notifications?review=failed',
        },
        {
          label: 'Recent FCM sent',
          value: latestFcmSent?.value ?? 'No send',
          helper: latestFcmSent?.helper ?? 'No FCM SENT delivery recorded yet',
          href: latestFcmSent?.href ?? '/notifications?review=fcm',
        },
      ]}
    />
  );
}
