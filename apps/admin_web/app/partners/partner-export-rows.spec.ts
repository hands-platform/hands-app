import type { AdminProvider } from '../../lib/admin-api';
import type { ProviderFilters } from './partner-filters';
import { buildPartnerExportRows, PARTNER_EXPORT_COLUMNS } from './partner-export-rows';
import type { PartnerMasterRow } from './partner-master-row';
import type { PartnerOperationRow } from './partner-operation-row';

describe('partner export rows', () => {
  it('maps master and operations rows into stable CSV rows', () => {
    const rows = buildPartnerExportRows({
      filterLabel: 'Review: KYC',
      filters: filters({ q: 'linh', bookingFlow: 'first-pick', review: 'kyc', readiness: 'push' }),
      generatedAt: '2026-08-06T00:00:00.000Z',
      masterRows: [masterRow()],
      operationRows: [operationRow()],
      fallbackOperationRow: () => {
        throw new Error('fallback should not be called when operations row exists');
      },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        account_state: 'Open',
        booking_count: 7,
        completed_work_count: 4,
        display_name: 'Linh Wellness',
        export_filter: 'Review: KYC',
        export_row_count: 1,
        export_scope: 'Current page',
        export_sort: 'newest first',
        generated_at: '2026-08-06T00:00:00.000Z',
        joined_at: '2026-06-01T00:00:00.000Z',
        kyc_status: 'APPROVED',
        level: 'LEVEL_2_ACTIVE',
        location_state: 'recent',
        next_operator_action: 'Keep monitoring',
        next_operator_status: 'READY',
        partner_id: 'partner-1',
        recent_access_at: '2026-06-09T09:00:00.000Z',
        status: 'ONLINE_AVAILABLE',
        verification_status: 'APPROVED',
        wallet_balance_vnd: 0,
        withdrawal_status: 'NONE',
      }),
    ]);
    expect(PARTNER_EXPORT_COLUMNS).toEqual(
      expect.arrayContaining(['partner_id', 'display_name', 'wallet_balance_vnd', 'generated_at']),
    );
    expect(PARTNER_EXPORT_COLUMNS).not.toEqual(
      expect.arrayContaining([
        'phone',
        'latest_session_ip',
        'latest_session_device',
        'account_note',
        'latest_memo_detail',
      ]),
    );
  });

  it('uses the fallback operation builder when an operation row is missing', () => {
    const fallback = operationRow({
      acceptanceLabel: 'Repair',
      nextAction: {
        detail: 'Missing location',
        operatorAction: 'Ask Partner to reopen the app',
        priority: 80,
        status: 'LOCATION',
        tone: 'pending',
      },
    });

    const rows = buildPartnerExportRows({
      filterLabel: 'All partners',
      filters: filters(),
      generatedAt: '2026-08-06T00:00:00.000Z',
      masterRows: [masterRow()],
      operationRows: [],
      fallbackOperationRow: () => fallback,
    });

    expect(rows[0]?.next_operator_status).toBe('LOCATION');
    expect(rows[0]?.next_operator_action).toBe('Ask Partner to reopen the app');
  });
});

function filters(input: Partial<ProviderFilters> = {}): ProviderFilters {
  return {
    age: 'all',
    activity: '',
    approvalMissing: '',
    approvalRisk: '',
    bookingFlow: '',
    kyc: '',
    location: '',
    page: 1,
    pageSize: 10,
    providerStatus: '',
    q: '',
    readiness: '',
    review: '',
    security: '',
    sort: 'newest',
    verification: '',
    ...input,
  };
}

function provider(): AdminProvider {
  return {
    currentLocationUpdatedAt: '2026-06-09T08:00:00.000Z',
    displayName: 'Linh Wellness',
    id: 'partner-1',
    status: 'ONLINE_AVAILABLE',
    verification: { id: 'verification-1', status: 'APPROVED' },
  };
}

function masterRow(input: Partial<PartnerMasterRow> = {}): PartnerMasterRow {
  return {
    accountBlocked: false,
    accountNote: 'Normal account',
    appActivityStatus: 'active',
    appLastActiveAt: '2026-06-09T09:00:00.000Z',
    adminClosedCount: 1,
    approvalHoldReason: null,
    approvalIssues: [],
    approvalQueueIssues: [],
    approvalSubmittedAt: null,
    auditLogCount: 2,
    availablePayout: 220000,
    avatarStatus: 'online',
    bookingCount: 7,
    closedCount: 3,
    completedCount: 4,
    customerClosedCount: 1,
    displayName: 'Linh Wellness',
    gender: 'female',
    grossRevenue: 980000,
    initials: 'LW',
    joinedAt: '2026-06-01T00:00:00.000Z',
    kycStatus: 'APPROVED',
    lastSeenAt: '2026-06-09T09:00:00.000Z',
    latestAuditDetail: 'Checked onboarding',
    latestAuditTitle: 'provider.ops_note.add',
    latestSessionAppVersion: '1.2.3',
    latestSessionDevice: 'device-1',
    latestSessionIp: '127.0.0.1',
    latestSessionPlatform: 'android',
    legalName: 'Nguyen Thi Linh',
    level: 'LEVEL_2_ACTIVE',
    locationState: 'recent',
    noShowCount: 1,
    online: true,
    partnerClosedCount: 1,
    pendingPayout: 120000,
    phone: '+84900000000',
    platformFee: 120000,
    provider: provider(),
    reviewCount: 5,
    status: 'ONLINE_AVAILABLE',
    walletBalance: -50000,
    walletWithdrawalAdminActionCount: 0,
    walletWithdrawalLatestAmount: null,
    walletWithdrawalLatestStatus: 'NONE',
    walletWithdrawalOpenCount: 0,
    verificationStatus: 'APPROVED',
    ...input,
  };
}

function operationRow(input: Partial<PartnerOperationRow> = {}): PartnerOperationRow {
  return {
    acceptanceDetail: 'Ready for direct requests',
    acceptanceLabel: 'Ready',
    acceptanceTone: 'ok',
    avatarStatus: 'online',
    checklist: [],
    completedWorkCount: 4,
    lastActivityAt: '2026-06-09T09:00:00.000Z',
    lastWorkAt: '2026-06-08T09:00:00.000Z',
    locationState: 'recent',
    marketplaceAccessDetail: 'Can join marketplace',
    marketplaceAccessLabel: 'Marketplace ready',
    marketplaceAccessTone: 'ok',
    marketplaceCanParticipate: true,
    marketplaceCanReceiveAlerts: true,
    marketplaceCanView: true,
    marketplacePartnerAppMessage: null,
    matchingFlow: [],
    matchingFlowDetail: 'Direct and marketplace ready',
    name: 'Linh Wellness',
    nextAction: {
      detail: 'Ready',
      operatorAction: 'Keep monitoring',
      priority: 0,
      status: 'READY',
      tone: 'done',
    },
    phone: '+84900000000',
    provider: provider(),
    walletBalance: 0,
    ...input,
  };
}
