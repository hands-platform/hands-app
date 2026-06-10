import type { AdminProvider } from '../../lib/admin-api';
import {
  partnerBookingFlowFilterLabel,
  partnerReviewFilterLabel,
  partnerSortLabel,
  type ProviderFilters,
} from './partner-filters';
import type { PartnerMasterRow } from './partner-master-row';
import type { PartnerOperationRow } from './partner-operation-row';

export const PARTNER_EXPORT_COLUMNS = [
  'export_filter',
  'export_sort',
  'search_filter',
  'booking_flow_filter',
  'review_filter',
  'readiness_filter',
  'partner_id',
  'display_name',
  'legal_name',
  'phone',
  'gender',
  'status',
  'level',
  'kyc_status',
  'verification_status',
  'joined_at',
  'recent_access_at',
  'latest_session_device',
  'latest_session_platform',
  'latest_session_ip',
  'latest_session_app_version',
  'location_state',
  'location_updated_at',
  'booking_count',
  'completed_work_count',
  'closed_booking_count',
  'customer_closed_count',
  'admin_closed_count',
  'partner_closed_count',
  'no_show_count',
  'feedback_record_count',
  'gross_revenue_vnd',
  'platform_fee_vnd',
  'pending_payout_vnd',
  'available_payout_vnd',
  'wallet_balance_vnd',
  'can_accept_booking',
  'acceptance_detail',
  'can_view_marketplace_requests',
  'can_receive_marketplace_alerts',
  'can_participate_marketplace',
  'marketplace_partner_app_message',
  'next_operator_status',
  'next_operator_action',
  'admin_memo_count',
  'latest_memo',
  'latest_memo_detail',
  'account_state',
  'account_note',
] as const;

export type PartnerExportColumn = (typeof PARTNER_EXPORT_COLUMNS)[number];
export type PartnerExportRow = Record<PartnerExportColumn, string | number>;

export type PartnerExportRowInput = {
  filterLabel: string;
  filters: ProviderFilters;
  masterRows: readonly PartnerMasterRow[];
  operationRows: readonly PartnerOperationRow[];
  fallbackOperationRow: (provider: AdminProvider) => PartnerOperationRow;
};

export function buildPartnerExportRows(input: PartnerExportRowInput): PartnerExportRow[] {
  return input.masterRows.map((master, index) => {
    const provider = master.provider;
    const operations = input.operationRows[index] ?? input.fallbackOperationRow(provider);

    return {
      export_filter: input.filterLabel,
      export_sort: partnerSortLabel(input.filters.sort),
      search_filter: input.filters.q ? 'Applied' : 'None',
      booking_flow_filter: input.filters.bookingFlow
        ? partnerBookingFlowFilterLabel(input.filters.bookingFlow)
        : 'All',
      review_filter: input.filters.review ? partnerReviewFilterLabel(input.filters.review) : 'All',
      readiness_filter: input.filters.readiness || 'All',
      partner_id: provider.id,
      display_name: master.displayName,
      legal_name: master.legalName,
      phone: master.phone,
      gender: master.gender,
      status: master.status,
      level: master.level,
      kyc_status: master.kycStatus,
      verification_status: provider.verification?.status ?? 'DRAFT',
      joined_at: master.joinedAt ?? '',
      recent_access_at: master.lastSeenAt ?? '',
      latest_session_device: master.latestSessionDevice,
      latest_session_platform: master.latestSessionPlatform,
      latest_session_ip: master.latestSessionIp,
      latest_session_app_version: master.latestSessionAppVersion,
      location_state: master.locationState,
      location_updated_at: provider.currentLocationUpdatedAt ?? '',
      booking_count: master.bookingCount,
      completed_work_count: master.completedCount,
      closed_booking_count: master.closedCount,
      customer_closed_count: master.customerClosedCount,
      admin_closed_count: master.adminClosedCount,
      partner_closed_count: master.partnerClosedCount,
      no_show_count: master.noShowCount,
      feedback_record_count: master.reviewCount,
      gross_revenue_vnd: master.grossRevenue,
      platform_fee_vnd: master.platformFee,
      pending_payout_vnd: master.pendingPayout,
      available_payout_vnd: master.availablePayout,
      wallet_balance_vnd: operations.walletBalance,
      can_accept_booking: operations.acceptanceLabel,
      acceptance_detail: operations.acceptanceDetail,
      can_view_marketplace_requests: operations.marketplaceCanView ? 'yes' : 'no',
      can_receive_marketplace_alerts: operations.marketplaceCanReceiveAlerts ? 'yes' : 'no',
      can_participate_marketplace: operations.marketplaceCanParticipate ? 'yes' : 'no',
      marketplace_partner_app_message: operations.marketplacePartnerAppMessage ?? '',
      next_operator_status: operations.nextAction.status,
      next_operator_action: operations.nextAction.operatorAction,
      admin_memo_count: master.auditLogCount,
      latest_memo: master.latestAuditTitle,
      latest_memo_detail: master.latestAuditDetail,
      account_state: master.accountBlocked ? 'Blocked' : 'Open',
      account_note: master.accountNote,
    };
  });
}
