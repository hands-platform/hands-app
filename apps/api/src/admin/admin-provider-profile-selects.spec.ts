import {
  ADMIN_PROVIDER_COMPACT_LIST_LIMIT,
  ADMIN_PROVIDER_CONTROL_LIST_LIMIT,
  ADMIN_PROVIDER_DIRECTORY_LIST_LIMIT,
  ADMIN_PROVIDER_FILE_REVIEW_LIST_LIMIT,
  ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT,
  ADMIN_PROVIDER_OPERATIONS_HANDOFF_LIST_LIMIT,
  ADMIN_PROVIDER_OPERATIONS_POLICY_LIST_LIMIT,
  adminBookingDetailProviderSelect,
  adminLocationSnapshotSummarySelect,
  adminProviderDetailSelect,
  adminProviderDetailWithoutDiagnosticsSelect,
  adminProviderEvidenceDetailSelect,
  adminProviderFinanceDetailSelect,
  adminProviderDirectorySelect,
  adminProviderDirectoryUserSelect,
  adminProviderListBookingSelect,
  adminProviderListEarningSelect,
  adminProviderListParticipantSelect,
  adminProviderListSelect,
  adminProviderListUserSelect,
  adminProviderListWalletWithdrawalRequestSelect,
  adminProviderOverviewSelect,
  adminProviderPayoutBatchSummarySelect,
} from './admin-provider-profile-selects';
import { adminProviderPushDeviceReachabilityOrder } from './admin-provider-selects';

describe('admin provider profile selects', () => {
  it('keeps exported provider list limits stable', () => {
    expect(ADMIN_PROVIDER_COMPACT_LIST_LIMIT).toBe(50);
    expect(ADMIN_PROVIDER_DIRECTORY_LIST_LIMIT).toBe(50);
    expect(ADMIN_PROVIDER_FILE_REVIEW_LIST_LIMIT).toBe(50);
    expect(ADMIN_PROVIDER_OPERATIONS_HANDOFF_LIST_LIMIT).toBe(50);
    expect(ADMIN_PROVIDER_OPERATIONS_POLICY_LIST_LIMIT).toBe(50);
    expect(ADMIN_PROVIDER_CONTROL_LIST_LIMIT).toBe(50);
    expect(ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT).toBe(3);
  });

  it('keeps compact provider user rows media and device bounded', () => {
    expect(adminProviderListUserSelect.pushDevices).toMatchObject({ take: 2 });
    expect(adminProviderListUserSelect.pushDevices.orderBy).toEqual(
      adminProviderPushDeviceReachabilityOrder,
    );
    expect(adminProviderListUserSelect.fileAssets).toMatchObject({ take: 2 });
    expect(adminProviderListUserSelect.fileAssets.select).toEqual({
      id: true,
      key: true,
      url: true,
      contentType: true,
      purpose: true,
      visibility: true,
      uploadStatus: true,
      reviewStatus: true,
      reviewReason: true,
      uploadedAt: true,
      sizeBytes: true,
      createdAt: true,
    });
  });

  it('keeps partner directory identity rows limited to list-facing fields', () => {
    expect(adminProviderDirectoryUserSelect).toMatchObject({
      phone: true,
      fullName: true,
      createdAt: true,
      supabaseUserId: true,
      pushDevices: { take: 2 },
      fileAssets: { take: 2 },
    });
    expect(adminProviderDirectoryUserSelect).not.toHaveProperty('email');
    expect(adminProviderDirectoryUserSelect).not.toHaveProperty('roles');
    expect(adminProviderDirectorySelect).not.toHaveProperty('dateOfBirth');
    expect(adminProviderDirectorySelect).not.toHaveProperty('facebookId');
    expect(adminProviderDirectorySelect).not.toHaveProperty('bio');
    expect(adminProviderDirectorySelect).not.toHaveProperty('serviceArea');
    expect(adminProviderDirectorySelect).not.toHaveProperty('updatedAt');
  });

  it('keeps provider list booking and participant rows lightweight', () => {
    expect(adminProviderListBookingSelect).toMatchObject({
      id: true,
      status: true,
      scheduledStartAt: true,
      chatRoom: { select: { id: true, createdAt: true } },
    });
    expect(adminProviderListParticipantSelect.booking).toMatchObject({
      select: adminProviderListBookingSelect,
    });
  });

  it('keeps provider list financial and relation collections bounded', () => {
    expect(adminProviderListEarningSelect.booking).toMatchObject({
      select: { id: true, status: true, scheduledStartAt: true },
    });
    expect(adminProviderListWalletWithdrawalRequestSelect).toMatchObject({
      amount: true,
      currency: true,
      status: true,
      transferRef: true,
    });
    expect(adminProviderListSelect).toMatchObject({
      preferredBookings: { take: 15 },
      selectedBookings: { take: 15 },
      participants: { take: 15 },
      earnings: { take: 10 },
      walletWithdrawalRequests: { take: 3 },
    });
    expect(adminProviderDirectorySelect).toMatchObject({
      walletWithdrawalRequests: { take: 3 },
    });
  });

  it('keeps provider overview collections bounded for dashboard use', () => {
    expect(adminProviderOverviewSelect).toMatchObject({
      documents: { take: 12 },
      preferredBookings: { take: 5 },
      selectedBookings: { take: 5 },
      participants: { take: 5 },
      earnings: { take: 5 },
      payoutBatches: { take: 3 },
    });
  });

  it('keeps provider detail collections deeper but still bounded', () => {
    expect(adminProviderDetailSelect).toMatchObject({
      documents: { take: 50 },
      bankAccounts: { take: 10 },
      reports: { take: 20 },
      sanctions: { take: 20 },
      agreements: { take: 10 },
      preferredBookings: { take: 10 },
      selectedBookings: { take: 10 },
      participants: { take: 10 },
      locationSnapshots: { take: 10 },
      earnings: { take: 10 },
      payoutBatches: { take: 10 },
      verificationLogs: { take: 20 },
    });
    expect(adminProviderDetailSelect.bankAccounts.select).toMatchObject({
      createdAt: true,
      updatedAt: true,
    });
  });

  it('keeps provider detail diagnostics selectable only when requested', () => {
    expect(adminProviderDetailSelect).toMatchObject({
      devices: { take: 10 },
      sessions: { take: 10 },
    });
    expect(adminProviderDetailWithoutDiagnosticsSelect).not.toHaveProperty('devices');
    expect(adminProviderDetailWithoutDiagnosticsSelect).not.toHaveProperty('sessions');
    expect(adminProviderDetailWithoutDiagnosticsSelect).toMatchObject({
      documents: { take: 50 },
      bankAccounts: { take: 10 },
      reports: { take: 20 },
      sanctions: { take: 20 },
    });
  });

  it('keeps the partner finance detail select limited to money and payout evidence', () => {
    expect(adminProviderFinanceDetailSelect).toMatchObject({
      bankAccounts: { take: 10 },
      earnings: { take: 10 },
      payoutBatches: { take: 10 },
      taxProfile: { select: expect.any(Object) },
      verificationLogs: { take: 20 },
    });
    expect(adminProviderFinanceDetailSelect).not.toHaveProperty('documents');
    expect(adminProviderFinanceDetailSelect).not.toHaveProperty('preferredBookings');
    expect(adminProviderFinanceDetailSelect).not.toHaveProperty('selectedBookings');
    expect(adminProviderFinanceDetailSelect).not.toHaveProperty('participants');
    expect(adminProviderFinanceDetailSelect).not.toHaveProperty('devices');
    expect(adminProviderFinanceDetailSelect).not.toHaveProperty('sessions');
  });

  it('keeps the partner evidence detail select limited to approval evidence', () => {
    expect(adminProviderEvidenceDetailSelect).toMatchObject({
      agreements: { take: 10 },
      documents: { take: 50 },
      locationSnapshots: { take: 10 },
      services: { select: expect.any(Object) },
      verification: { select: expect.any(Object) },
      verificationLogs: { take: 20 },
    });
    expect(adminProviderEvidenceDetailSelect).not.toHaveProperty('earnings');
    expect(adminProviderEvidenceDetailSelect).not.toHaveProperty('payoutBatches');
    expect(adminProviderEvidenceDetailSelect).not.toHaveProperty('preferredBookings');
    expect(adminProviderEvidenceDetailSelect).not.toHaveProperty('selectedBookings');
    expect(adminProviderEvidenceDetailSelect).not.toHaveProperty('participants');
    expect(adminProviderEvidenceDetailSelect).not.toHaveProperty('devices');
    expect(adminProviderEvidenceDetailSelect).not.toHaveProperty('sessions');
  });

  it('keeps provider booking and payout summaries location/payment aware', () => {
    expect(adminLocationSnapshotSummarySelect).toMatchObject({
      addressText: true,
      lat: true,
      lng: true,
    });
    expect(adminBookingDetailProviderSelect).toMatchObject({
      city: true,
      residentialAddress: true,
      serviceArea: true,
    });
    expect(adminBookingDetailProviderSelect.locationSnapshots).toMatchObject({
      take: 1,
      select: adminLocationSnapshotSummarySelect,
    });
    expect(adminProviderPayoutBatchSummarySelect).toMatchObject({
      totalNetAmount: true,
      transferRef: true,
      paidAt: true,
    });
  });
});
