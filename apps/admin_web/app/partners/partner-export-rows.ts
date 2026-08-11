import type { AdminProvider } from '../../lib/admin-api';
import { partnerSortLabel, type ProviderFilters } from './partner-filters';
import type { PartnerMasterRow } from './partner-master-row';
import type { PartnerOperationRow } from './partner-operation-row';

export const PARTNER_EXPORT_COLUMNS = [
  'export_scope',
  'export_row_count',
  'export_filter',
  'export_sort',
  'generated_at',
  'partner_id',
  'display_name',
  'status',
  'level',
  'kyc_status',
  'verification_status',
  'joined_at',
  'recent_access_at',
  'location_state',
  'booking_count',
  'completed_work_count',
  'wallet_balance_vnd',
  'withdrawal_status',
  'next_operator_status',
  'next_operator_action',
  'account_state',
] as const;

export type PartnerExportColumn = (typeof PARTNER_EXPORT_COLUMNS)[number];
export type PartnerExportRow = Record<PartnerExportColumn, string | number>;

export type PartnerExportRowInput = {
  filterLabel: string;
  filters: ProviderFilters;
  generatedAt: string;
  masterRows: readonly PartnerMasterRow[];
  operationRows: readonly PartnerOperationRow[];
  fallbackOperationRow: (provider: AdminProvider) => PartnerOperationRow;
};

export function buildPartnerExportRows(input: PartnerExportRowInput): PartnerExportRow[] {
  return input.masterRows.map((master, index) => {
    const provider = master.provider;
    const operations = input.operationRows[index] ?? input.fallbackOperationRow(provider);

    return {
      export_scope: 'Current page',
      export_row_count: input.masterRows.length,
      export_filter: input.filterLabel,
      export_sort: partnerSortLabel(input.filters.sort),
      generated_at: input.generatedAt,
      partner_id: provider.id,
      display_name: master.displayName,
      status: master.status,
      level: master.level,
      kyc_status: master.kycStatus,
      verification_status: provider.verification?.status ?? 'DRAFT',
      joined_at: master.joinedAt ?? '',
      recent_access_at: master.lastSeenAt ?? '',
      location_state: master.locationState,
      booking_count: master.bookingCount,
      completed_work_count: master.completedCount,
      wallet_balance_vnd: operations.walletBalance,
      withdrawal_status: master.walletWithdrawalLatestStatus,
      next_operator_status: operations.nextAction.status,
      next_operator_action: operations.nextAction.operatorAction,
      account_state: master.accountBlocked ? 'Blocked' : 'Open',
    };
  });
}
