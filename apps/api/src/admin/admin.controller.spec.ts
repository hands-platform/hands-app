import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ReferralRewardMode, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';

describe('AdminController notification and push actions', () => {
  const admin = {
    enablePushDevice: vi.fn(),
    listFileReviewItems: vi.fn(),
    listFileReviewProviders: vi.fn(),
    fileReviewSummary: vi.fn(),
    getMarketingOverview: vi.fn(),
    getMarketingCouponSummary: vi.fn(),
    getPartnerOverview: vi.fn(),
    getCustomerDetail: vi.fn(),
    getCustomerWalletLedger: vi.fn(),
    getProviderDetail: vi.fn(),
    getProviderOverview: vi.fn(),
    listMarketingDimensionRows: vi.fn(),
    listMarketingCouponPerformance: vi.fn(),
    getMarketingSummary: vi.fn(),
    getUsageOverview: vi.fn(),
    getVietnamOverview: vi.fn(),
    getVietnamOverviewRealtimePoints: vi.fn(),
    getVietnamOverviewSummary: vi.fn(),
    listServices: vi.fn(),
    getBookingDetail: vi.fn(),
    getCustomerReferralParent: vi.fn(),
    getPartnerReferralParent: vi.fn(),
    listReferralCashoutQueue: vi.fn(),
    referralCashoutQueueSummary: vi.fn(),
    customerReferralParentSummary: vi.fn(),
    partnerReferralParentSummary: vi.fn(),
    listCustomerReferralParents: vi.fn(),
    listPartnerReferralParents: vi.fn(),
    listReferralPolicies: vi.fn(),
    listOperationsHandoffProviders: vi.fn(),
    operationsHandoffActivityPage: vi.fn(),
    listOperationsHandoffOpenCases: vi.fn(),
    listOperationsHandoffOperators: vi.fn(),
    listOperationsShiftHandoffs: vi.fn(),
    createOperationsShiftHandoff: vi.fn(),
    acknowledgeOperationsShiftHandoff: vi.fn(),
    listOperationsPolicyProviders: vi.fn(),
    listOperationalPolicySettings: vi.fn(),
    listAuditLogs: vi.fn(),
    listAuditLogPage: vi.fn(),
    auditLogSummary: vi.fn(),
    listUsers: vi.fn(),
    listAdminCalendarEvents: vi.fn(),
    createAdminCalendarEvent: vi.fn(),
    updateAdminCalendarEvent: vi.fn(),
    deleteAdminCalendarEvent: vi.fn(),
    createAdminOperator: vi.fn(),
    getAdminOperatorAccess: vi.fn(),
    recordAdminOperatorActivity: vi.fn(),
    updateAdminOperatorAccess: vi.fn(),
    revokeAdminOperatorAccess: vi.fn(),
    updateUserFinanceApproverRole: vi.fn(),
    listNotifications: vi.fn(),
    notificationSummary: vi.fn(),
    listProviderReports: vi.fn(),
    listProviderSanctions: vi.fn(),
    listReviews: vi.fn(),
    getReview: vi.fn(),
    createManualPartnerReview: vi.fn(),
    reviewSummary: vi.fn(),
    listPartnerCustomerReviews: vi.fn(),
    partnerCustomerReviewSummary: vi.fn(),
    getPartnerCustomerReview: vi.fn(),
    moderatePartnerCustomerReview: vi.fn(),
    listNotificationTemplates: vi.fn(),
    listPartnerControlProviders: vi.fn(),
    partnerControlSummary: vi.fn(),
    listPartnerDirectoryProviders: vi.fn(),
    partnerDirectorySummary: vi.fn(),
    listAdminPushCampaigns: vi.fn(),
    adminPushCampaignSummary: vi.fn(),
    listPaymentCallbackAttempts: vi.fn(),
    listPayments: vi.fn(),
    paymentSummary: vi.fn(),
    listRefunds: vi.fn(),
    refundQueueMeta: vi.fn(),
    refundSummary: vi.fn(),
    financeOverviewSummary: vi.fn(),
    financeApprovalQueue: vi.fn(),
    listEarnings: vi.fn(),
    earningsSummary: vi.fn(),
    listCashSettlementEarnings: vi.fn(),
    cashSettlementEarningDetail: vi.fn(),
    cashSettlementSummary: vi.fn(),
    previewManualWalletAdjustment: vi.fn(),
    createManualWalletAdjustment: vi.fn(),
    approveManualWalletAdjustmentFromLegacyRoute: vi.fn(),
    createManualWalletAdjustmentRequest: vi.fn(),
    listManualWalletAdjustmentRequests: vi.fn(),
    manualWalletAdjustmentRequestSummary: vi.fn(),
    approveManualWalletAdjustmentRequest: vi.fn(),
    cancelStaleManualWalletAdjustmentRequest: vi.fn(),
    rejectManualWalletAdjustmentRequest: vi.fn(),
    listManualWalletAdjustments: vi.fn(),
    manualWalletAdjustmentSummary: vi.fn(),
    approvePartnerBankDepositFromLegacyRoute: vi.fn(),
    createPartnerBankDepositRequest: vi.fn(),
    listPartnerBankDepositRequests: vi.fn(),
    listPartnerBankDepositRequestHistory: vi.fn(),
    partnerBankDepositReconciliationOwnerSummary: vi.fn(),
    getPartnerBankDepositRequestDetail: vi.fn(),
    approvePartnerBankDepositRequest: vi.fn(),
    rejectPartnerBankDepositRequest: vi.fn(),
    allocatePartnerBankDepositCashDebt: vi.fn(),
    listProviderWalletWithdrawalRequests: vi.fn(),
    providerWalletWithdrawalRequestSummary: vi.fn(),
    listBookingSettlementGaps: vi.fn(),
    bookingSettlementGapSummary: vi.fn(),
    bookingSettlementGapDryRun: vi.fn(),
    previewBookingSettlementGapRepair: vi.fn(),
    previewBookingSettlementGapRepairs: vi.fn(),
    verifyBookingSettlementRepair: vi.fn(),
    repairBookingSettlementGap: vi.fn(),
    listBookingSettlementSnapshots: vi.fn(),
    getBookingSettlementSnapshot: vi.fn(),
    bookingSettlementSnapshotSummary: vi.fn(),
    listBookingSettlementReversals: vi.fn(),
    getBookingSettlementReversal: vi.fn(),
    bookingSettlementReversalSummary: vi.fn(),
    listCouponFinanceSnapshots: vi.fn(),
    couponFinanceSummary: vi.fn(),
    listPartnerWithholdingTax: vi.fn(),
    partnerWithholdingTaxSummary: vi.fn(),
    listMonthlyTaxClosings: vi.fn(),
    monthlyTaxClosingSummary: vi.fn(),
    updateMonthlyTaxClosingStatus: vi.fn(),
    platformVatSummary: vi.fn(),
    paymentFeeSummary: vi.fn(),
    listAccountingJournalBatches: vi.fn(),
    accountingJournalBatchSummary: vi.fn(),
    accountingJournalBatchDetail: vi.fn(),
    listBookingPaymentClearingEntries: vi.fn(),
    bookingPaymentClearingSummary: vi.fn(),
    bookingPaymentClearingReviewOwnerSummary: vi.fn(),
    bookingPaymentClearingEntryDetail: vi.fn(),
    assignBookingPaymentClearingReview: vi.fn(),
    assignBookingPaymentClearingReviews: vi.fn(),
    listCompanyBankAccounts: vi.fn(),
    createCompanyBankAccount: vi.fn(),
    updateCompanyBankAccount: vi.fn(),
    decideCompanyBankAccountChange: vi.fn(),
    listBankReconciliationTransactions: vi.fn(),
    bankReconciliationSummary: vi.fn(),
    bankReconciliationEvidenceSourceSummary: vi.fn(),
    bankReconciliationReviewOwnerSummary: vi.fn(),
    bankReconciliationWithdrawalCandidateSummary: vi.fn(),
    companyBankTransactionImportBatchSummary: vi.fn(),
    listCompanyBankTransactionImportBatches: vi.fn(),
    companyBankTransactionImportBatchDetail: vi.fn(),
    assignCompanyBankTransactionImportBatch: vi.fn(),
    assignCompanyBankTransactionReview: vi.fn(),
    assignCompanyBankTransactionReviews: vi.fn(),
    assignPartnerBankDepositReconciliationReview: vi.fn(),
    assignPartnerBankDepositReconciliationReviews: vi.fn(),
    bankReconciliationTransactionDetail: vi.fn(),
    createCompanyBankTransaction: vi.fn(),
    previewCompanyBankTransactionBatch: vi.fn(),
    importCompanyBankTransactionBatch: vi.fn(),
    createBankReconciliationMatch: vi.fn(),
    reverseBankReconciliationMatch: vi.fn(),
    ignoreCompanyBankTransaction: vi.fn(),
    listPayoutBatches: vi.fn(),
    payoutBatchSummary: vi.fn(),
    previewAdminPushCampaign: vi.fn(),
    createAdminPushCampaign: vi.fn(),
    customerSummary: vi.fn(),
    approveReferralRewardCashout: vi.fn(),
    creditReferralReward: vi.fn(),
    holdReferralReward: vi.fn(),
    listCustomers: vi.fn(),
    markReferralRewardCashoutPaid: vi.fn(),
    releaseAvailableReferralRewards: vi.fn(),
    requireReferralRewardTaxReview: vi.fn(),
    reverseReferralReward: vi.fn(),
    deleteCoupon: vi.fn(),
    createCouponBatch: vi.fn(),
    getCoupon: vi.fn(),
    listCoupons: vi.fn(),
    couponSummary: vi.fn(),
    listCouponUsageBookings: vi.fn(),
    retryNotification: vi.fn(),
    reviewLegacyNotification: vi.fn(),
    updateNotificationTemplate: vi.fn(),
    updateReferralPolicy: vi.fn(),
    getMarketingSpendDaily: vi.fn(),
    upsertMarketingSpendDaily: vi.fn(),
    listAppSessions: vi.fn(),
    appSessionSummary: vi.fn(),
    startShiftSummary: vi.fn(),
    listChatArchive: vi.fn(),
    chatArchiveSummary: vi.fn(),
    listBookingNotifications: vi.fn(),
    listBookingChatMessages: vi.fn(),
    listBookingMarketplaceProviders: vi.fn(),
  };
  const controller = new AdminController(admin as unknown as AdminService);
  const user = { id: 'admin-1', roles: [Role.ADMIN] } as AuthenticatedUser;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the push device compatibility POST route fail-closed', async () => {
    admin.enablePushDevice.mockResolvedValue({ ok: true, pushDeviceId: 'push-device-1' });

    await expect(controller.enablePushDevice('push-device-1')).resolves.toEqual({
      ok: true,
      pushDeviceId: 'push-device-1',
    });

    expect(routeMetadata('enablePushDevice')).toEqual({
      method: RequestMethod.POST,
      path: 'push-devices/:id/enable',
    });
    expect(admin.enablePushDevice).toHaveBeenCalledWith('push-device-1');
  });

  it('exposes notification retry as a POST action and delegates with actor id', async () => {
    admin.retryNotification.mockResolvedValue({ ok: true, notificationId: 'notification-1' });

    await expect(
      controller.retryNotification(user, 'notification-1', {
        reason: 'Retry unresolved mobile paths',
      }),
    ).resolves.toEqual({
      ok: true,
      notificationId: 'notification-1',
    });

    expect(routeMetadata('retryNotification')).toEqual({
      method: RequestMethod.POST,
      path: 'notifications/:id/retry',
    });
    expect(admin.retryNotification).toHaveBeenCalledWith(
      'admin-1',
      'notification-1',
      'Retry unresolved mobile paths',
    );
  });

  it('exposes legacy notification review as an audited POST action', async () => {
    admin.reviewLegacyNotification.mockResolvedValue({
      incidentStatus: 'LEGACY_REVIEWED',
      notificationId: 'notification-1',
      ok: true,
    });

    await expect(
      controller.reviewLegacyNotification(user, 'notification-1', {
        reason: 'Reviewed the retained background job evidence.',
      }),
    ).resolves.toMatchObject({
      incidentStatus: 'LEGACY_REVIEWED',
      notificationId: 'notification-1',
      ok: true,
    });

    expect(routeMetadata('reviewLegacyNotification')).toEqual({
      method: RequestMethod.POST,
      path: 'notifications/:id/review-legacy',
    });
    expect(admin.reviewLegacyNotification).toHaveBeenCalledWith(
      'admin-1',
      'notification-1',
      'Reviewed the retained background job evidence.',
    );
  });

  it('exposes notifications as a bounded board list', async () => {
    admin.listNotifications.mockResolvedValue([{ id: 'notification-1' }]);

    await expect(
      controller.notifications(
        '25',
        '40',
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'system-incidents',
        'booking-1',
        undefined,
        'open',
      ),
    ).resolves.toEqual([{ id: 'notification-1' }]);

    expect(routeMetadata('notifications')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications',
    });
    expect(admin.listNotifications).toHaveBeenCalledWith({
      from: '2026-06-27T00:00:00.000Z',
      booking: 'booking-1',
      incidentState: 'open',
      review: 'system-incidents',
      skip: '40',
      take: '25',
      to: '2026-06-28T00:00:00.000Z',
    });
  });

  it('exposes operations calendar events with bounded list and author-aware mutations', async () => {
    admin.listAdminCalendarEvents.mockResolvedValue([{ id: 'calendar-1' }]);
    admin.createAdminCalendarEvent.mockResolvedValue({ id: 'calendar-2' });
    admin.updateAdminCalendarEvent.mockResolvedValue({ id: 'calendar-1' });
    admin.deleteAdminCalendarEvent.mockResolvedValue({ ok: true, id: 'calendar-1' });

    await expect(
      controller.calendarEvents('2026-07-01T00:00:00.000Z', '2026-07-31T23:59:59.999Z', '50', '200'),
    ).resolves.toEqual([{ id: 'calendar-1' }]);
    await expect(
      controller.createCalendarEvent(user, {
        end: '2026-07-01T10:00:00.000Z',
        start: '2026-07-01T09:00:00.000Z',
        title: 'Ops watch',
      }),
    ).resolves.toEqual({ id: 'calendar-2' });
    await expect(controller.updateCalendarEvent(user, 'calendar-1', { title: 'Updated' })).resolves.toEqual({
      id: 'calendar-1',
    });
    await expect(
      controller.deleteCalendarEvent(user, 'calendar-1', { operatorIdentity: 'ops@hands.vn' }),
    ).resolves.toEqual({ ok: true, id: 'calendar-1' });

    expect(routeMetadata('calendarEvents')).toEqual({
      method: RequestMethod.GET,
      path: 'calendar-events',
    });
    expect(routeMetadata('createCalendarEvent')).toEqual({
      method: RequestMethod.POST,
      path: 'calendar-events',
    });
    expect(routeMetadata('updateCalendarEvent')).toEqual({
      method: RequestMethod.PATCH,
      path: 'calendar-events/:id',
    });
    expect(routeMetadata('deleteCalendarEvent')).toEqual({
      method: RequestMethod.DELETE,
      path: 'calendar-events/:id',
    });
    expect(admin.listAdminCalendarEvents).toHaveBeenCalledWith({
      from: '2026-07-01T00:00:00.000Z',
      skip: '200',
      take: '50',
      to: '2026-07-31T23:59:59.999Z',
    });
    expect(admin.createAdminCalendarEvent).toHaveBeenCalledWith('admin-1', {
      end: '2026-07-01T10:00:00.000Z',
      start: '2026-07-01T09:00:00.000Z',
      title: 'Ops watch',
    });
    expect(admin.updateAdminCalendarEvent).toHaveBeenCalledWith('admin-1', 'calendar-1', {
      title: 'Updated',
    });
    expect(admin.deleteAdminCalendarEvent).toHaveBeenCalledWith('admin-1', 'calendar-1', {
      operatorIdentity: 'ops@hands.vn',
    });
  });

  it('keeps the legacy partner bank deposit POST as a persisted-request approval compatibility route', async () => {
    admin.approvePartnerBankDepositFromLegacyRoute.mockResolvedValue({ id: 'wallet-deposit-1' });

    await expect(
      controller.recordPartnerBankDeposit(user, {
        providerProfileId: 'provider-1',
        amount: 1000000,
        bankTransactionId: 'BIDV-20260629-001',
        depositDate: '2026-06-29T09:30:00.000Z',
        attachmentFileId: 'file-deposit-proof-1',
        approvalAdminId: 'finance-admin-2',
      }),
    ).resolves.toEqual({ id: 'wallet-deposit-1' });

    expect(routeMetadata('recordPartnerBankDeposit')).toEqual({
      method: RequestMethod.POST,
      path: 'provider-wallet/deposits',
    });
    expect(admin.approvePartnerBankDepositFromLegacyRoute).toHaveBeenCalledWith('admin-1', {
      providerProfileId: 'provider-1',
      amount: 1000000,
      bankTransactionId: 'BIDV-20260629-001',
      depositDate: '2026-06-29T09:30:00.000Z',
      attachmentFileId: 'file-deposit-proof-1',
      approvalAdminId: 'finance-admin-2',
    });
    expect(Reflect.getMetadata(HEADERS_METADATA, AdminController.prototype.recordPartnerBankDeposit)).toEqual(
      expect.arrayContaining([
        { name: 'X-HANDS-Deprecated', value: 'true' },
        {
          name: 'X-HANDS-Successor-Path',
          value: '/api/admin/provider-wallet/deposit-requests',
        },
      ]),
    );
  });

  it('exposes persistent partner bank deposit request and decision routes', async () => {
    const payload = {
      providerProfileId: 'provider-1',
      amount: 1000000,
      bankTransactionId: 'BIDV-20260629-001',
      depositDate: '2026-06-29T09:30:00.000Z',
      attachmentFileId: 'file-deposit-proof-1',
    };
    admin.createPartnerBankDepositRequest.mockResolvedValue({ id: 'deposit-request-1' });
    admin.approvePartnerBankDepositRequest.mockResolvedValue({ request: { id: 'deposit-request-1' } });
    admin.rejectPartnerBankDepositRequest.mockResolvedValue({ id: 'deposit-request-1' });
    admin.allocatePartnerBankDepositCashDebt.mockResolvedValue({ id: 'allocation-1' });

    await controller.createPartnerBankDepositRequest(user, payload);
    await controller.approvePartnerBankDepositRequest(user, 'deposit-request-1');
    await controller.rejectPartnerBankDepositRequest(user, 'deposit-request-1', {
      reason: 'Evidence mismatch',
    });
    await controller.allocatePartnerBankDepositCashDebt(user, 'deposit-request-1', {
      earningId: 'earning-1',
      amount: 170000,
      notes: 'Deposit evidence allocated',
    });

    expect(routeMetadata('createPartnerBankDepositRequest')).toEqual({
      method: RequestMethod.POST,
      path: 'provider-wallet/deposit-requests',
    });
    expect(routeMetadata('approvePartnerBankDepositRequest')).toEqual({
      method: RequestMethod.POST,
      path: 'provider-wallet/deposit-requests/:id/approve',
    });
    expect(routeMetadata('rejectPartnerBankDepositRequest')).toEqual({
      method: RequestMethod.POST,
      path: 'provider-wallet/deposit-requests/:id/reject',
    });
    expect(routeMetadata('allocatePartnerBankDepositCashDebt')).toEqual({
      method: RequestMethod.POST,
      path: 'provider-wallet/deposit-requests/:id/cash-debt-allocations',
    });
    expect(admin.createPartnerBankDepositRequest).toHaveBeenCalledWith('admin-1', payload);
    expect(admin.approvePartnerBankDepositRequest).toHaveBeenCalledWith('admin-1', 'deposit-request-1');
    expect(admin.rejectPartnerBankDepositRequest).toHaveBeenCalledWith(
      'admin-1',
      'deposit-request-1',
      'Evidence mismatch',
    );
    expect(admin.allocatePartnerBankDepositCashDebt).toHaveBeenCalledWith('admin-1', 'deposit-request-1', {
      earningId: 'earning-1',
      amount: 170000,
      notes: 'Deposit evidence allocated',
    });
  });

  it('keeps the legacy wallet adjustment POST as a persisted-request approval compatibility route', async () => {
    const payload = {
      ownerType: 'PARTNER',
      ownerId: 'provider-1',
      direction: 'CREDIT',
      adjustmentType: 'PARTNER_BONUS',
      amount: 200000,
      reason: 'Manual partner bonus',
      approvalId: 'approval-1',
    };
    admin.previewManualWalletAdjustment.mockResolvedValue({ afterBalance: 200000 });
    admin.approveManualWalletAdjustmentFromLegacyRoute.mockResolvedValue({ ledger: { id: 'ledger-1' } });

    await expect(controller.previewManualWalletAdjustment(user, payload)).resolves.toEqual({
      afterBalance: 200000,
    });
    await expect(controller.createManualWalletAdjustment(user, payload)).resolves.toEqual({
      ledger: { id: 'ledger-1' },
    });

    expect(routeMetadata('previewManualWalletAdjustment')).toEqual({
      method: RequestMethod.POST,
      path: 'wallet-adjustments/preview',
    });
    expect(routeMetadata('createManualWalletAdjustment')).toEqual({
      method: RequestMethod.POST,
      path: 'wallet-adjustments',
    });
    expect(
      Reflect.getMetadata(HEADERS_METADATA, AdminController.prototype.createManualWalletAdjustment),
    ).toEqual(
      expect.arrayContaining([
        { name: 'X-HANDS-Deprecated', value: 'true' },
        {
          name: 'X-HANDS-Successor-Path',
          value: '/api/admin/wallet-adjustment-requests',
        },
      ]),
    );
    expect(admin.previewManualWalletAdjustment).toHaveBeenCalledWith('admin-1', payload);
    expect(admin.approveManualWalletAdjustmentFromLegacyRoute).toHaveBeenCalledWith('admin-1', payload);
    expect(admin.createManualWalletAdjustment).not.toHaveBeenCalled();
  });

  it('exposes Finance Overview as a bounded read-only summary endpoint', async () => {
    admin.financeOverviewSummary.mockResolvedValue({
      generatedAt: '2026-07-02T00:00:00.000Z',
      range: '7d',
      period: '2026-07',
    });

    await expect(controller.financeOverviewSummary('7d', '2026-07')).resolves.toEqual({
      generatedAt: '2026-07-02T00:00:00.000Z',
      range: '7d',
      period: '2026-07',
    });

    expect(routeMetadata('financeOverviewSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'finance-overview',
    });
    expect(admin.financeOverviewSummary).toHaveBeenCalledWith({ period: '2026-07', range: '7d' });
  });

  it('exposes the bounded Finance Approval Queue', async () => {
    admin.financeApprovalQueue.mockResolvedValue({ limit: 10, paymentFeePolicyRequests: [] });

    await expect(controller.financeApprovalQueue(
      '25',
      'stale',
      'refunds',
      'state-mismatch',
      '2',
      'refund-focus-1',
    )).resolves.toEqual({
      limit: 10,
      paymentFeePolicyRequests: [],
    });

    expect(routeMetadata('financeApprovalQueue')).toEqual({
      method: RequestMethod.GET,
      path: 'finance-approval-queue',
    });
    expect(admin.financeApprovalQueue).toHaveBeenCalledWith({
      take: '25',
      page: '2',
      requestId: 'refund-focus-1',
      review: 'state-mismatch',
      view: 'refunds',
      walletReview: 'stale',
    });
  });

  it('exposes manual wallet adjustment history with owner filtering', async () => {
    admin.listManualWalletAdjustments.mockResolvedValue([{ id: 'ledger-1' }]);

    await expect(
      (controller.manualWalletAdjustments as (...args: string[]) => Promise<unknown>)(
        '25',
        'PARTNER',
        'provider-1',
        '50',
      ),
    ).resolves.toEqual([{ id: 'ledger-1' }]);

    expect(routeMetadata('manualWalletAdjustments')).toEqual({
      method: RequestMethod.GET,
      path: 'wallet-adjustments',
    });
    expect(admin.listManualWalletAdjustments).toHaveBeenCalledWith({
      ownerId: 'provider-1',
      ownerType: 'PARTNER',
      skip: '50',
      take: '25',
    });
  });

  it('exposes manual wallet adjustment summary with owner filtering', async () => {
    admin.manualWalletAdjustmentSummary.mockResolvedValue({ total: 12 });

    await expect(controller.manualWalletAdjustmentSummary('PARTNER', 'provider-1')).resolves.toEqual({
      total: 12,
    });

    expect(routeMetadata('manualWalletAdjustmentSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'wallet-adjustments/summary',
    });
    expect(admin.manualWalletAdjustmentSummary).toHaveBeenCalledWith({
      ownerId: 'provider-1',
      ownerType: 'PARTNER',
    });
  });

  it('exposes persistent manual wallet adjustment request actions', async () => {
    const payload = {
      ownerType: 'PARTNER' as const,
      ownerId: 'provider-1',
      direction: 'CREDIT' as const,
      adjustmentType: 'PARTNER_BONUS' as const,
      amount: 200000,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      reason: 'Recovery bonus',
    };
    admin.createManualWalletAdjustmentRequest.mockResolvedValue({ id: 'request-1' });
    admin.listManualWalletAdjustmentRequests.mockResolvedValue([{ id: 'request-1' }]);
    admin.manualWalletAdjustmentRequestSummary.mockResolvedValue({ total: 4 });
    admin.approveManualWalletAdjustmentRequest.mockResolvedValue({ request: { id: 'request-1' } });
    admin.rejectManualWalletAdjustmentRequest.mockResolvedValue({ id: 'request-1', status: 'REJECTED' });
    admin.cancelStaleManualWalletAdjustmentRequest.mockResolvedValue({
      id: 'request-1',
      status: 'CANCELLED',
    });

    await expect(controller.createManualWalletAdjustmentRequest(user, payload)).resolves.toEqual({
      id: 'request-1',
    });
    await expect(
      controller.manualWalletAdjustmentRequests(user, 'REQUESTED', '25', '50', 'CUSTOMER', 'customer-1'),
    ).resolves.toEqual([{ id: 'request-1' }]);
    await expect(
      controller.manualWalletAdjustmentRequestSummary(user, 'CANCELLED', 'CUSTOMER', 'customer-1'),
    ).resolves.toEqual({ total: 4 });
    await expect(controller.approveManualWalletAdjustmentRequest(user, 'request-1')).resolves.toEqual({
      request: { id: 'request-1' },
    });
    await expect(
      controller.rejectManualWalletAdjustmentRequest(user, 'request-1', { reason: 'Missing evidence' }),
    ).resolves.toEqual({ id: 'request-1', status: 'REJECTED' });
    await expect(
      controller.cancelStaleManualWalletAdjustmentRequest(user, 'request-1', {
        reason: 'Wallet balance changed after request creation',
      }),
    ).resolves.toEqual({ id: 'request-1', status: 'CANCELLED' });

    expect(routeMetadata('createManualWalletAdjustmentRequest')).toEqual({
      method: RequestMethod.POST,
      path: 'wallet-adjustment-requests',
    });
    expect('executeCustomerWalletAdjustmentDirect' in AdminController.prototype).toBe(false);
    expect(routeMetadata('manualWalletAdjustmentRequestSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'wallet-adjustment-requests/summary',
    });
    expect(routeMetadata('approveManualWalletAdjustmentRequest')).toEqual({
      method: RequestMethod.POST,
      path: 'wallet-adjustment-requests/:id/approve',
    });
    expect(routeMetadata('rejectManualWalletAdjustmentRequest')).toEqual({
      method: RequestMethod.POST,
      path: 'wallet-adjustment-requests/:id/reject',
    });
    expect(routeMetadata('cancelStaleManualWalletAdjustmentRequest')).toEqual({
      method: RequestMethod.POST,
      path: 'wallet-adjustment-requests/:id/cancel-stale',
    });
    expect(admin.approveManualWalletAdjustmentRequest).toHaveBeenCalledWith('admin-1', 'request-1');
    expect(admin.listManualWalletAdjustmentRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'customer-1',
        ownerType: 'CUSTOMER',
        skip: '50',
        status: 'REQUESTED',
        take: '25',
      }),
      'admin-1',
    );
    expect(admin.manualWalletAdjustmentRequestSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'customer-1',
        ownerType: 'CUSTOMER',
        status: 'CANCELLED',
      }),
      'admin-1',
    );
    expect(admin.rejectManualWalletAdjustmentRequest).toHaveBeenCalledWith(
      'admin-1',
      'request-1',
      'Missing evidence',
    );
    expect(admin.cancelStaleManualWalletAdjustmentRequest).toHaveBeenCalledWith(
      'admin-1',
      'request-1',
      'Wallet balance changed after request creation',
    );
  });

  it('exposes partner wallet withdrawal requests with provider filtering', async () => {
    admin.listProviderWalletWithdrawalRequests.mockResolvedValue([{ id: 'withdrawal-request-1' }]);

    await expect(
      controller.providerWalletWithdrawalRequests(
        user,
        '10',
        'all',
        'REQUESTED',
        'provider-1',
        undefined,
        '20',
      ),
    ).resolves.toEqual([{ id: 'withdrawal-request-1' }]);

    expect(routeMetadata('providerWalletWithdrawalRequests')).toEqual({
      method: RequestMethod.GET,
      path: 'provider-wallet/withdrawal-requests',
    });
    expect(admin.listProviderWalletWithdrawalRequests).toHaveBeenCalledWith(
      {
        providerProfileId: 'provider-1',
        range: 'all',
        reconciliation: undefined,
        q: undefined,
        skip: '20',
        sort: undefined,
        status: 'REQUESTED',
        take: '10',
      },
      'admin-1',
    );
  });

  it('exposes partner wallet withdrawal request summary with provider filtering', async () => {
    admin.providerWalletWithdrawalRequestSummary.mockResolvedValue({ total: 4 });

    await expect(
      controller.providerWalletWithdrawalRequestSummary(
        '7d',
        'provider-1',
        'unmatched',
        'PAID',
        'VCB',
      ),
    ).resolves.toEqual({ total: 4 });

    expect(routeMetadata('providerWalletWithdrawalRequestSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'provider-wallet/withdrawal-requests/summary',
    });
    expect(admin.providerWalletWithdrawalRequestSummary).toHaveBeenCalledWith({
      providerProfileId: 'provider-1',
      q: 'VCB',
      range: '7d',
      reconciliation: 'unmatched',
      status: 'PAID',
    });
  });

  it('exposes booking detail notification evidence with an optional preview limit', async () => {
    admin.listBookingNotifications.mockResolvedValue([{ id: 'notification-1' }]);

    await expect(controller.bookingNotifications('booking-1', '12')).resolves.toEqual([
      { id: 'notification-1' },
    ]);

    expect(routeMetadata('bookingNotifications')).toEqual({
      method: RequestMethod.GET,
      path: 'bookings/:id/notifications',
    });
    expect(admin.listBookingNotifications).toHaveBeenCalledWith('booking-1', { take: '12' });
  });

  it('exposes booking marketplace provider evidence with an optional preview limit', async () => {
    admin.listBookingMarketplaceProviders.mockResolvedValue([{ id: 'provider-1' }]);

    await expect(controller.bookingMarketplaceProviders('booking-1', '40')).resolves.toEqual([
      { id: 'provider-1' },
    ]);

    expect(routeMetadata('bookingMarketplaceProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'bookings/:id/marketplace-providers',
    });
    expect(admin.listBookingMarketplaceProviders).toHaveBeenCalledWith('booking-1', { take: '40' });
  });

  it('exposes audit logs as a bounded filtered list with a separate summary', async () => {
    admin.listAuditLogs.mockResolvedValue([{ id: 'audit-1' }]);
    admin.listAuditLogPage.mockResolvedValue({
      items: [{ id: 'audit-page-1' }],
      skip: 40,
      take: 20,
      totalCount: 120,
    });
    admin.auditLogSummary.mockResolvedValue({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 120 });

    await expect(
      controller.auditLogs(
        ['booking.create.rejected', 'company_bank_account.create'],
        '20',
        '40',
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'booking-1',
        'Notification',
        '4',
        undefined,
      ),
    ).resolves.toEqual([{ id: 'audit-1' }]);
    await expect(
      controller.auditLogs(
        ['booking.create.rejected', 'company_bank_account.create'],
        '20',
        '40',
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'booking-1',
        'Notification',
        '4',
        'true',
      ),
    ).resolves.toEqual({
      items: [{ id: 'audit-page-1' }],
      skip: 40,
      take: 20,
      totalCount: 120,
    });
    await expect(
      controller.auditLogSummary(
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'booking-1',
        'Notification',
        '4',
        ['booking.create.rejected', 'company_bank_account.create'],
      ),
    ).resolves.toEqual({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 120 });

    expect(routeMetadata('auditLogs')).toEqual({
      method: RequestMethod.GET,
      path: 'audit-logs',
    });
    expect(routeMetadata('auditLogSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'audit-logs/summary',
    });
    expect(admin.listAuditLogs).toHaveBeenCalledWith({
      action: ['booking.create.rejected', 'company_bank_account.create'],
      bucket: 'Notification',
      from: '2026-06-27T00:00:00.000Z',
      priority: '4',
      q: 'booking-1',
      skip: '40',
      take: '20',
      to: '2026-06-28T00:00:00.000Z',
    });
    expect(admin.listAuditLogPage).toHaveBeenCalledWith({
      action: ['booking.create.rejected', 'company_bank_account.create'],
      bucket: 'Notification',
      from: '2026-06-27T00:00:00.000Z',
      priority: '4',
      q: 'booking-1',
      skip: '40',
      take: '20',
      to: '2026-06-28T00:00:00.000Z',
    });
    expect(admin.auditLogSummary).toHaveBeenCalledWith({
      action: ['booking.create.rejected', 'company_bank_account.create'],
      bucket: 'Notification',
      from: '2026-06-27T00:00:00.000Z',
      priority: '4',
      q: 'booking-1',
      to: '2026-06-28T00:00:00.000Z',
    });
  });

  it('exposes notification summary as a separate aggregate endpoint', async () => {
    admin.notificationSummary.mockResolvedValue({
      generatedAt: '2026-06-27T00:00:00.000Z',
      totalCount: 2400,
    });

    await expect(
      controller.notificationSummary(
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'system-incidents',
        'booking-1',
        undefined,
        'recovered',
      ),
    ).resolves.toEqual({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 2400 });

    expect(routeMetadata('notificationSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications/summary',
    });
    expect(admin.notificationSummary).toHaveBeenCalledWith({
      from: '2026-06-27T00:00:00.000Z',
      booking: 'booking-1',
      incidentState: 'recovered',
      review: 'system-incidents',
      to: '2026-06-28T00:00:00.000Z',
    });
  });

  it('exposes customers as a bounded filtered list with a summary endpoint', async () => {
    admin.listCustomers.mockResolvedValue([{ id: 'customer-1' }]);
    admin.customerSummary.mockResolvedValue({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 42 });

    await expect(
      controller.customers(
        '10',
        '20',
        'mai',
        'VN',
        'female',
        '2026-06-01',
        '2026-06-27',
        '2026-06-08',
        '2026-06-18',
        '2026-06-10',
        '2026-06-20',
        'booking-count',
        'needs-action',
        'completed',
      ),
    ).resolves.toEqual([{ id: 'customer-1' }]);
    await expect(
      controller.customerSummary(
        'mai',
        'VN',
        'female',
        '2026-06-01',
        '2026-06-27',
        '2026-06-08',
        '2026-06-18',
        '2026-06-10',
        '2026-06-20',
        'needs-action',
        'completed',
      ),
    ).resolves.toEqual({
      generatedAt: '2026-06-27T00:00:00.000Z',
      totalCount: 42,
    });

    expect(routeMetadata('customers')).toEqual({
      method: RequestMethod.GET,
      path: 'customers',
    });
    expect(routeMetadata('customerSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'customers/summary',
    });
    expect(admin.listCustomers).toHaveBeenCalledWith({
      country: 'VN',
      gender: 'female',
      joinedFrom: '2026-06-01',
      joinedTo: '2026-06-27',
      lastBookingFrom: '2026-06-08',
      lastBookingTo: '2026-06-18',
      lastLoginFrom: '2026-06-10',
      lastLoginTo: '2026-06-20',
      q: 'mai',
      skip: '20',
      sort: 'booking-count',
      take: '10',
      view: 'needs-action',
      segment: 'completed',
    });
    expect(admin.customerSummary).toHaveBeenCalledWith({
      country: 'VN',
      gender: 'female',
      joinedFrom: '2026-06-01',
      joinedTo: '2026-06-27',
      lastBookingFrom: '2026-06-08',
      lastBookingTo: '2026-06-18',
      lastLoginFrom: '2026-06-10',
      lastLoginTo: '2026-06-20',
      q: 'mai',
      view: 'needs-action',
      segment: 'completed',
    });
  });

  it('exposes payments as a bounded filtered operations list', async () => {
    admin.listPayments.mockResolvedValue([{ id: 'payment-1' }]);

    await expect(controller.payments('25', 'today', 'cash-debt', '10', 'customer-1')).resolves.toEqual([
      { id: 'payment-1' },
    ]);

    expect(routeMetadata('payments')).toEqual({
      method: RequestMethod.GET,
      path: 'payments',
    });
    expect(admin.listPayments).toHaveBeenCalledWith({
      customerProfileId: 'customer-1',
      range: 'today',
      review: 'cash-debt',
      skip: '10',
      take: '25',
    });
  });

  it('exposes payment summary with the same operations filters', async () => {
    admin.paymentSummary.mockResolvedValue({ totalCount: 42, needsAction: 7 });

    await expect(controller.paymentSummary('7d', 'callback-review', 'customer-1')).resolves.toEqual({
      totalCount: 42,
      needsAction: 7,
    });

    expect(routeMetadata('paymentSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'payments/summary',
    });
    expect(admin.paymentSummary).toHaveBeenCalledWith({
      customerProfileId: 'customer-1',
      range: '7d',
      review: 'callback-review',
    });
  });

  it('exposes payment callback attempts as a bounded filtered ledger list', async () => {
    admin.listPaymentCallbackAttempts.mockResolvedValue([{ id: 'attempt-1' }]);

    await expect(
      controller.paymentCallbackAttempts('75', '7d', 'callback-review', 'customer-1'),
    ).resolves.toEqual([{ id: 'attempt-1' }]);

    expect(routeMetadata('paymentCallbackAttempts')).toEqual({
      method: RequestMethod.GET,
      path: 'payment-callback-attempts',
    });
    expect(admin.listPaymentCallbackAttempts).toHaveBeenCalledWith({
      customerProfileId: 'customer-1',
      range: '7d',
      review: 'callback-review',
      take: '75',
    });
  });

  it('exposes refunds as a bounded filtered operations list', async () => {
    admin.listRefunds.mockResolvedValue([{ id: 'refund-1' }]);

    await expect(
      controller.refunds(
        '50',
        '30d',
        'state-mismatch',
        '25',
        'customer-1',
        '3-7d',
        'oldest',
        'overdue',
        'refund-1',
      ),
    ).resolves.toEqual([{ id: 'refund-1' }]);

    expect(routeMetadata('refunds')).toEqual({
      method: RequestMethod.GET,
      path: 'refunds',
    });
    expect(admin.listRefunds).toHaveBeenCalledWith({
      age: '3-7d',
      customerProfileId: 'customer-1',
      q: 'refund-1',
      range: '30d',
      review: 'state-mismatch',
      sla: 'overdue',
      skip: '25',
      sort: 'oldest',
      take: '50',
    });
  });

  it('exposes refund queue metadata with the same server filters', async () => {
    admin.refundQueueMeta.mockResolvedValue({ selectedTotal: 12 });

    await expect(
      controller.refundQueueMeta('30d', 'open', 'customer-1', '3-7d', 'overdue', 'refund-1'),
    ).resolves.toEqual({ selectedTotal: 12 });

    expect(routeMetadata('refundQueueMeta')).toEqual({
      method: RequestMethod.GET,
      path: 'refunds/queue-meta',
    });
    expect(admin.refundQueueMeta).toHaveBeenCalledWith({
      age: '3-7d',
      customerProfileId: 'customer-1',
      q: 'refund-1',
      range: '30d',
      review: 'open',
      sla: 'overdue',
    });
  });

  it('exposes refund summary with the same operations filters', async () => {
    admin.refundSummary.mockResolvedValue({ totalCount: 12, requestedCount: 4 });

    await expect(
      controller.refundSummary('30d', 'state-mismatch', 'customer-1', 'over-7d', 'overdue', 'refund-1'),
    ).resolves.toEqual({
      totalCount: 12,
      requestedCount: 4,
    });

    expect(routeMetadata('refundSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'refunds/summary',
    });
    expect(admin.refundSummary).toHaveBeenCalledWith({
      age: 'over-7d',
      customerProfileId: 'customer-1',
      q: 'refund-1',
      range: '30d',
      review: 'state-mismatch',
      sla: 'overdue',
    });
  });

  it('exposes earnings as a bounded filtered finance list', async () => {
    admin.listEarnings.mockResolvedValue([{ id: 'earning-1' }]);

    await expect(
      (controller.earnings as (...args: string[]) => Promise<unknown>)('75', '7d', 'ready', '150'),
    ).resolves.toEqual([{ id: 'earning-1' }]);

    expect(routeMetadata('earnings')).toEqual({
      method: RequestMethod.GET,
      path: 'earnings',
    });
    expect(admin.listEarnings).toHaveBeenCalledWith({
      range: '7d',
      review: 'ready',
      skip: '150',
      take: '75',
    });
  });

  it('exposes earning summary with the same finance range filter', async () => {
    admin.earningsSummary.mockResolvedValue({ count: 1, grossAmount: 200000 });

    await expect(controller.earningsSummary('today', 'closeout-review')).resolves.toEqual({
      count: 1,
      grossAmount: 200000,
    });

    expect(routeMetadata('earningsSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'earnings/summary',
    });
    expect(admin.earningsSummary).toHaveBeenCalledWith({
      range: 'today',
      review: 'closeout-review',
    });
  });

  it('exposes missing booking settlements as a bounded server-filtered list', async () => {
    admin.listBookingSettlementGaps.mockResolvedValue({ items: [{ id: 'booking-gap-1' }], total: 1 });

    await expect(
      controller.bookingSettlementGaps(
        '7d-plus',
        'historical-ready',
        '2026-07',
        'MOMO',
        'customer',
        '20',
        '10',
      ),
    ).resolves.toEqual({
      items: [{ id: 'booking-gap-1' }],
      total: 1,
    });

    expect(routeMetadata('bookingSettlementGaps')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-gaps',
    });
    expect(admin.listBookingSettlementGaps).toHaveBeenCalledWith({
      age: '7d-plus',
      paymentMethod: 'MOMO',
      period: '2026-07',
      q: 'customer',
      skip: '20',
      take: '10',
      track: 'historical-ready',
    });
  });

  it('exposes a settlement summary for the active repair scope', async () => {
    admin.bookingSettlementGapSummary.mockResolvedValue({ backlog: 12, total: 14 });

    await expect(
      controller.bookingSettlementGapSummary(
        '7d-plus',
        'historical-ready',
        '2026-07',
        'CARD',
        'booking-1',
      ),
    ).resolves.toEqual({ backlog: 12, total: 14 });

    expect(routeMetadata('bookingSettlementGapSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-gaps/summary',
    });
    expect(admin.bookingSettlementGapSummary).toHaveBeenCalledWith({
      age: '7d-plus',
      paymentMethod: 'CARD',
      period: '2026-07',
      q: 'booking-1',
      track: 'historical-ready',
    });
  });

  it('exposes a bounded batch settlement repair preview', async () => {
    admin.previewBookingSettlementGapRepairs.mockResolvedValue({
      items: [{ bookingId: 'booking-gap-1', canRepair: false }],
      total: 1,
    });

    await expect(
      controller.previewBookingSettlementGapRepairs('booking-gap-1,booking-gap-2'),
    ).resolves.toEqual({
      items: [{ bookingId: 'booking-gap-1', canRepair: false }],
      total: 1,
    });

    expect(routeMetadata('previewBookingSettlementGapRepairs')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-gaps/preview-batch',
    });
    expect(admin.previewBookingSettlementGapRepairs).toHaveBeenCalledWith(
      'booking-gap-1,booking-gap-2',
    );
  });

  it('exposes a read-only settlement repair eligibility preview', async () => {
    admin.previewBookingSettlementGapRepair.mockResolvedValue({
      bookingId: 'booking-gap-1',
      canRepair: true,
    });

    await expect(controller.previewBookingSettlementGapRepair('booking-gap-1')).resolves.toEqual({
      bookingId: 'booking-gap-1',
      canRepair: true,
    });

    expect(routeMetadata('previewBookingSettlementGapRepair')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-gaps/:id/preview',
    });
    expect(admin.previewBookingSettlementGapRepair).toHaveBeenCalledWith('booking-gap-1');
  });

  it('exposes a read-only post-repair accounting checkpoint', async () => {
    admin.verifyBookingSettlementRepair.mockResolvedValue({
      bookingId: 'booking-gap-1',
      passed: true,
      status: 'PASSED',
    });

    await expect(controller.verifyBookingSettlementRepair('booking-gap-1')).resolves.toEqual({
      bookingId: 'booking-gap-1',
      passed: true,
      status: 'PASSED',
    });
    expect(admin.verifyBookingSettlementRepair).toHaveBeenCalledWith('booking-gap-1');
    expect(routeMetadata('verifyBookingSettlementRepair')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-gaps/:id/checkpoint',
    });
  });

  it('exposes a bounded read-only historical settlement dry-run report', async () => {
    admin.bookingSettlementGapDryRun.mockResolvedValue({ evaluated: 66, totalMatched: 66 });

    await expect(controller.bookingSettlementGapDryRun('2026-06', 'MOMO', '100')).resolves.toEqual({
      evaluated: 66,
      totalMatched: 66,
    });

    expect(routeMetadata('bookingSettlementGapDryRun')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-gaps/dry-run',
    });
    expect(admin.bookingSettlementGapDryRun).toHaveBeenCalledWith({
      paymentMethod: 'MOMO',
      period: '2026-06',
      take: '100',
    });
  });

  it('exposes an approved settlement repair write route', async () => {
    const body = {
      approvalAdminId: 'finance-admin-2',
      reason: 'Restore missing completion settlement',
      sourceVersion: 'booking:v1|payment:v1|policy:v1',
    };
    admin.repairBookingSettlementGap.mockResolvedValue({
      bookingId: 'booking-gap-1',
      repaired: true,
    });

    await expect(controller.repairBookingSettlementGap(user, 'booking-gap-1', body)).resolves.toEqual({
      bookingId: 'booking-gap-1',
      repaired: true,
    });

    expect(routeMetadata('repairBookingSettlementGap')).toEqual({
      method: RequestMethod.POST,
      path: 'booking-settlement-gaps/:id/repair',
    });
    expect(admin.repairBookingSettlementGap).toHaveBeenCalledWith('admin-1', 'booking-gap-1', body);
  });

  it('exposes booking settlement snapshots as a bounded filtered finance list', async () => {
    admin.listBookingSettlementSnapshots.mockResolvedValue([{ id: 'settlement-1' }]);

    await expect(
      controller.bookingSettlementSnapshots('50', '7d', 'open', undefined, undefined, '100', 'booking-42'),
    ).resolves.toEqual([{ id: 'settlement-1' }]);

    expect(routeMetadata('bookingSettlementSnapshots')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-snapshots',
    });
    expect(admin.listBookingSettlementSnapshots).toHaveBeenCalledWith({
      range: '7d',
      review: 'open',
      period: undefined,
      paymentMethod: undefined,
      q: 'booking-42',
      skip: '100',
      take: '50',
    });
  });

  it('exposes booking settlement snapshot summary with the same filters', async () => {
    admin.bookingSettlementSnapshotSummary.mockResolvedValue({
      count: 1,
      partnerWithholdingTotal: 42000,
    });

    await expect(
      controller.bookingSettlementSnapshotSummary('30d', 'paid', undefined, undefined, 'booking-42'),
    ).resolves.toEqual({
      count: 1,
      partnerWithholdingTotal: 42000,
    });

    expect(routeMetadata('bookingSettlementSnapshotSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-snapshots/summary',
    });
    expect(admin.bookingSettlementSnapshotSummary).toHaveBeenCalledWith({
      range: '30d',
      review: 'paid',
      period: undefined,
      paymentMethod: undefined,
      q: 'booking-42',
    });
  });

  it('exposes a booking settlement snapshot detail for finance audit evidence', async () => {
    admin.getBookingSettlementSnapshot.mockResolvedValue({
      bookingId: 'booking-1',
      id: 'settlement-1',
    });

    await expect(controller.bookingSettlementSnapshot('settlement-1')).resolves.toEqual({
      bookingId: 'booking-1',
      id: 'settlement-1',
    });

    expect(routeMetadata('bookingSettlementSnapshot')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-snapshots/:id',
    });
    expect(admin.getBookingSettlementSnapshot).toHaveBeenCalledWith('settlement-1');
  });

  it('exposes booking settlement reversal entries as a bounded filtered finance list', async () => {
    admin.listBookingSettlementReversals.mockResolvedValue([{ id: 'reversal-1' }]);

    await expect(controller.bookingSettlementReversals('25', '30d', 'non-cash', '50')).resolves.toEqual([
      { id: 'reversal-1' },
    ]);

    expect(routeMetadata('bookingSettlementReversals')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-reversals',
    });
    expect(admin.listBookingSettlementReversals).toHaveBeenCalledWith({
      range: '30d',
      review: 'non-cash',
      skip: '50',
      take: '25',
    });
  });

  it('exposes a single booking settlement reversal entry for finance evidence review', async () => {
    admin.getBookingSettlementReversal.mockResolvedValue({
      bookingId: 'booking-1',
      id: 'reversal-1',
    });

    await expect(controller.bookingSettlementReversal('reversal-1')).resolves.toEqual({
      bookingId: 'booking-1',
      id: 'reversal-1',
    });

    expect(routeMetadata('bookingSettlementReversal')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-reversals/:id',
    });
    expect(admin.getBookingSettlementReversal).toHaveBeenCalledWith('reversal-1');
  });

  it('exposes booking settlement reversal summary with the same filters', async () => {
    admin.bookingSettlementReversalSummary.mockResolvedValue({
      count: 1,
      platformFeeNetRevenue: -118519,
    });

    await expect(controller.bookingSettlementReversalSummary('30d', 'closed-period')).resolves.toEqual({
      count: 1,
      platformFeeNetRevenue: -118519,
    });

    expect(routeMetadata('bookingSettlementReversalSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-reversals/summary',
    });
    expect(admin.bookingSettlementReversalSummary).toHaveBeenCalledWith({
      range: '30d',
      review: 'closed-period',
    });
  });

  it('exposes coupon finance summary with booking settlement filters', async () => {
    admin.couponFinanceSummary.mockResolvedValue({
      companyCouponExpense: 60000,
      couponDiscountAmount: 60000,
      couponSettlementCount: 1,
      currency: 'VND',
    });

    await expect(controller.couponFinanceSummary('7d', 'posted')).resolves.toEqual({
      companyCouponExpense: 60000,
      couponDiscountAmount: 60000,
      couponSettlementCount: 1,
      currency: 'VND',
    });

    expect(routeMetadata('couponFinanceSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-snapshots/coupon-finance-summary',
    });
    expect(admin.couponFinanceSummary).toHaveBeenCalledWith({
      range: '7d',
      review: 'posted',
    });
  });

  it('exposes coupon finance rows with bounded booking settlement filters', async () => {
    admin.listCouponFinanceSnapshots.mockResolvedValue([{ id: 'settlement-1' }]);

    await expect(controller.couponFinanceSnapshots('25', '7d', 'posted', '50')).resolves.toEqual([
      { id: 'settlement-1' },
    ]);

    expect(routeMetadata('couponFinanceSnapshots')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-snapshots/coupon-finance',
    });
    expect(admin.listCouponFinanceSnapshots).toHaveBeenCalledWith({
      range: '7d',
      review: 'posted',
      skip: '50',
      take: '25',
    });
  });

  it('exposes partner withholding tax monthly summaries', async () => {
    admin.listPartnerWithholdingTax.mockResolvedValue([{ providerProfileId: 'provider-1' }]);

    await expect(controller.partnerWithholdingTax('2026-06', '25', '50')).resolves.toEqual([
      { providerProfileId: 'provider-1' },
    ]);

    expect(routeMetadata('partnerWithholdingTax')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-withholding-tax',
    });
    expect(admin.listPartnerWithholdingTax).toHaveBeenCalledWith({
      period: '2026-06',
      skip: '50',
      take: '25',
    });
  });

  it('exposes partner withholding tax summary for a monthly period', async () => {
    admin.partnerWithholdingTaxSummary.mockResolvedValue({
      period: '2026-06',
      totalPartnerTaxWithheld: 84000,
    });

    await expect(controller.partnerWithholdingTaxSummary('2026-06')).resolves.toEqual({
      period: '2026-06',
      totalPartnerTaxWithheld: 84000,
    });

    expect(routeMetadata('partnerWithholdingTaxSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-withholding-tax/summary',
    });
    expect(admin.partnerWithholdingTaxSummary).toHaveBeenCalledWith({ period: '2026-06' });
  });

  it('exposes monthly tax closings as a bounded finance list', async () => {
    admin.listMonthlyTaxClosings.mockResolvedValue([{ period: '2026-06' }]);

    await expect(controller.monthlyTaxClosings('2026-06', '25', '25')).resolves.toEqual([
      { period: '2026-06' },
    ]);

    expect(routeMetadata('monthlyTaxClosings')).toEqual({
      method: RequestMethod.GET,
      path: 'monthly-tax-closings',
    });
    expect(admin.listMonthlyTaxClosings).toHaveBeenCalledWith({
      period: '2026-06',
      skip: '25',
      take: '25',
    });
  });

  it('exposes monthly tax closing summary for a monthly period', async () => {
    admin.monthlyTaxClosingSummary.mockResolvedValue({
      period: '2026-06',
      settlementCount: 2,
      reconciliationDelta: 0,
    });

    await expect(controller.monthlyTaxClosingSummary('2026-06')).resolves.toEqual({
      period: '2026-06',
      settlementCount: 2,
      reconciliationDelta: 0,
    });

    expect(routeMetadata('monthlyTaxClosingSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'monthly-tax-closings/summary',
    });
    expect(admin.monthlyTaxClosingSummary).toHaveBeenCalledWith({ period: '2026-06' });
  });

  it('exposes monthly tax closing status updates as audited PATCH actions', async () => {
    const body = {
      status: 'DECLARED' as never,
      notes: 'Submitted to tax portal',
    };
    admin.updateMonthlyTaxClosingStatus.mockResolvedValue({ period: '2026-06', status: 'DECLARED' });

    await expect(controller.updateMonthlyTaxClosingStatus(user, '2026-06', body)).resolves.toEqual({
      period: '2026-06',
      status: 'DECLARED',
    });

    expect(routeMetadata('updateMonthlyTaxClosingStatus')).toEqual({
      method: RequestMethod.PATCH,
      path: 'monthly-tax-closings/:period/status',
    });
    expect(admin.updateMonthlyTaxClosingStatus).toHaveBeenCalledWith('admin-1', '2026-06', body);
  });

  it('exposes platform VAT summary grouped by monthly period', async () => {
    admin.platformVatSummary.mockResolvedValue({ period: '2026-06', companyOutputVatTotal: 18962 });

    await expect(controller.platformVatSummary('2026-06')).resolves.toEqual({
      period: '2026-06',
      companyOutputVatTotal: 18962,
    });

    expect(routeMetadata('platformVatSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'platform-vat/summary',
    });
    expect(admin.platformVatSummary).toHaveBeenCalledWith({ period: '2026-06' });
  });

  it('exposes payment fee summary grouped by monthly period', async () => {
    admin.paymentFeeSummary.mockResolvedValue({ period: '2026-06', paymentProcessingFeeTotal: 10000 });

    await expect(controller.paymentFeeSummary('2026-06')).resolves.toEqual({
      period: '2026-06',
      paymentProcessingFeeTotal: 10000,
    });

    expect(routeMetadata('paymentFeeSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'payment-fees/summary',
    });
    expect(admin.paymentFeeSummary).toHaveBeenCalledWith({ period: '2026-06' });
  });

  it('exposes accounting journal batches as a bounded finance list', async () => {
    admin.listAccountingJournalBatches.mockResolvedValue([{ id: 'journal-batch-1' }]);

    await expect(
      controller.accountingJournalBatches(
        '25',
        '30d',
        'posted',
        '50',
        'booking-1',
        '2026-07',
        'BOOKING_SETTLEMENT',
        'largest-discrepancy',
      ),
    ).resolves.toEqual([{ id: 'journal-batch-1' }]);

    expect(routeMetadata('accountingJournalBatches')).toEqual({
      method: RequestMethod.GET,
      path: 'accounting-journal-batches',
    });
    expect(admin.listAccountingJournalBatches).toHaveBeenCalledWith({
      period: '2026-07',
      q: 'booking-1',
      range: '30d',
      review: 'posted',
      skip: '50',
      sort: 'largest-discrepancy',
      source: 'BOOKING_SETTLEMENT',
      take: '25',
    });
  });

  it('exposes accounting journal batch summary with the same filters', async () => {
    admin.accountingJournalBatchSummary.mockResolvedValue({
      count: 2,
      totalDebit: 500000,
      totalCredit: 500000,
    });

    await expect(
      controller.accountingJournalBatchSummary(
        '7d',
        'reversed',
        'refund-1',
        '2026-07',
        'BOOKING_SETTLEMENT_REVERSAL',
      ),
    ).resolves.toEqual({
      count: 2,
      totalCredit: 500000,
      totalDebit: 500000,
    });

    expect(routeMetadata('accountingJournalBatchSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'accounting-journal-batches/summary',
    });
    expect(admin.accountingJournalBatchSummary).toHaveBeenCalledWith({
      period: '2026-07',
      q: 'refund-1',
      range: '7d',
      review: 'reversed',
      source: 'BOOKING_SETTLEMENT_REVERSAL',
    });
  });

  it('exposes accounting journal batch detail by id', async () => {
    admin.accountingJournalBatchDetail.mockResolvedValue({ id: 'journal-batch-1', entries: [] });

    await expect(controller.accountingJournalBatchDetail('journal-batch-1')).resolves.toEqual({
      id: 'journal-batch-1',
      entries: [],
    });

    expect(routeMetadata('accountingJournalBatchDetail')).toEqual({
      method: RequestMethod.GET,
      path: 'accounting-journal-batches/:id',
    });
    expect(admin.accountingJournalBatchDetail).toHaveBeenCalledWith('journal-batch-1');
  });

  it('exposes booking payment clearing entries as a bounded finance list', async () => {
    admin.listBookingPaymentClearingEntries.mockResolvedValue([{ id: 'clearing-1' }]);

    await expect(
      controller.bookingPaymentClearingEntries('25', 'today', 'open', '50', 'unassigned', 'admin-1', '48h'),
    ).resolves.toEqual([{ id: 'clearing-1' }]);

    expect(routeMetadata('bookingPaymentClearingEntries')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-payment-clearing',
    });
    expect(admin.listBookingPaymentClearingEntries).toHaveBeenCalledWith({
      age: '48h',
      assigneeAdminId: 'admin-1',
      assignment: 'unassigned',
      range: 'today',
      review: 'open',
      skip: '50',
      take: '25',
    });
  });

  it('exposes booking payment clearing summary with the same filters', async () => {
    admin.bookingPaymentClearingSummary.mockResolvedValue({ count: 3, amount: 900000, openAmount: 300000 });

    await expect(
      controller.bookingPaymentClearingSummary('30d', 'cleared', 'assigned', 'admin-2', '48h'),
    ).resolves.toEqual({
      amount: 900000,
      count: 3,
      openAmount: 300000,
    });

    expect(routeMetadata('bookingPaymentClearingSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-payment-clearing/summary',
    });
    expect(admin.bookingPaymentClearingSummary).toHaveBeenCalledWith({
      age: '48h',
      assigneeAdminId: 'admin-2',
      assignment: 'assigned',
      range: '30d',
      review: 'cleared',
    });
  });

  it('exposes payment clearing review owner workload without an owner filter', async () => {
    admin.bookingPaymentClearingReviewOwnerSummary.mockResolvedValue({
      currency: 'VND',
      openAmount: 500000,
      openCount: 2,
      owners: [],
      unassigned: { openAmount: 500000, openCount: 2, over48hAmount: 0, over48hCount: 0 },
    });

    await expect(
      controller.bookingPaymentClearingReviewOwnerSummary('30d', 'partial', '48h'),
    ).resolves.toMatchObject({
      currency: 'VND',
      openAmount: 500000,
      openCount: 2,
    });

    expect(routeMetadata('bookingPaymentClearingReviewOwnerSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-payment-clearing/review-owner-summary',
    });
    expect(admin.bookingPaymentClearingReviewOwnerSummary).toHaveBeenCalledWith({
      age: '48h',
      range: '30d',
      review: 'partial',
    });
  });

  it('exposes booking payment clearing entry detail by id', async () => {
    admin.bookingPaymentClearingEntryDetail.mockResolvedValue({
      id: 'clearing-1',
      bankReconciliationMatches: [],
    });

    await expect(controller.bookingPaymentClearingEntryDetail('clearing-1')).resolves.toEqual({
      id: 'clearing-1',
      bankReconciliationMatches: [],
    });

    expect(routeMetadata('bookingPaymentClearingEntryDetail')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-payment-clearing/:id',
    });
    expect(admin.bookingPaymentClearingEntryDetail).toHaveBeenCalledWith('clearing-1');
  });

  it('assigns an open booking payment clearing review without changing clearing status', async () => {
    admin.assignBookingPaymentClearingReview.mockResolvedValue({
      clearingEntryId: 'clearing-1',
      assignee: { id: 'admin-2' },
    });

    await expect(
      controller.assignBookingPaymentClearingReview({ id: 'admin-1' } as never, 'clearing-1', {
        assigneeAdminId: 'admin-2',
        reason: 'Review oldest open evidence',
      }),
    ).resolves.toEqual({ clearingEntryId: 'clearing-1', assignee: { id: 'admin-2' } });

    expect(routeMetadata('assignBookingPaymentClearingReview')).toEqual({
      method: RequestMethod.POST,
      path: 'booking-payment-clearing/:id/review-assignment',
    });
    expect(admin.assignBookingPaymentClearingReview).toHaveBeenCalledWith('admin-1', 'clearing-1', {
      assigneeAdminId: 'admin-2',
      reason: 'Review oldest open evidence',
    });
  });

  it('exposes bounded bulk payment clearing review assignment through the protected Admin route', async () => {
    const user = { id: 'admin-1' } as never;
    const payload = {
      assigneeAdminId: 'finance-operator-1',
      clearingEntryIds: ['clearing-1', 'clearing-2'],
      reason: 'Assign selected payment clearing reviews',
    };
    admin.assignBookingPaymentClearingReviews.mockResolvedValue({ assignedCount: 2 });

    await expect(controller.assignBookingPaymentClearingReviews(user, payload)).resolves.toEqual({
      assignedCount: 2,
    });
    expect(admin.assignBookingPaymentClearingReviews).toHaveBeenCalledWith('admin-1', payload);
    expect(routeMetadata('assignBookingPaymentClearingReviews')).toEqual({
      method: RequestMethod.POST,
      path: 'booking-payment-clearing/review-assignments',
    });
  });

  it('exposes company bank accounts for bank reconciliation import selection', async () => {
    admin.listCompanyBankAccounts.mockResolvedValue([{ id: 'bank-account-1', status: 'ACTIVE' }]);

    await expect(controller.companyBankAccounts('ACTIVE')).resolves.toEqual([
      { id: 'bank-account-1', status: 'ACTIVE' },
    ]);

    expect(routeMetadata('companyBankAccounts')).toEqual({
      method: RequestMethod.GET,
      path: 'company-bank-accounts',
    });
    expect(admin.listCompanyBankAccounts).toHaveBeenCalledWith({ status: 'ACTIVE' });
  });

  it('exposes protected company bank account create and update routes with actor identity', async () => {
    const createInput = {
      operatorReason: 'Reviewed treasury evidence',
      name: 'Operations VND',
      bankName: 'VCB',
      accountNumberLast4: '1234',
      currency: 'VND',
    } as never;
    const updateInput = {
      operatorReason: 'Archive after treasury review',
      status: 'INACTIVE',
    } as never;
    const decisionInput = {
      decision: 'APPROVE',
      operatorReason: 'Verified treasury ownership evidence',
      requestId: 'request-1',
    } as never;
    admin.createCompanyBankAccount.mockResolvedValue({ id: 'bank-account-1' });
    admin.updateCompanyBankAccount.mockResolvedValue({ id: 'bank-account-1', status: 'INACTIVE' });
    admin.decideCompanyBankAccountChange.mockResolvedValue({ id: 'bank-account-1', status: 'ACTIVE' });

    await expect(controller.createCompanyBankAccount(user, createInput)).resolves.toEqual({
      id: 'bank-account-1',
    });
    await expect(controller.updateCompanyBankAccount(user, 'bank-account-1', updateInput)).resolves.toEqual({
      id: 'bank-account-1',
      status: 'INACTIVE',
    });
    await expect(
      controller.decideCompanyBankAccountChange(user, 'bank-account-1', decisionInput),
    ).resolves.toEqual({
      id: 'bank-account-1',
      status: 'ACTIVE',
    });
    expect(routeMetadata('createCompanyBankAccount')).toEqual({
      method: RequestMethod.POST,
      path: 'company-bank-accounts',
    });
    expect(routeMetadata('updateCompanyBankAccount')).toEqual({
      method: RequestMethod.PATCH,
      path: 'company-bank-accounts/:id',
    });
    expect(routeMetadata('decideCompanyBankAccountChange')).toEqual({
      method: RequestMethod.POST,
      path: 'company-bank-accounts/:id/approval-decision',
    });
    expect(admin.createCompanyBankAccount).toHaveBeenCalledWith('admin-1', createInput);
    expect(admin.updateCompanyBankAccount).toHaveBeenCalledWith('admin-1', 'bank-account-1', updateInput);
    expect(admin.decideCompanyBankAccountChange).toHaveBeenCalledWith(
      'admin-1',
      'bank-account-1',
      decisionInput,
    );
  });

  it('exposes bank reconciliation transactions as a bounded finance list', async () => {
    admin.listBankReconciliationTransactions.mockResolvedValue([{ id: 'bank-tx-1' }]);

    await expect(
      controller.bankReconciliationTransactions(
        '25',
        '7d',
        'unmatched',
        '50',
        'VCB-OUT',
        'strong',
        'assigned',
        'finance-operator-1',
        'OUTFLOW',
        'WITHDRAWAL',
        '48h',
      ),
    ).resolves.toEqual([{ id: 'bank-tx-1' }]);

    expect(routeMetadata('bankReconciliationTransactions')).toEqual({
      method: RequestMethod.GET,
      path: 'bank-reconciliation',
    });
    expect(admin.listBankReconciliationTransactions).toHaveBeenCalledWith({
      age: '48h',
      assigneeAdminId: 'finance-operator-1',
      assignment: 'assigned',
      candidate: 'strong',
      q: 'VCB-OUT',
      range: '7d',
      review: 'unmatched',
      skip: '50',
      take: '25',
      type: 'OUTFLOW',
      source: 'WITHDRAWAL',
    });
  });

  it('exposes bank reconciliation summary with the same filters', async () => {
    admin.bankReconciliationSummary.mockResolvedValue({ count: 4, unmatchedAmount: 120000 });

    await expect(
      controller.bankReconciliationSummary(
        'all',
        'matched',
        'VCB-OUT',
        'review',
        'unassigned',
        undefined,
        'INFLOW',
        'PAYMENT_CLEARING',
        '48h',
      ),
    ).resolves.toEqual({
      count: 4,
      unmatchedAmount: 120000,
    });

    expect(routeMetadata('bankReconciliationSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'bank-reconciliation/summary',
    });
    expect(admin.bankReconciliationSummary).toHaveBeenCalledWith({
      age: '48h',
      assigneeAdminId: undefined,
      assignment: 'unassigned',
      candidate: 'review',
      q: 'VCB-OUT',
      range: 'all',
      review: 'matched',
      type: 'INFLOW',
      source: 'PAYMENT_CLEARING',
    });
  });

  it('exposes bank reconciliation review owner workload without an owner filter', async () => {
    admin.bankReconciliationReviewOwnerSummary.mockResolvedValue({
      currency: 'VND',
      openAmount: 500000,
      openCount: 2,
      owners: [],
      unassigned: { openAmount: 500000, openCount: 2, over48hAmount: 0, over48hCount: 0 },
    });

    await expect(
      controller.bankReconciliationReviewOwnerSummary(
        '30d',
        'unmatched',
        'VCB-OUT',
        'review',
        'OUTFLOW',
        'WITHDRAWAL',
        '48h',
      ),
    ).resolves.toEqual({
      currency: 'VND',
      openAmount: 500000,
      openCount: 2,
      owners: [],
      unassigned: { openAmount: 500000, openCount: 2, over48hAmount: 0, over48hCount: 0 },
    });

    expect(routeMetadata('bankReconciliationReviewOwnerSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'bank-reconciliation/review-owner-summary',
    });
    expect(admin.bankReconciliationReviewOwnerSummary).toHaveBeenCalledWith({
      age: '48h',
      candidate: 'review',
      q: 'VCB-OUT',
      range: '30d',
      review: 'unmatched',
      source: 'WITHDRAWAL',
      type: 'OUTFLOW',
    });
  });

  it('exposes one evidence source facet summary without applying a selected source', async () => {
    admin.bankReconciliationEvidenceSourceSummary.mockResolvedValue({
      amount: 120000,
      count: 2,
      currency: 'VND',
      sources: [],
    });

    await expect(
      controller.bankReconciliationEvidenceSourceSummary(
        '30d',
        'unmatched',
        'VCB',
        'review',
        'assigned',
        'finance-operator-1',
        'OUTFLOW',
        '48h',
      ),
    ).resolves.toEqual({
      amount: 120000,
      count: 2,
      currency: 'VND',
      sources: [],
    });

    expect(routeMetadata('bankReconciliationEvidenceSourceSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'bank-reconciliation/evidence-source-summary',
    });
    expect(admin.bankReconciliationEvidenceSourceSummary).toHaveBeenCalledWith({
      age: '48h',
      assigneeAdminId: 'finance-operator-1',
      assignment: 'assigned',
      candidate: 'review',
      q: 'VCB',
      range: '30d',
      review: 'unmatched',
      type: 'OUTFLOW',
    });
  });

  it('exposes one bounded withdrawal candidate summary for the selected range and search', async () => {
    admin.bankReconciliationWithdrawalCandidateSummary.mockResolvedValue({
      eligibleCount: 4,
      strongCount: 1,
    });

    await expect(controller.bankReconciliationWithdrawalCandidateSummary('30d', 'VCB-OUT')).resolves.toEqual({
      eligibleCount: 4,
      strongCount: 1,
    });

    expect(routeMetadata('bankReconciliationWithdrawalCandidateSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'bank-reconciliation/withdrawal-candidate-summary',
    });
    expect(admin.bankReconciliationWithdrawalCandidateSummary).toHaveBeenCalledWith({
      q: 'VCB-OUT',
      range: '30d',
    });
  });

  it('exposes bank reconciliation transaction detail by id', async () => {
    admin.bankReconciliationTransactionDetail.mockResolvedValue({
      id: 'bank-tx-1',
      reconciliationMatches: [],
    });

    await expect(controller.bankReconciliationTransactionDetail('bank-tx-1')).resolves.toEqual({
      id: 'bank-tx-1',
      reconciliationMatches: [],
    });

    expect(routeMetadata('bankReconciliationTransactionDetail')).toEqual({
      method: RequestMethod.GET,
      path: 'bank-reconciliation/:id',
    });
    expect(admin.bankReconciliationTransactionDetail).toHaveBeenCalledWith(
      'bank-tx-1',
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('exposes manual company bank transaction creation for reconciliation import', async () => {
    const user = { id: 'admin-1' } as never;
    const payload = {
      bankAccountId: 'bank-account-1',
      type: 'INFLOW',
      amount: 900000,
      occurredAt: '2026-06-30T05:00:00.000Z',
      operatorReason: 'Reviewed original bank statement evidence',
      transferRef: 'VCB-900',
    };
    admin.createCompanyBankTransaction.mockResolvedValue({ id: 'bank-tx-1' });

    await expect(controller.createCompanyBankTransaction(user, payload as never)).resolves.toEqual({
      id: 'bank-tx-1',
    });

    expect(routeMetadata('createCompanyBankTransaction' as keyof AdminController)).toEqual({
      method: RequestMethod.POST,
      path: 'bank-reconciliation/transactions',
    });
    expect(admin.createCompanyBankTransaction).toHaveBeenCalledWith('admin-1', payload);
  });

  it('exposes bank statement batch preview and reviewed import routes', async () => {
    const previewPayload = { rows: [{ rowNumber: 1, bankAccountId: 'bank-1' }] };
    const importPayload = {
      ...previewPayload,
      operatorReason: 'Reviewed original bank statement evidence',
    };
    admin.previewCompanyBankTransactionBatch.mockResolvedValue({ rows: [], summary: { total: 0 } });
    admin.importCompanyBankTransactionBatch.mockResolvedValue({ importedCount: 1, skippedCount: 0 });

    await expect(controller.previewCompanyBankTransactionBatch(previewPayload as never)).resolves.toEqual({
      rows: [],
      summary: { total: 0 },
    });
    await expect(controller.importCompanyBankTransactionBatch(user, importPayload as never)).resolves.toEqual(
      {
        importedCount: 1,
        skippedCount: 0,
      },
    );
    expect(routeMetadata('previewCompanyBankTransactionBatch' as keyof AdminController)).toEqual({
      method: RequestMethod.POST,
      path: 'bank-reconciliation/transactions/batch-preview',
    });
    expect(routeMetadata('importCompanyBankTransactionBatch' as keyof AdminController)).toEqual({
      method: RequestMethod.POST,
      path: 'bank-reconciliation/transactions/batch-import',
    });
    expect(admin.previewCompanyBankTransactionBatch).toHaveBeenCalledWith(previewPayload);
    expect(admin.importCompanyBankTransactionBatch).toHaveBeenCalledWith('admin-1', importPayload);
  });

  it('exposes bounded bank statement import batch history', async () => {
    admin.listCompanyBankTransactionImportBatches.mockResolvedValue({
      items: [{ batchImportId: 'batch-1' }],
      pagination: { skip: 0, take: 10, total: 1 },
    });

    await expect(
      controller.bankReconciliationImportBatches('10', '0', '7d', 'VCB-July', 'needs-reconciliation'),
    ).resolves.toEqual({
      items: [{ batchImportId: 'batch-1' }],
      pagination: { skip: 0, take: 10, total: 1 },
    });
    expect(routeMetadata('bankReconciliationImportBatches' as keyof AdminController)).toEqual({
      method: RequestMethod.GET,
      path: 'bank-reconciliation/import-batches',
    });
    expect(admin.listCompanyBankTransactionImportBatches).toHaveBeenCalledWith({
      q: 'VCB-July',
      range: '7d',
      review: 'needs-reconciliation',
      skip: '0',
      take: '10',
    });
  });

  it('exposes the bank statement import reconciliation summary', async () => {
    admin.companyBankTransactionImportBatchSummary.mockResolvedValue({
      batchCount: 4,
      escalatedNeedsReconciliationCount: 1,
      needsReconciliationCount: 2,
      noTransactionCount: 1,
      oldestOpenImportedAt: new Date('2026-07-01T00:00:00.000Z'),
      reconciledCount: 1,
      staleNeedsReconciliationCount: 1,
    });

    await expect(controller.bankReconciliationImportBatchSummary()).resolves.toMatchObject({
      batchCount: 4,
      escalatedNeedsReconciliationCount: 1,
      needsReconciliationCount: 2,
      reconciledCount: 1,
      staleNeedsReconciliationCount: 1,
    });
    expect(routeMetadata('bankReconciliationImportBatchSummary' as keyof AdminController)).toEqual({
      method: RequestMethod.GET,
      path: 'bank-reconciliation/import-batches/summary',
    });
  });

  it('exposes read-only bank statement import batch detail', async () => {
    admin.companyBankTransactionImportBatchDetail.mockResolvedValue({ batchImportId: 'batch-1', rows: [] });

    await expect(controller.bankReconciliationImportBatchDetail('batch-1')).resolves.toEqual({
      batchImportId: 'batch-1',
      rows: [],
    });
    expect(routeMetadata('bankReconciliationImportBatchDetail' as keyof AdminController)).toEqual({
      method: RequestMethod.GET,
      path: 'bank-reconciliation/import-batches/:batchImportId',
    });
    expect(admin.companyBankTransactionImportBatchDetail).toHaveBeenCalledWith('batch-1');
  });

  it('assigns a bank statement import batch through the protected Admin write route', async () => {
    admin.assignCompanyBankTransactionImportBatch.mockResolvedValue({
      assignee: { id: 'finance-operator-1' },
      batchImportId: 'batch-1',
    });

    await expect(
      controller.assignBankReconciliationImportBatch(user, 'batch-1', {
        assigneeAdminId: 'finance-operator-1',
        reason: 'Own the overdue reconciliation queue',
      }),
    ).resolves.toMatchObject({ batchImportId: 'batch-1' });
    expect(admin.assignCompanyBankTransactionImportBatch).toHaveBeenCalledWith('admin-1', 'batch-1', {
      assigneeAdminId: 'finance-operator-1',
      reason: 'Own the overdue reconciliation queue',
    });
    expect(routeMetadata('assignBankReconciliationImportBatch' as keyof AdminController)).toEqual({
      method: RequestMethod.POST,
      path: 'bank-reconciliation/import-batches/:batchImportId/assignment',
    });
  });

  it('exposes bank transaction review assignment without changing reconciliation state', async () => {
    const user = { id: 'admin-1' } as never;
    const payload = { assigneeAdminId: 'finance-operator-1', reason: 'Review missing evidence' };
    admin.assignCompanyBankTransactionReview.mockResolvedValue({ bankTransactionId: 'bank-tx-1' });

    await expect(
      controller.assignBankReconciliationTransactionReview(user, 'bank-tx-1', payload),
    ).resolves.toEqual({ bankTransactionId: 'bank-tx-1' });
    expect(admin.assignCompanyBankTransactionReview).toHaveBeenCalledWith('admin-1', 'bank-tx-1', payload);
    expect(routeMetadata('assignBankReconciliationTransactionReview')).toEqual({
      method: RequestMethod.POST,
      path: 'bank-reconciliation/:id/review-assignment',
    });
  });

  it('exposes bulk bank transaction review assignment through the protected Admin write route', async () => {
    const user = { id: 'admin-1' } as never;
    const payload = {
      assigneeAdminId: 'finance-operator-1',
      bankTransactionIds: ['bank-tx-1', 'bank-tx-2'],
      reason: 'Assign selected bank evidence reviews',
    };
    admin.assignCompanyBankTransactionReviews.mockResolvedValue({ assignedCount: 2 });

    await expect(controller.assignBankReconciliationTransactionReviews(user, payload)).resolves.toEqual({
      assignedCount: 2,
    });
    expect(admin.assignCompanyBankTransactionReviews).toHaveBeenCalledWith('admin-1', payload);
    expect(routeMetadata('assignBankReconciliationTransactionReviews')).toEqual({
      method: RequestMethod.POST,
      path: 'bank-reconciliation/review-assignments',
    });
  });

  it('exposes Partner bank deposit reconciliation assignment without changing accounting state', async () => {
    const user = { id: 'admin-1' } as never;
    const payload = { assigneeAdminId: 'finance-operator-1', reason: 'Own overdue deposit evidence' };
    admin.assignPartnerBankDepositReconciliationReview.mockResolvedValue({
      partnerBankDepositRequestId: 'deposit-request-1',
    });

    await expect(
      controller.assignPartnerBankDepositReconciliationReview(user, 'deposit-request-1', payload),
    ).resolves.toEqual({ partnerBankDepositRequestId: 'deposit-request-1' });
    expect(admin.assignPartnerBankDepositReconciliationReview).toHaveBeenCalledWith(
      'admin-1',
      'deposit-request-1',
      payload,
    );
    expect(routeMetadata('assignPartnerBankDepositReconciliationReview')).toEqual({
      method: RequestMethod.POST,
      path: 'provider-wallet/deposit-requests/:id/reconciliation-assignment',
    });
  });

  it('exposes bounded bulk Partner deposit reconciliation assignment', async () => {
    const user = { id: 'admin-1' } as never;
    const payload = {
      assigneeAdminId: 'finance-operator-1',
      partnerBankDepositRequestIds: ['deposit-request-1', 'deposit-request-2'],
      reason: 'Assign selected Partner deposit evidence',
    };
    admin.assignPartnerBankDepositReconciliationReviews.mockResolvedValue({ assignedCount: 2 });

    await expect(controller.assignPartnerBankDepositReconciliationReviews(user, payload)).resolves.toEqual({
      assignedCount: 2,
    });
    expect(admin.assignPartnerBankDepositReconciliationReviews).toHaveBeenCalledWith('admin-1', payload);
    expect(routeMetadata('assignPartnerBankDepositReconciliationReviews')).toEqual({
      method: RequestMethod.POST,
      path: 'provider-wallet/deposit-requests/reconciliation-assignments',
    });
  });

  it('forwards Partner deposit owner and SLA filters to the paginated reconciliation query', async () => {
    admin.listPartnerBankDepositRequestHistory.mockResolvedValue({
      items: [],
      pagination: { skip: 0, take: 25, total: 0 },
    });

    await controller.partnerBankDepositRequestHistory(
      'EXECUTED',
      'needs-reconciliation',
      'unassigned',
      'finance-operator-1',
      'escalate',
      '2026-07',
      'VCB',
      '25',
      '0',
    );

    expect(admin.listPartnerBankDepositRequestHistory).toHaveBeenCalledWith({
      assigneeAdminId: 'finance-operator-1',
      owner: 'unassigned',
      period: '2026-07',
      q: 'VCB',
      review: 'needs-reconciliation',
      skip: '0',
      sla: 'escalate',
      status: 'EXECUTED',
      take: '25',
    });
    expect(routeMetadata('partnerBankDepositRequestHistory')).toEqual({
      method: RequestMethod.GET,
      path: 'provider-wallet/deposit-requests/history',
    });
  });

  it('exposes Partner deposit reconciliation workload without an owner filter', async () => {
    admin.partnerBankDepositReconciliationOwnerSummary.mockResolvedValue({
      currency: 'VND',
      openAmount: 150000,
      openCount: 1,
      owners: [],
      unassigned: { openAmount: 150000, openCount: 1, over48hAmount: 150000, over48hCount: 1 },
    });

    await expect(
      controller.partnerBankDepositReconciliationOwnerSummary('EXECUTED', 'escalate', '2026-07', 'VCB'),
    ).resolves.toMatchObject({
      currency: 'VND',
      openAmount: 150000,
      openCount: 1,
    });

    expect(routeMetadata('partnerBankDepositReconciliationOwnerSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'provider-wallet/deposit-requests/reconciliation-owner-summary',
    });
    expect(admin.partnerBankDepositReconciliationOwnerSummary).toHaveBeenCalledWith({
      period: '2026-07',
      q: 'VCB',
      sla: 'escalate',
      status: 'EXECUTED',
    });
  });

  it('exposes manual bank reconciliation match creation by transaction id', async () => {
    const user = { id: 'admin-1' } as never;
    const payload = {
      paymentClearingEntryId: 'clearing-1',
      amount: 900000,
      notes: 'Matched to VCB transfer',
    };
    admin.createBankReconciliationMatch.mockResolvedValue({ id: 'match-1' });

    await expect(
      controller.createBankReconciliationMatch(user, 'bank-tx-1', payload as never),
    ).resolves.toEqual({
      id: 'match-1',
    });

    expect(routeMetadata('createBankReconciliationMatch')).toEqual({
      method: RequestMethod.POST,
      path: 'bank-reconciliation/:id/matches',
    });
    expect(admin.createBankReconciliationMatch).toHaveBeenCalledWith('admin-1', 'bank-tx-1', payload);
  });

  it('exposes manual bank reconciliation match reversal by transaction and match id', async () => {
    const user = { id: 'admin-1' } as never;
    const payload = { reason: 'Wrong payment clearing source' };
    admin.reverseBankReconciliationMatch.mockResolvedValue({ id: 'match-1', status: 'REVERSED' });

    await expect(
      controller.reverseBankReconciliationMatch(user, 'bank-tx-1', 'match-1', payload as never),
    ).resolves.toEqual({
      id: 'match-1',
      status: 'REVERSED',
    });

    expect(routeMetadata('reverseBankReconciliationMatch' as keyof AdminController)).toEqual({
      method: RequestMethod.POST,
      path: 'bank-reconciliation/:id/matches/:matchId/reverse',
    });
    expect(admin.reverseBankReconciliationMatch).toHaveBeenCalledWith(
      'admin-1',
      'bank-tx-1',
      'match-1',
      payload,
    );
  });

  it('exposes approved bank transaction ignore by transaction id', async () => {
    const user = { id: 'admin-1' } as never;
    const payload = {
      approvalAdminId: 'finance-admin-2',
      reason: 'Duplicate statement row imported during reconciliation review',
    };
    admin.ignoreCompanyBankTransaction.mockResolvedValue({
      bankTransaction: { id: 'bank-tx-1', status: 'IGNORED' },
    });

    await expect(controller.ignoreCompanyBankTransaction(user, 'bank-tx-1', payload)).resolves.toEqual({
      bankTransaction: { id: 'bank-tx-1', status: 'IGNORED' },
    });
    expect(routeMetadata('ignoreCompanyBankTransaction' as keyof AdminController)).toEqual({
      method: RequestMethod.POST,
      path: 'bank-reconciliation/:id/ignore',
    });
    expect(admin.ignoreCompanyBankTransaction).toHaveBeenCalledWith('admin-1', 'bank-tx-1', payload);
  });

  it('exposes cash settlement earnings as a bounded filtered finance list', async () => {
    admin.listCashSettlementEarnings.mockResolvedValue([{ id: 'cash-earning-1' }]);

    await expect(controller.cashSettlementEarnings('100', '7d', 'high-debt', 'Mai', '25')).resolves.toEqual([
      { id: 'cash-earning-1' },
    ]);

    expect(routeMetadata('cashSettlementEarnings')).toEqual({
      method: RequestMethod.GET,
      path: 'cash-settlement-earnings',
    });
    expect(admin.listCashSettlementEarnings).toHaveBeenCalledWith({
      q: 'Mai',
      range: '7d',
      queue: 'high-debt',
      skip: '25',
      take: '100',
    });
  });

  it('loads the exact cash settlement earning by id for review', async () => {
    admin.cashSettlementEarningDetail.mockResolvedValue({
      earning: { id: 'cash-earning-22' },
      remainingDebtAmount: 120000,
    });

    await expect(controller.cashSettlementEarning('cash-earning-22')).resolves.toEqual({
      earning: { id: 'cash-earning-22' },
      remainingDebtAmount: 120000,
    });
    expect(routeMetadata('cashSettlementEarning')).toEqual({
      method: RequestMethod.GET,
      path: 'cash-settlement-earnings/:id',
    });
    expect(admin.cashSettlementEarningDetail).toHaveBeenCalledWith('cash-earning-22');
  });

  it('allocates approved deposit evidence through the settlements-owned route', async () => {
    const user = { id: 'finance-admin-1' } as never;
    admin.allocatePartnerBankDepositCashDebt.mockResolvedValue({ id: 'allocation-1' });

    await expect(
      controller.allocateCashSettlementDebt(user, 'cash-earning-22', {
        amount: 120000,
        notes: 'Allocate approved bank deposit evidence',
        reasonCode: 'FINAL_RECOVERY',
        requestId: 'deposit-request-22',
      }),
    ).resolves.toEqual({ id: 'allocation-1' });

    expect(routeMetadata('allocateCashSettlementDebt')).toEqual({
      method: RequestMethod.POST,
      path: 'cash-settlement-earnings/:id/allocations',
    });
    expect(admin.allocatePartnerBankDepositCashDebt).toHaveBeenCalledWith(
      'finance-admin-1',
      'deposit-request-22',
      {
        amount: 120000,
        earningId: 'cash-earning-22',
        notes: 'Allocate approved bank deposit evidence',
        reasonCode: 'FINAL_RECOVERY',
      },
    );
  });

  it('exposes cash settlement summary with the same finance range filter', async () => {
    admin.cashSettlementSummary.mockResolvedValue({ rowCount: 1, totalDebtAmount: 300000 });

    await expect(controller.cashSettlementSummary('7d', 'payment-check', 'booking-1')).resolves.toEqual({
      rowCount: 1,
      totalDebtAmount: 300000,
    });

    expect(routeMetadata('cashSettlementSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'cash-settlement-summary',
    });
    expect(admin.cashSettlementSummary).toHaveBeenCalledWith({
      q: 'booking-1',
      queue: 'payment-check',
      range: '7d',
    });
  });

  it('passes the accounting period to both cash settlement endpoints', async () => {
    admin.listCashSettlementEarnings.mockResolvedValue([]);
    admin.cashSettlementSummary.mockResolvedValue({ rowCount: 0, totalDebtAmount: 0 });

    await controller.cashSettlementEarnings(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, '2026-08');
    await controller.cashSettlementSummary(undefined, undefined, undefined, undefined, undefined, '2026-08');

    expect(admin.listCashSettlementEarnings).toHaveBeenCalledWith(
      expect.objectContaining({ period: '2026-08' }),
    );
    expect(admin.cashSettlementSummary).toHaveBeenCalledWith(
      expect.objectContaining({ period: '2026-08' }),
    );
  });

  it('exposes payout batches as a bounded filtered finance list', async () => {
    admin.listPayoutBatches.mockResolvedValue([{ id: 'payout-1' }]);

    await expect(
      controller.payoutBatches(user, '75', '30d', 'needs-review', '150', 'summary'),
    ).resolves.toEqual([{ id: 'payout-1' }]);

    expect(routeMetadata('payoutBatches')).toEqual({
      method: RequestMethod.GET,
      path: 'payout-batches',
    });
    expect(admin.listPayoutBatches).toHaveBeenCalledWith(
      {
        evidence: undefined,
        q: undefined,
        queue: undefined,
        range: '30d',
        review: 'needs-review',
        skip: '150',
        sort: undefined,
        status: undefined,
        take: '75',
        view: 'summary',
      },
      'admin-1',
    );
  });

  it('exposes payout batch summary with the same finance range and review filters', async () => {
    admin.payoutBatchSummary.mockResolvedValue({ generatedAt: '2026-06-27T00:00:00.000Z', total: 12 });

    await expect(
      controller.payoutBatchSummary(
        '30d',
        'needs-review',
        'missing-transfer-ref',
        'VCB',
        'review',
        'DRAFT',
      ),
    ).resolves.toEqual({
      generatedAt: '2026-06-27T00:00:00.000Z',
      total: 12,
    });

    expect(routeMetadata('payoutBatchSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'payout-batches/summary',
    });
    expect(admin.payoutBatchSummary).toHaveBeenCalledWith({
      evidence: 'missing-transfer-ref',
      q: 'VCB',
      queue: 'review',
      range: '30d',
      review: 'needs-review',
      status: 'DRAFT',
    });
  });

  it('preserves the exact monthly payout bank evidence scope', async () => {
    admin.listPayoutBatches.mockResolvedValue([{ id: 'payout-1' }]);

    await controller.payoutBatches(
      user,
      '25',
      undefined,
      undefined,
      undefined,
      undefined,
      'bank-match-incomplete',
      undefined,
      undefined,
      'oldest',
      'PAID',
      '2026-08',
    );

    expect(admin.listPayoutBatches).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence: 'bank-match-incomplete',
        period: '2026-08',
        sort: 'oldest',
        status: 'PAID',
      }),
      'admin-1',
    );
  });

  it('exposes app sessions as a bounded filtered list', async () => {
    admin.listAppSessions.mockResolvedValue([{ id: 'session-1' }]);

    await expect(controller.appSessions('50', '100', 'customer', 'live', 'ios', '8490')).resolves.toEqual([
      { id: 'session-1' },
    ]);

    expect(routeMetadata('appSessions')).toEqual({
      method: RequestMethod.GET,
      path: 'app-sessions',
    });
    expect(admin.listAppSessions).toHaveBeenCalledWith({
      platform: 'ios',
      q: '8490',
      role: 'customer',
      skip: '100',
      state: 'live',
      take: '50',
    });
  });

  it('exposes app session summary with the same filtered query contract', async () => {
    admin.appSessionSummary.mockResolvedValue({
      expired: 2,
      generatedAt: '2026-06-27T00:00:00.000Z',
      liveCustomers: 11,
      livePartners: 7,
      recent: 5,
      recentCustomers: 4,
      recentPartners: 1,
      stale: 3,
      totalCount: 120,
    });

    await expect(controller.appSessionSummary('customer', 'live', 'ios', '8490')).resolves.toEqual({
      expired: 2,
      generatedAt: '2026-06-27T00:00:00.000Z',
      liveCustomers: 11,
      livePartners: 7,
      recent: 5,
      recentCustomers: 4,
      recentPartners: 1,
      stale: 3,
      totalCount: 120,
    });

    expect(routeMetadata('appSessionSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'app-sessions/summary',
    });
    expect(admin.appSessionSummary).toHaveBeenCalledWith({
      platform: 'ios',
      q: '8490',
      role: 'customer',
      state: 'live',
    });
  });

  it('exposes the bounded Start Shift aggregate as a separate read endpoint', async () => {
    admin.startShiftSummary.mockResolvedValue({
      generatedAt: '2026-06-27T00:00:00.000Z',
      range: '7d',
      unavailableSources: [],
    });

    await expect(controller.startShiftSummary('7d')).resolves.toEqual({
      generatedAt: '2026-06-27T00:00:00.000Z',
      range: '7d',
      unavailableSources: [],
    });

    expect(routeMetadata('startShiftSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'dashboard/start-shift-summary',
    });
    expect(admin.startShiftSummary).toHaveBeenCalledWith('7d');
  });

  it('exposes chat archive as a paged filtered audit list with a separate summary', async () => {
    admin.listChatArchive.mockResolvedValue([{ id: 'booking-1' }]);
    admin.chatArchiveSummary.mockResolvedValue({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 10 });

    await expect(
      controller.chatArchive(
        user,
        'today',
        '2026-06-01',
        '2026-06-02',
        'completed',
        'partner',
        'late',
        '50',
        '100',
        'oldest',
      ),
    ).resolves.toEqual([{ id: 'booking-1' }]);
    await expect(
      controller.chatArchiveSummary('today', '2026-06-01', '2026-06-02', 'completed', 'partner', 'late'),
    ).resolves.toEqual({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 10 });

    expect(routeMetadata('chatArchive')).toEqual({
      method: RequestMethod.GET,
      path: 'chat-archive',
    });
    expect(routeMetadata('chatArchiveSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'chat-archive/summary',
    });
    expect(admin.listChatArchive).toHaveBeenCalledWith(
      {
        dateFrom: '2026-06-01',
        dateRange: 'today',
        dateTo: '2026-06-02',
        q: 'late',
        sender: 'partner',
        skip: '100',
        sort: 'oldest',
        status: 'completed',
        take: '50',
      },
      user,
    );
    expect(admin.chatArchiveSummary).toHaveBeenCalledWith({
      dateFrom: '2026-06-01',
      dateRange: 'today',
      dateTo: '2026-06-02',
      q: 'late',
      sender: 'partner',
      status: 'completed',
    });
  });

  it('exposes customer reviews as a bounded filtered board list with a summary endpoint', async () => {
    admin.listReviews.mockResolvedValue([{ id: 'review-1' }]);
    admin.getReview.mockResolvedValue({ id: 'review-42' });
    admin.reviewSummary.mockResolvedValue({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 8 });

    await expect(
      controller.reviews(
        '25',
        '50',
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'held',
        'rating-desc',
        'mai',
      ),
    ).resolves.toEqual([{ id: 'review-1' }]);
    await expect(
      controller.reviewSummary('2026-06-27T00:00:00.000Z', '2026-06-28T00:00:00.000Z', 'held', 'mai'),
    ).resolves.toEqual({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 8 });
    await expect(controller.review('review-42')).resolves.toEqual({ id: 'review-42' });

    expect(routeMetadata('reviews')).toEqual({
      method: RequestMethod.GET,
      path: 'reviews',
    });
    expect(routeMetadata('reviewSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'reviews/summary',
    });
    expect(routeMetadata('review')).toEqual({ method: RequestMethod.GET, path: 'reviews/:id' });
    expect(admin.getReview).toHaveBeenCalledWith('review-42');
    expect(admin.listReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-06-27T00:00:00.000Z',
        q: 'mai',
        review: 'held',
        skip: '50',
        sort: 'rating-desc',
        take: '25',
        to: '2026-06-28T00:00:00.000Z',
      }),
    );
    expect(admin.reviewSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-06-27T00:00:00.000Z',
        q: 'mai',
        review: 'held',
        to: '2026-06-28T00:00:00.000Z',
      }),
    );
  });

  it('exposes audited manual customer review creation for completed Partner bookings', async () => {
    const body = {
      bookingId: 'booking-1',
      providerProfileId: 'provider-1',
      rating: 5,
      comment: 'Excellent service',
      createdAt: '2026-07-20T17:00:00.000Z',
    };
    admin.createManualPartnerReview.mockResolvedValue({ id: 'review-1' });

    await expect(controller.createManualPartnerReview(user, body)).resolves.toEqual({ id: 'review-1' });
    expect(routeMetadata('createManualPartnerReview')).toEqual({
      method: RequestMethod.POST,
      path: 'reviews/manual',
    });
    expect(admin.createManualPartnerReview).toHaveBeenCalledWith(user.id, body);
  });

  it('exposes partner customer evaluations as a bounded filtered list with a summary endpoint', async () => {
    admin.listPartnerCustomerReviews.mockResolvedValue([{ id: 'evaluation-1' }]);
    admin.partnerCustomerReviewSummary.mockResolvedValue({
      generatedAt: '2026-06-27T00:00:00.000Z',
      totalCount: 4,
    });

    await expect(
      controller.partnerCustomerReviews(
        '10',
        '20',
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'oldest',
        'needs-review',
        'late',
      ),
    ).resolves.toEqual([{ id: 'evaluation-1' }]);
    await expect(
      controller.partnerCustomerReviewSummary('2026-06-27T00:00:00.000Z', '2026-06-28T00:00:00.000Z', 'late'),
    ).resolves.toEqual({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 4 });

    expect(routeMetadata('partnerCustomerReviews')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-customer-reviews',
    });
    expect(routeMetadata('partnerCustomerReviewSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-customer-reviews/summary',
    });
    expect(admin.listPartnerCustomerReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-06-27T00:00:00.000Z',
        q: 'late',
        skip: '20',
        sort: 'oldest',
        status: 'needs-review',
        take: '10',
        to: '2026-06-28T00:00:00.000Z',
      }),
    );
    expect(admin.partnerCustomerReviewSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-06-27T00:00:00.000Z',
        q: 'late',
        to: '2026-06-28T00:00:00.000Z',
      }),
    );
  });

  it('passes detail page review identity filters through to the admin service', async () => {
    admin.listReviews.mockResolvedValue([{ id: 'review-1' }]);
    admin.listPartnerCustomerReviews.mockResolvedValue([{ id: 'evaluation-1' }]);

    await expect(
      controller.reviews(
        '50',
        '0',
        undefined,
        undefined,
        undefined,
        'newest',
        undefined,
        'provider-1',
        undefined,
        undefined,
      ),
    ).resolves.toEqual([{ id: 'review-1' }]);
    await expect(
      controller.partnerCustomerReviews(
        '50',
        '0',
        undefined,
        undefined,
        'newest',
        undefined,
        undefined,
        'provider-1',
        undefined,
        undefined,
      ),
    ).resolves.toEqual([{ id: 'evaluation-1' }]);

    expect(admin.listReviews).toHaveBeenCalledWith(
      expect.objectContaining({ providerProfileId: 'provider-1' }),
    );
    expect(admin.listPartnerCustomerReviews).toHaveBeenCalledWith(
      expect.objectContaining({ providerProfileId: 'provider-1' }),
    );
  });

  it('loads and moderates one Partner note through audited review routes', async () => {
    const body = { status: 'REPORTED', reason: 'Booking context requires verification' };
    admin.getPartnerCustomerReview.mockResolvedValue({ id: 'evaluation-1' });
    admin.moderatePartnerCustomerReview.mockResolvedValue({ id: 'evaluation-1', status: 'REPORTED' });

    await expect(controller.partnerCustomerReview('evaluation-1')).resolves.toEqual({ id: 'evaluation-1' });
    await expect(
      controller.moderatePartnerCustomerReview(user, 'evaluation-1', body as never),
    ).resolves.toEqual({
      id: 'evaluation-1',
      status: 'REPORTED',
    });

    expect(routeMetadata('partnerCustomerReview')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-customer-reviews/:id',
    });
    expect(routeMetadata('moderatePartnerCustomerReview')).toEqual({
      method: RequestMethod.PATCH,
      path: 'partner-customer-reviews/:id/moderate',
    });
    expect(admin.moderatePartnerCustomerReview).toHaveBeenCalledWith('admin-1', 'evaluation-1', body);
  });

  it('exposes notification templates as a bounded GET catalog', async () => {
    admin.listNotificationTemplates.mockResolvedValue([{ key: 'booking.matched' }]);

    await expect(controller.notificationTemplates('25', '50')).resolves.toEqual([{ key: 'booking.matched' }]);

    expect(routeMetadata('notificationTemplates')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications/templates',
    });
    expect(admin.listNotificationTemplates).toHaveBeenCalledWith({ skip: '50', take: '25' });
  });

  it('exposes notification template copy updates as an audited PATCH action', async () => {
    const body = {
      locale: 'en',
      title: 'Booking matched',
      body: 'Your booking has a Partner.',
      enabled: true,
    };
    admin.updateNotificationTemplate.mockResolvedValue({ key: 'booking.matched' });

    await expect(controller.updateNotificationTemplate(user, 'booking.matched', body)).resolves.toEqual({
      key: 'booking.matched',
    });

    expect(routeMetadata('updateNotificationTemplate')).toEqual({
      method: RequestMethod.PATCH,
      path: 'notifications/templates/:key',
    });
    expect(admin.updateNotificationTemplate).toHaveBeenCalledWith('admin-1', 'booking.matched', body);
  });

  it('exposes provider controls reports and sanctions as bounded lists', async () => {
    admin.listProviderReports.mockResolvedValue([{ id: 'report-1' }]);
    admin.listProviderSanctions.mockResolvedValue([{ id: 'sanction-1' }]);

    await expect(
      controller.providerReports('25', '50', 'linh', 'overdue', 'OPEN', 'HIGH_PLUS', 'oldest', 'true'),
    ).resolves.toEqual([{ id: 'report-1' }]);
    await expect(
      controller.providerSanctions('30', '60', 'hold', 'ACTIVE', 'PAYOUT_HOLD', 'oldest', 'true'),
    ).resolves.toEqual([{ id: 'sanction-1' }]);

    expect(routeMetadata('providerReports')).toEqual({
      method: RequestMethod.GET,
      path: ['provider-reports', 'partner-reports'],
    });
    expect(routeMetadata('providerSanctions')).toEqual({
      method: RequestMethod.GET,
      path: ['provider-sanctions', 'partner-sanctions'],
    });
    expect(admin.listProviderReports).toHaveBeenCalledWith({
      q: 'linh',
      review: 'overdue',
      severity: 'HIGH_PLUS',
      skip: '50',
      sort: 'oldest',
      status: 'OPEN',
      take: '25',
      withTotal: 'true',
    });
    expect(admin.listProviderSanctions).toHaveBeenCalledWith({
      q: 'hold',
      skip: '60',
      sort: 'oldest',
      status: 'ACTIVE',
      take: '30',
      type: 'PAYOUT_HOLD',
      withTotal: 'true',
    });
  });

  it('exposes manual push campaigns with preview before send', async () => {
    const body = {
      targetRole: 'CUSTOMER' as never,
      locale: 'en',
      title: 'HANDS update',
      body: 'Your booking update is ready.',
    };
    admin.listAdminPushCampaigns.mockResolvedValue([{ id: 'campaign-1' }]);
    admin.previewAdminPushCampaign.mockResolvedValue({ recipientCount: 2, willSendCount: 2 });
    admin.createAdminPushCampaign.mockResolvedValue({ id: 'campaign-1' });

    await expect(
      controller.pushCampaigns('25', '50', '2026-06-27T00:00:00.000Z', '2026-06-28T00:00:00.000Z'),
    ).resolves.toEqual([{ id: 'campaign-1' }]);
    await expect(controller.previewPushCampaign(body)).resolves.toEqual({
      recipientCount: 2,
      willSendCount: 2,
    });
    await expect(controller.createPushCampaign(user, body)).resolves.toEqual({ id: 'campaign-1' });

    expect(routeMetadata('pushCampaigns')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications/push-campaigns',
    });
    expect(routeMetadata('previewPushCampaign')).toEqual({
      method: RequestMethod.POST,
      path: 'notifications/push-campaigns/preview',
    });
    expect(routeMetadata('createPushCampaign')).toEqual({
      method: RequestMethod.POST,
      path: 'notifications/push-campaigns',
    });
    expect(admin.listAdminPushCampaigns).toHaveBeenCalledWith({
      from: '2026-06-27T00:00:00.000Z',
      skip: '50',
      take: '25',
      to: '2026-06-28T00:00:00.000Z',
    });
    expect(admin.createAdminPushCampaign).toHaveBeenCalledWith('admin-1', body);
  });

  it('exposes manual push campaign summary as a separate aggregate endpoint', async () => {
    admin.adminPushCampaignSummary.mockResolvedValue({
      generatedAt: '2026-06-27T00:00:00.000Z',
      totalCount: 40,
      totalNotifications: 780,
      totalRecipients: 800,
    });

    await expect(
      controller.pushCampaignSummary('2026-06-27T00:00:00.000Z', '2026-06-28T00:00:00.000Z'),
    ).resolves.toEqual({
      generatedAt: '2026-06-27T00:00:00.000Z',
      totalCount: 40,
      totalNotifications: 780,
      totalRecipients: 800,
    });

    expect(routeMetadata('pushCampaignSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications/push-campaigns/summary',
    });
    expect(admin.adminPushCampaignSummary).toHaveBeenCalledWith({
      from: '2026-06-27T00:00:00.000Z',
      to: '2026-06-28T00:00:00.000Z',
    });
  });

  it('exposes coupon deletion as an audited DELETE action', async () => {
    admin.deleteCoupon.mockResolvedValue({ couponId: 'coupon-1', ok: true });

    await expect(controller.deleteCoupon(user, 'coupon-1')).resolves.toEqual({
      couponId: 'coupon-1',
      ok: true,
    });

    expect(routeMetadata('deleteCoupon')).toEqual({
      method: RequestMethod.DELETE,
      path: 'coupons/:id',
    });
    expect(admin.deleteCoupon).toHaveBeenCalledWith('admin-1', 'coupon-1');
  });

  it('passes bounded coupon list filters to the service', async () => {
    admin.listCoupons.mockResolvedValue([]);

    await expect(controller.coupons('10', '20', 'records', 'WELCOME')).resolves.toEqual([]);

    expect(routeMetadata('coupons')).toEqual({
      method: RequestMethod.GET,
      path: 'coupons',
    });
    expect(admin.listCoupons).toHaveBeenCalledWith({
      q: 'WELCOME',
      skip: '20',
      state: 'records',
      take: '10',
    });
  });

  it('exposes coupon summary as a separate aggregate endpoint', async () => {
    admin.couponSummary.mockResolvedValue({ liveCount: 2, totalCount: 4 });

    await expect(controller.couponSummary('live', 'WELCOME')).resolves.toEqual({
      liveCount: 2,
      totalCount: 4,
    });

    expect(routeMetadata('couponSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'coupons/summary',
    });
    expect(admin.couponSummary).toHaveBeenCalledWith({ q: 'WELCOME', state: 'live' });
  });

  it('exposes coupon usage as a paged list endpoint', async () => {
    admin.listCouponUsageBookings.mockResolvedValue({ couponId: 'coupon-1', rows: [], totalCount: 0 });

    await expect(controller.couponUsage('coupon-1', '10', '20')).resolves.toEqual({
      couponId: 'coupon-1',
      rows: [],
      totalCount: 0,
    });

    expect(routeMetadata('couponUsage')).toEqual({
      method: RequestMethod.GET,
      path: 'coupons/:id/usage',
    });
    expect(admin.listCouponUsageBookings).toHaveBeenCalledWith('coupon-1', { skip: '20', take: '10' });
  });

  it('loads one coupon independently for confirmations and drawers', async () => {
    admin.getCoupon.mockResolvedValue({ code: 'PAGE2', id: 'coupon-page-2' });

    await expect(controller.coupon('coupon-page-2')).resolves.toEqual({
      code: 'PAGE2',
      id: 'coupon-page-2',
    });
    expect(routeMetadata('coupon')).toEqual({
      method: RequestMethod.GET,
      path: 'coupons/:id',
    });
    expect(admin.getCoupon).toHaveBeenCalledWith('coupon-page-2');
  });

  it('passes coupon batch creation to the service with the current operator', async () => {
    const body = {
      coupons: [{ code: 'WELCOME10', discount: { type: 'percent', value: 10 }, active: false }],
    };
    admin.createCouponBatch.mockResolvedValue({ createdCount: 1, failedCount: 0, results: [] });

    await expect(controller.createCouponBatch(user, body)).resolves.toMatchObject({ createdCount: 1 });
    expect(routeMetadata('createCouponBatch')).toEqual({
      method: RequestMethod.POST,
      path: 'coupons/batch',
    });
    expect(admin.createCouponBatch).toHaveBeenCalledWith('admin-1', body.coupons);
  });

  it('exposes file review providers as a lightweight paged GET list', async () => {
    admin.listFileReviewProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.fileReviewProviders('25', '50')).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('fileReviewProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'files/review-providers',
    });
    expect(admin.listFileReviewProviders).toHaveBeenCalledWith({ skip: '50', take: '25' });
  });

  it('exposes file review items as a file-paged GET list', async () => {
    admin.listFileReviewItems.mockResolvedValue({ rows: [{ id: 'file-1' }], totalCount: 1 });

    await expect(
      controller.fileReviewItems('10', '20', 'gallery', 'public-media', 'needs-review'),
    ).resolves.toEqual({ rows: [{ id: 'file-1' }], totalCount: 1 });

    expect(routeMetadata('fileReviewItems')).toEqual({
      method: RequestMethod.GET,
      path: 'files/review-items',
    });
    expect(admin.listFileReviewItems).toHaveBeenCalledWith({
      kind: 'public-media',
      q: 'gallery',
      review: 'needs-review',
      skip: '20',
      take: '10',
    });
  });

  it('exposes file review summary as a separate aggregate endpoint', async () => {
    admin.fileReviewSummary.mockResolvedValue({
      generatedAt: '2026-06-27T00:00:00.000Z',
      total: 12,
      totalProviders: 3,
    });

    await expect(controller.fileReviewSummary()).resolves.toEqual({
      generatedAt: '2026-06-27T00:00:00.000Z',
      total: 12,
      totalProviders: 3,
    });

    expect(routeMetadata('fileReviewSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'files/review-summary',
    });
    expect(admin.fileReviewSummary).toHaveBeenCalledWith();
  });

  it('exposes operations policy providers as a lightweight GET list', async () => {
    admin.listOperationsPolicyProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.operationsPolicyProviders('50')).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('operationsPolicyProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-policy/providers',
    });
    expect(admin.listOperationsPolicyProviders).toHaveBeenCalledWith({ take: '50' });
  });

  it('exposes operational policy settings with optional key filtering', async () => {
    admin.listOperationalPolicySettings.mockResolvedValue([
      { key: 'notification.partner_alert_channel', value: 'IN_APP_WITH_PUSH_LATER' },
    ]);

    await expect(controller.operationalPolicy('notification.partner_alert_channel')).resolves.toEqual([
      { key: 'notification.partner_alert_channel', value: 'IN_APP_WITH_PUSH_LATER' },
    ]);

    expect(routeMetadata('operationalPolicy')).toEqual({
      method: RequestMethod.GET,
      path: 'operational-policy',
    });
    expect(admin.listOperationalPolicySettings).toHaveBeenCalledWith({
      keys: 'notification.partner_alert_channel',
    });
  });

  it('exposes Vietnam region overview as an aggregate GET list', async () => {
    admin.getVietnamOverview.mockResolvedValue({ regions: [] });

    await expect(controller.vietnamOverview()).resolves.toEqual({ regions: [] });

    expect(routeMetadata('vietnamOverview')).toEqual({
      method: RequestMethod.GET,
      path: ['vietnam-overview', 'maps/vietnam-overview'],
    });
    expect(admin.getVietnamOverview).toHaveBeenCalledWith(undefined);
  });

  it('exposes Vietnam overview summary without map point payloads', async () => {
    admin.getVietnamOverviewSummary.mockResolvedValue({ regions: [], points: [] });

    await expect(controller.vietnamOverviewSummary('7d')).resolves.toEqual({ regions: [], points: [] });

    expect(routeMetadata('vietnamOverviewSummary')).toEqual({
      method: RequestMethod.GET,
      path: ['vietnam-overview/summary', 'maps/vietnam-overview/summary'],
    });
    expect(admin.getVietnamOverviewSummary).toHaveBeenCalledWith('7d');
  });

  it('exposes Vietnam realtime map points as a bounded point feed', async () => {
    admin.getVietnamOverviewRealtimePoints.mockResolvedValue({ realtimePoints: [] });

    await expect(controller.vietnamOverviewRealtimePoints('today', '20')).resolves.toEqual({
      realtimePoints: [],
    });

    expect(routeMetadata('vietnamOverviewRealtimePoints')).toEqual({
      method: RequestMethod.GET,
      path: ['vietnam-overview/realtime-points', 'maps/vietnam-overview/realtime-points'],
    });
    expect(admin.getVietnamOverviewRealtimePoints).toHaveBeenCalledWith('today', { take: '20' });
  });

  it('exposes usage overview as a bounded aggregate GET list', async () => {
    admin.getUsageOverview.mockResolvedValue({ range: 'month', customerUsage: [], partnerUsage: [] });

    await expect(controller.usageOverview('month', '2026-07-01', '2026-07-19')).resolves.toEqual({
      range: 'month',
      customerUsage: [],
      partnerUsage: [],
    });

    expect(routeMetadata('usageOverview')).toEqual({
      method: RequestMethod.GET,
      path: 'usage-overview',
    });
    expect(admin.getUsageOverview).toHaveBeenCalledWith({
      from: '2026-07-01',
      range: 'month',
      to: '2026-07-19',
    });
  });

  it('exposes partner overview as a bounded operational GET endpoint', async () => {
    admin.getPartnerOverview.mockResolvedValue({
      source: 'live-summary-backed-partner-operational-query',
      summaryKpis: [],
    });

    await expect(
      controller.partnerOverview(
        '7d',
        'hcm',
        'service-1',
        'APPROVED',
        'online',
        'negative',
        'high',
        undefined,
        undefined,
        'false',
        '5',
      ),
    ).resolves.toEqual({
      source: 'live-summary-backed-partner-operational-query',
      summaryKpis: [],
    });

    expect(routeMetadata('partnerOverview')).toEqual({
      method: RequestMethod.GET,
      path: 'partners/overview',
    });
    expect(admin.getPartnerOverview).toHaveBeenCalledWith({
      city: 'hcm',
      includeActionRows: false,
      onlineStatus: 'online',
      previewLimit: '5',
      range: '7d',
      riskStatus: 'high',
      serviceId: 'service-1',
      verificationStatus: 'APPROVED',
      walletStatus: 'negative',
    });
  });

  it('passes partner detail diagnostics intent to the service while preserving default compatibility', async () => {
    admin.getProviderDetail.mockResolvedValue({ id: 'partner-1' });

    await expect(controller.providerDetail('partner-1', undefined)).resolves.toEqual({ id: 'partner-1' });
    await expect(controller.providerDetail('partner-1', 'false')).resolves.toEqual({ id: 'partner-1' });
    await expect(controller.providerDetail('partner-1', 'false', 'finance')).resolves.toEqual({
      id: 'partner-1',
    });
    await expect(controller.providerDetail('partner-1', 'false', 'evidence')).resolves.toEqual({
      id: 'partner-1',
    });

    expect(routeMetadata('providerDetail')).toEqual({
      method: RequestMethod.GET,
      path: ['providers/:id', 'partners/:id'],
    });
    expect(admin.getProviderDetail).toHaveBeenNthCalledWith(1, 'partner-1', { includeDiagnostics: true });
    expect(admin.getProviderDetail).toHaveBeenNthCalledWith(2, 'partner-1', { includeDiagnostics: false });
    expect(admin.getProviderDetail).toHaveBeenNthCalledWith(3, 'partner-1', {
      includeDiagnostics: false,
      view: 'finance',
    });
    expect(admin.getProviderDetail).toHaveBeenNthCalledWith(4, 'partner-1', {
      includeDiagnostics: false,
      view: 'evidence',
    });
  });

  it('passes customer detail diagnostics intent to the service while preserving default compatibility', async () => {
    admin.getCustomerDetail.mockResolvedValue({ id: 'customer-1' });

    await expect(controller.customerDetail('customer-1', undefined)).resolves.toEqual({ id: 'customer-1' });
    await expect(controller.customerDetail('customer-1', 'false')).resolves.toEqual({ id: 'customer-1' });

    expect(routeMetadata('customerDetail')).toEqual({
      method: RequestMethod.GET,
      path: 'customers/:id',
    });
    expect(admin.getCustomerDetail).toHaveBeenNthCalledWith(1, 'customer-1', { includeDiagnostics: true });
    expect(admin.getCustomerDetail).toHaveBeenNthCalledWith(2, 'customer-1', { includeDiagnostics: false });
  });

  it('exposes a bounded customer wallet ledger endpoint', async () => {
    admin.getCustomerWalletLedger.mockResolvedValue({ rows: [], summary: { totalCount: 0 } });

    await expect(controller.customerWalletLedger('customer-1', '10', '20', 'VND')).resolves.toEqual({
      rows: [],
      summary: { totalCount: 0 },
    });

    expect(routeMetadata('customerWalletLedger')).toEqual({
      method: RequestMethod.GET,
      path: 'customers/:id/wallet-ledger',
    });
    expect(admin.getCustomerWalletLedger).toHaveBeenCalledWith('customer-1', {
      currency: 'VND',
      skip: '20',
      take: '10',
    });
  });

  it('passes booking detail diagnostics intent to the service while preserving default compatibility', async () => {
    admin.getBookingDetail.mockResolvedValue({ id: 'booking-1' });

    await expect(controller.bookingDetail(user, 'booking-1', undefined)).resolves.toEqual({
      id: 'booking-1',
    });
    await expect(controller.bookingDetail(user, 'booking-1', 'false')).resolves.toEqual({ id: 'booking-1' });

    expect(routeMetadata('bookingDetail')).toEqual({
      method: RequestMethod.GET,
      path: 'bookings/:id',
    });
    expect(admin.getBookingDetail).toHaveBeenNthCalledWith(1, 'booking-1', {
      includeDiagnostics: true,
      viewer: user,
    });
    expect(admin.getBookingDetail).toHaveBeenNthCalledWith(2, 'booking-1', {
      includeDiagnostics: false,
      viewer: user,
    });
  });

  it('passes the authenticated admin to retained booking chat reads', async () => {
    admin.listBookingChatMessages.mockResolvedValue({ bookingId: 'booking-1', messages: [] });

    await expect(controller.bookingChatMessages(user, 'booking-1')).resolves.toEqual({
      bookingId: 'booking-1',
      messages: [],
    });
    expect(admin.listBookingChatMessages).toHaveBeenCalledWith('booking-1', user);
  });

  it('exposes marketing overview as a separate aggregate GET endpoint', async () => {
    admin.getMarketingOverview.mockResolvedValue({ source: 'stored-marketing-aggregates', bySource: [] });

    await expect(controller.marketingOverview('7d', 'referral', 'ios', 'hcm', 'ref-smoke')).resolves.toEqual({
      source: 'stored-marketing-aggregates',
      bySource: [],
    });

    expect(routeMetadata('marketingOverview')).toEqual({
      method: RequestMethod.GET,
      path: 'marketing/overview',
    });
    expect(admin.getMarketingOverview).toHaveBeenCalledWith({
      range: '7d',
      source: 'referral',
      platform: 'ios',
      regionCode: 'hcm',
      campaignId: 'ref-smoke',
    });
  });

  it('exposes marketing summary as the default lightweight aggregate endpoint', async () => {
    admin.getMarketingSummary.mockResolvedValue({ source: 'stored-marketing-aggregates', totals: {} });

    await expect(controller.marketingSummary('7d', 'referral', 'ios', 'hcm', 'ref-smoke')).resolves.toEqual({
      source: 'stored-marketing-aggregates',
      totals: {},
    });

    expect(routeMetadata('marketingSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'marketing/summary',
    });
    expect(admin.getMarketingSummary).toHaveBeenCalledWith({
      range: '7d',
      source: 'referral',
      platform: 'ios',
      regionCode: 'hcm',
      campaignId: 'ref-smoke',
    });
  });

  it('exposes coupon marketing summary separately from paged coupon rows', async () => {
    admin.getMarketingCouponSummary.mockResolvedValue({
      appliedBookingCount: 12,
      completedBookingCount: 8,
      range: '7d',
    });

    await expect(controller.marketingCouponSummary('7d')).resolves.toEqual({
      appliedBookingCount: 12,
      completedBookingCount: 8,
      range: '7d',
    });
    expect(routeMetadata('marketingCouponSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'marketing/coupons/summary',
    });
    expect(admin.getMarketingCouponSummary).toHaveBeenCalledWith({ range: '7d' });
  });

  it('exposes bounded coupon marketing rows with range paging', async () => {
    admin.listMarketingCouponPerformance.mockResolvedValue({
      rows: [{ couponCode: 'WELCOME10' }],
      totalCount: 1,
    });

    await expect(controller.marketingCouponPerformance('30d', '10', '20')).resolves.toEqual({
      rows: [{ couponCode: 'WELCOME10' }],
      totalCount: 1,
    });
    expect(routeMetadata('marketingCouponPerformance')).toEqual({
      method: RequestMethod.GET,
      path: 'marketing/coupons',
    });
    expect(admin.listMarketingCouponPerformance).toHaveBeenCalledWith({
      range: '30d',
      skip: '20',
      take: '10',
    });
  });

  it('exposes marketing dimensions as separate paged list endpoints', async () => {
    admin.listMarketingDimensionRows.mockResolvedValue({ dimension: 'source', rows: [] });

    await expect(
      controller.marketingDimension('source', '7d', 'referral', 'ios', 'hcm', 'ref-smoke', '10', '20'),
    ).resolves.toEqual({
      dimension: 'source',
      rows: [],
    });

    expect(routeMetadata('marketingDimension')).toEqual({
      method: RequestMethod.GET,
      path: 'marketing/dimensions/:dimension',
    });
    expect(admin.listMarketingDimensionRows).toHaveBeenCalledWith({
      dimension: 'source',
      range: '7d',
      source: 'referral',
      platform: 'ios',
      regionCode: 'hcm',
      campaignId: 'ref-smoke',
      take: '10',
      skip: '20',
    });
  });

  it('exposes manual marketing spend upserts as an audited POST action', async () => {
    const body = {
      spendDate: '2026-06-20',
      source: 'Google Ads',
      platform: 'ANDROID',
      regionCode: 'hcm',
      campaignId: 'launch-hcm',
      expectedUpdatedAt: null,
      reason: 'record Google invoice total',
      spendAmount: 600000,
    };
    admin.upsertMarketingSpendDaily.mockResolvedValue({ id: 'marketing-spend-1' });

    await expect(controller.upsertMarketingSpendDaily(user, body)).resolves.toEqual({
      id: 'marketing-spend-1',
    });

    expect(routeMetadata('upsertMarketingSpendDaily')).toEqual({
      method: RequestMethod.POST,
      path: 'marketing/spend-daily',
    });
    expect(admin.upsertMarketingSpendDaily).toHaveBeenCalledWith('admin-1', body);
  });

  it('exposes exact manual marketing spend evidence as a GET action', async () => {
    admin.getMarketingSpendDaily.mockResolvedValue({ id: 'marketing-spend-1' });

    await expect(
      controller.marketingSpendDaily('2026-06-20', 'google', 'android', 'hcm', 'launch-hcm'),
    ).resolves.toEqual({ id: 'marketing-spend-1' });

    expect(routeMetadata('marketingSpendDaily')).toEqual({
      method: RequestMethod.GET,
      path: 'marketing/spend-daily',
    });
    expect(admin.getMarketingSpendDaily).toHaveBeenCalledWith({
      campaignId: 'launch-hcm',
      platform: 'android',
      regionCode: 'hcm',
      source: 'google',
      spendDate: '2026-06-20',
    });
  });

  it('exposes referral policy settings as a read-only GET endpoint', async () => {
    admin.listReferralPolicies.mockResolvedValue({
      customer: { enabled: false },
      partner: { enabled: false },
    });

    await expect(controller.referralPolicies()).resolves.toEqual({
      customer: { enabled: false },
      partner: { enabled: false },
    });

    expect(routeMetadata('referralPolicies')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/policies',
    });
    expect(admin.listReferralPolicies).toHaveBeenCalledWith();
  });

  it('exposes referral policy updates as an audited PATCH action', async () => {
    admin.updateReferralPolicy.mockResolvedValue({ audience: 'CUSTOMER', enabled: true });

    await expect(
      controller.updateReferralPolicy(user, 'customer', {
        enabled: true,
        rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
        commissionPercentBps: 500,
      }),
    ).resolves.toEqual({ audience: 'CUSTOMER', enabled: true });

    expect(routeMetadata('updateReferralPolicy')).toEqual({
      method: RequestMethod.PATCH,
      path: 'referrals/policies/:audience',
    });
    expect(admin.updateReferralPolicy).toHaveBeenCalledWith('admin-1', 'customer', {
      enabled: true,
      rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
      commissionPercentBps: 500,
    });
  });

  it('exposes customer referral parent accounts without listing every customer', async () => {
    admin.listCustomerReferralParents.mockResolvedValue([{ referrer: { id: 'customer-1' } }]);

    await expect(
      controller.customerReferralParents('25', '50', 'Parent', 'blocked', 'held', 'flagged', '30d'),
    ).resolves.toEqual([{ referrer: { id: 'customer-1' } }]);

    expect(routeMetadata('customerReferralParents')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/customers',
    });
    expect(admin.listCustomerReferralParents).toHaveBeenCalledWith({
      q: 'Parent',
      reward: 'held',
      fraud: 'flagged',
      range: '30d',
      skip: '50',
      status: 'blocked',
      take: '25',
    });
  });

  it('exposes customer referral parent summary without loading parent rows', async () => {
    admin.customerReferralParentSummary.mockResolvedValue({ totalCount: 12, rewardQueueSummaries: [] });

    await expect(
      controller.customerReferralParentSummary(undefined, undefined, undefined, 'held', '7d'),
    ).resolves.toEqual({
      totalCount: 12,
      rewardQueueSummaries: [],
    });

    expect(routeMetadata('customerReferralParentSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/customers/summary',
    });
    expect(admin.customerReferralParentSummary).toHaveBeenCalledWith({
      q: undefined,
      reward: undefined,
      fraud: 'held',
      range: '7d',
      status: undefined,
    });
  });

  it('exposes a customer referral parent detail only for referral activity drilldown', async () => {
    admin.getCustomerReferralParent.mockResolvedValue({ referrer: { id: 'customer-1' } });

    await expect(controller.customerReferralParent('customer-1')).resolves.toEqual({
      referrer: { id: 'customer-1' },
    });

    expect(routeMetadata('customerReferralParent')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/customers/:id',
    });
    expect(admin.getCustomerReferralParent).toHaveBeenCalledWith('customer-1');
  });

  it('exposes partner referral parent accounts without listing every partner', async () => {
    admin.listPartnerReferralParents.mockResolvedValue([{ referrer: { id: 'partner-1' } }]);

    await expect(
      controller.partnerReferralParents('10', '20', 'Partner', 'qualified', 'available', 'clear', 'today'),
    ).resolves.toEqual([{ referrer: { id: 'partner-1' } }]);

    expect(routeMetadata('partnerReferralParents')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/partners',
    });
    expect(admin.listPartnerReferralParents).toHaveBeenCalledWith({
      q: 'Partner',
      reward: 'available',
      fraud: 'clear',
      range: 'today',
      skip: '20',
      status: 'qualified',
      take: '10',
    });
  });

  it('exposes partner referral parent summary without loading parent rows', async () => {
    admin.partnerReferralParentSummary.mockResolvedValue({ totalCount: 7, rewardQueueSummaries: [] });

    await expect(controller.partnerReferralParentSummary()).resolves.toEqual({
      totalCount: 7,
      rewardQueueSummaries: [],
    });

    expect(routeMetadata('partnerReferralParentSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/partners/summary',
    });
    expect(admin.partnerReferralParentSummary).toHaveBeenCalledWith({
      q: undefined,
      reward: undefined,
      status: undefined,
    });
  });

  it('exposes referral cashout queue as a bounded cross-audience reward list', async () => {
    admin.listReferralCashoutQueue.mockResolvedValue([{ id: 'reward-1', audience: 'CUSTOMER' }]);
    admin.referralCashoutQueueSummary.mockResolvedValue({ totalCount: 3, statusSummaries: [] });

    await expect(
      controller.referralCashoutQueue('25', '50', 'customer', 'approved', 'parent'),
    ).resolves.toEqual([{ id: 'reward-1', audience: 'CUSTOMER' }]);
    await expect(controller.referralCashoutQueueSummary('partner', 'needs-action', 'smoke')).resolves.toEqual(
      {
        totalCount: 3,
        statusSummaries: [],
      },
    );

    expect(routeMetadata('referralCashoutQueue')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/cashouts',
    });
    expect(routeMetadata('referralCashoutQueueSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/cashouts/summary',
    });
    expect(admin.listReferralCashoutQueue).toHaveBeenCalledWith({
      audience: 'customer',
      q: 'parent',
      skip: '50',
      status: 'approved',
      take: '25',
    });
    expect(admin.referralCashoutQueueSummary).toHaveBeenCalledWith({
      audience: 'partner',
      q: 'smoke',
      status: 'needs-action',
    });
  });

  it('exposes referral reward hold-window release as a POST action', async () => {
    admin.releaseAvailableReferralRewards.mockResolvedValue({ releasedCount: 2 });

    await expect(controller.releaseAvailableReferralRewards(user)).resolves.toEqual({ releasedCount: 2 });

    expect(routeMetadata('releaseAvailableReferralRewards')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/release-available',
    });
    expect(admin.releaseAvailableReferralRewards).toHaveBeenCalledWith('admin-1');
  });

  it('exposes referral reward hold as a POST action', async () => {
    admin.holdReferralReward.mockResolvedValue({ id: 'reward-1', status: 'HELD' });

    await expect(controller.holdReferralReward(user, 'reward-1', { reason: 'review' })).resolves.toEqual({
      id: 'reward-1',
      status: 'HELD',
    });

    expect(routeMetadata('holdReferralReward')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/:id/hold',
    });
    expect(admin.holdReferralReward).toHaveBeenCalledWith('admin-1', 'reward-1', { reason: 'review' });
  });

  it('exposes referral reward wallet credit as a POST action', async () => {
    admin.creditReferralReward.mockResolvedValue({
      id: 'reward-1',
      status: 'REWARDED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    await expect(controller.creditReferralReward(user, 'reward-1', { reason: 'ready' })).resolves.toEqual({
      id: 'reward-1',
      status: 'REWARDED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    expect(routeMetadata('creditReferralReward')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/:id/credit',
    });
    expect(admin.creditReferralReward).toHaveBeenCalledWith('admin-1', 'reward-1', { reason: 'ready' });
  });

  it('exposes referral reward cashout approval as a POST action', async () => {
    admin.approveReferralRewardCashout.mockResolvedValue({
      id: 'reward-1',
      status: 'CASHOUT_APPROVED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    await expect(
      controller.approveReferralRewardCashout(user, 'reward-1', { reason: 'paid' }),
    ).resolves.toEqual({
      id: 'reward-1',
      status: 'CASHOUT_APPROVED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    expect(routeMetadata('approveReferralRewardCashout')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/:id/cashout-approve',
    });
    expect(admin.approveReferralRewardCashout).toHaveBeenCalledWith('admin-1', 'reward-1', {
      reason: 'paid',
    });
  });

  it('exposes referral reward tax review requirement as a POST action', async () => {
    admin.requireReferralRewardTaxReview.mockResolvedValue({
      id: 'reward-1',
      status: 'TAX_REVIEW_REQUIRED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    await expect(
      controller.requireReferralRewardTaxReview(user, 'reward-1', { reason: 'tax review' }),
    ).resolves.toEqual({
      id: 'reward-1',
      status: 'TAX_REVIEW_REQUIRED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    expect(routeMetadata('requireReferralRewardTaxReview')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/:id/tax-review',
    });
    expect(admin.requireReferralRewardTaxReview).toHaveBeenCalledWith('admin-1', 'reward-1', {
      reason: 'tax review',
    });
  });

  it('exposes referral reward cashout paid closeout as a POST action', async () => {
    admin.markReferralRewardCashoutPaid.mockResolvedValue({
      id: 'reward-1',
      status: 'PAID',
      walletLedgerReference: 'customer-cashout-ledger-1',
    });

    await expect(
      controller.markReferralRewardCashoutPaid(user, 'reward-1', {
        approvalAdminId: 'finance-admin-2',
        reason: 'paid manually',
        transferRef: 'VCB-REF-001',
      }),
    ).resolves.toEqual({
      id: 'reward-1',
      status: 'PAID',
      walletLedgerReference: 'customer-cashout-ledger-1',
    });

    expect(routeMetadata('markReferralRewardCashoutPaid')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/:id/cashout-paid',
    });
    expect(admin.markReferralRewardCashoutPaid).toHaveBeenCalledWith('admin-1', 'reward-1', {
      approvalAdminId: 'finance-admin-2',
      reason: 'paid manually',
      transferRef: 'VCB-REF-001',
    });
  });

  it('exposes referral reward reverse as a POST action', async () => {
    admin.reverseReferralReward.mockResolvedValue({ id: 'reward-1', status: 'REVERSED' });

    await expect(controller.reverseReferralReward(user, 'reward-1', { reason: 'invalid' })).resolves.toEqual({
      id: 'reward-1',
      status: 'REVERSED',
    });

    expect(routeMetadata('reverseReferralReward')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/:id/reverse',
    });
    expect(admin.reverseReferralReward).toHaveBeenCalledWith('admin-1', 'reward-1', { reason: 'invalid' });
  });

  it('exposes a partner referral parent detail only for referral activity drilldown', async () => {
    admin.getPartnerReferralParent.mockResolvedValue({ referrer: { id: 'partner-1' } });

    await expect(controller.partnerReferralParent('partner-1')).resolves.toEqual({
      referrer: { id: 'partner-1' },
    });

    expect(routeMetadata('partnerReferralParent')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/partners/:id',
    });
    expect(admin.getPartnerReferralParent).toHaveBeenCalledWith('partner-1');
  });

  it('exposes operations handoff providers as a lightweight GET list', async () => {
    admin.listOperationsHandoffProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.operationsHandoffProviders('25', '50', 'attention', 'true')).resolves.toEqual([
      { id: 'partner-1' },
    ]);

    expect(routeMetadata('operationsHandoffProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-handoff/providers',
    });
    expect(admin.listOperationsHandoffProviders).toHaveBeenCalledWith({
      review: 'attention',
      skip: '50',
      take: '25',
      withTotal: 'true',
    });
  });

  it('exposes the unified operations handoff activity stream as a paged GET contract', async () => {
    admin.operationsHandoffActivityPage.mockResolvedValue({
      items: [{ id: 'audit-1', kind: 'AUDIT' }],
      pagination: { page: 2, pageSize: 3, totalPages: 4, totalRows: 12 },
    });

    await expect(
      controller.operationsHandoffActivity(
        '30d',
        '2',
        '3',
        'needs-review',
        'legacy',
        'finance',
        'over-24h',
        'oldest',
        'finance-unpaid',
      ),
    ).resolves.toMatchObject({
      items: [{ id: 'audit-1', kind: 'AUDIT' }],
      pagination: { page: 2, pageSize: 3, totalRows: 12 },
    });

    expect(routeMetadata('operationsHandoffActivity')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-handoff/activity',
    });
    expect(admin.operationsHandoffActivityPage).toHaveBeenCalledWith({
      age: 'over-24h',
      backlog: 'legacy',
      page: '2',
      pageSize: '3',
      range: '30d',
      reason: 'finance-unpaid',
      review: 'needs-review',
      sort: 'oldest',
      source: 'finance',
    });
  });

  it('exposes auditable shift handoff creation and acknowledgement contracts', async () => {
    const body = {
      incomingOperatorId: 'incoming-admin',
      note: 'Review refund evidence.',
      outgoingShift: 'Evening shift',
      ownerId: 'finance-admin',
      unresolvedCaseIds: ['refund-17'],
    };
    admin.listOperationsShiftHandoffs.mockResolvedValue({ items: [], openCount: 0, totalCount: 0 });
    admin.createOperationsShiftHandoff.mockResolvedValue({ handoffId: 'handoff-1', ok: true });
    admin.acknowledgeOperationsShiftHandoff.mockResolvedValue({ handoffId: 'handoff-1', ok: true });

    admin.listOperationsHandoffOpenCases.mockResolvedValue({ items: [], openCount: 0 });
    admin.listOperationsHandoffOperators.mockResolvedValue([]);
    await expect(
      controller.operationsHandoffOpenCases(user, '2', '25', 'refund', 'refund-review', 'over-24h'),
    ).resolves.toMatchObject({ openCount: 0 });
    await expect(controller.operationsHandoffOperators(user)).resolves.toEqual([]);
    await expect(
      controller.operationsShiftHandoffs(
        user,
        'open',
        '7d',
        '2',
        '25',
        'incoming-admin',
        'refund',
        'current',
        'assigned',
      ),
    ).resolves.toMatchObject({ openCount: 0 });
    await expect(controller.createOperationsShiftHandoff(user, body)).resolves.toMatchObject({
      handoffId: 'handoff-1',
    });
    await expect(controller.acknowledgeOperationsShiftHandoff(user, 'handoff-1')).resolves.toMatchObject({
      handoffId: 'handoff-1',
    });

    expect(routeMetadata('operationsShiftHandoffs')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-handoff/shift',
    });
    expect(routeMetadata('operationsHandoffOpenCases')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-handoff/open-cases',
    });
    expect(routeMetadata('operationsHandoffOperators')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-handoff/operators',
    });
    expect(routeMetadata('createOperationsShiftHandoff')).toEqual({
      method: RequestMethod.POST,
      path: 'operations-handoff/shift',
    });
    expect(routeMetadata('acknowledgeOperationsShiftHandoff')).toEqual({
      method: RequestMethod.POST,
      path: 'operations-handoff/shift/:id/acknowledge',
    });
    expect(admin.createOperationsShiftHandoff).toHaveBeenCalledWith('admin-1', body);
    expect(admin.acknowledgeOperationsShiftHandoff).toHaveBeenCalledWith('admin-1', 'handoff-1');
    expect(admin.listOperationsHandoffOpenCases).toHaveBeenCalledWith({
      actorId: 'admin-1',
      age: 'over-24h',
      page: '2',
      pageSize: '25',
      q: 'refund',
      queue: 'refund-review',
    });
    expect(admin.listOperationsShiftHandoffs).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        relationship: 'assigned',
        status: 'open',
      }),
    );
  });

  it('exposes admin users as a bounded list', async () => {
    admin.listUsers.mockResolvedValue([{ id: 'user-1' }]);

    await expect(controller.users('50', '100', 'ADMIN', 'finance-approver-directory')).resolves.toEqual([
      { id: 'user-1' },
    ]);

    expect(routeMetadata('users')).toEqual({
      method: RequestMethod.GET,
      path: 'users',
    });
    expect(admin.listUsers).toHaveBeenCalledWith({
      role: 'ADMIN',
      skip: '100',
      take: '50',
      view: 'finance-approver-directory',
    });
  });

  it('exposes finance approver role changes as an audited PATCH action', async () => {
    admin.updateUserFinanceApproverRole.mockResolvedValue({
      user: { id: 'finance-admin-2', roles: ['ADMIN', 'FINANCE_APPROVER'] },
    });

    await expect(
      (
        controller as unknown as {
          updateUserFinanceApproverRole: (
            actor: AuthenticatedUser,
            userId: string,
            body: { enabled: boolean; reason?: string },
          ) => Promise<unknown>;
        }
      ).updateUserFinanceApproverRole(user, 'finance-admin-2', {
        enabled: true,
        reason: 'Treasury owner',
      }),
    ).resolves.toEqual({
      user: { id: 'finance-admin-2', roles: ['ADMIN', 'FINANCE_APPROVER'] },
    });

    expect(routeMetadata('updateUserFinanceApproverRole' as keyof AdminController)).toEqual({
      method: RequestMethod.PATCH,
      path: 'users/:id/finance-approver',
    });
    expect(admin.updateUserFinanceApproverRole).toHaveBeenCalledWith('admin-1', 'finance-admin-2', {
      enabled: true,
      reason: 'Treasury owner',
    });
  });

  it('exposes master admin operator creation as an audited POST action', async () => {
    admin.createAdminOperator.mockResolvedValue({
      user: { id: 'master-admin-2', roles: ['ADMIN', 'MASTER_ADMIN'] },
    });

    await expect(
      (
        controller as unknown as {
          createAdminOperator: (
            actor: AuthenticatedUser,
            body: { phone: string; roles?: string[]; permissionCategories?: string[]; reason?: string },
          ) => Promise<unknown>;
        }
      ).createAdminOperator(user, {
        permissionCategories: ['SYSTEM'],
        phone: '+84900000009',
        reason: 'Bootstrap master',
        roles: ['MASTER_ADMIN'],
      }),
    ).resolves.toEqual({
      user: { id: 'master-admin-2', roles: ['ADMIN', 'MASTER_ADMIN'] },
    });

    expect(routeMetadata('createAdminOperator' as keyof AdminController)).toEqual({
      method: RequestMethod.POST,
      path: 'users/admin-operators',
    });
    expect(admin.createAdminOperator).toHaveBeenCalledWith('admin-1', {
      permissionCategories: ['SYSTEM'],
      phone: '+84900000009',
      reason: 'Bootstrap master',
      roles: ['MASTER_ADMIN'],
    });
  });

  it('exposes master admin operator access updates as an audited PATCH action', async () => {
    admin.updateAdminOperatorAccess.mockResolvedValue({
      user: { id: 'ops-admin-2', roles: ['ADMIN'] },
    });

    await expect(
      (
        controller as unknown as {
          updateAdminOperatorAccess: (
            actor: AuthenticatedUser,
            userId: string,
            body: { roles?: string[]; permissionCategories?: string[]; reason?: string },
          ) => Promise<unknown>;
        }
      ).updateAdminOperatorAccess(user, 'ops-admin-2', {
        permissionCategories: ['BOOKINGS', 'CUSTOMERS'],
        reason: 'Queue rotation',
        roles: ['ADMIN'],
      }),
    ).resolves.toEqual({
      user: { id: 'ops-admin-2', roles: ['ADMIN'] },
    });

    expect(routeMetadata('updateAdminOperatorAccess' as keyof AdminController)).toEqual({
      method: RequestMethod.PATCH,
      path: 'users/:id/admin-operator-access',
    });
    expect(admin.updateAdminOperatorAccess).toHaveBeenCalledWith('admin-1', 'ops-admin-2', {
      permissionCategories: ['BOOKINGS', 'CUSTOMERS'],
      reason: 'Queue rotation',
      roles: ['ADMIN'],
    });
  });

  it('exposes master admin operator access revocation as an audited DELETE action', async () => {
    admin.revokeAdminOperatorAccess.mockResolvedValue({
      ok: true,
      user: { id: 'ops-admin-2', roles: [] },
    });

    await expect(
      (
        controller as unknown as {
          revokeAdminOperatorAccess: (
            actor: AuthenticatedUser,
            userId: string,
            body: { reason?: string },
          ) => Promise<unknown>;
        }
      ).revokeAdminOperatorAccess(user, 'ops-admin-2', {
        reason: 'Left operations team',
      }),
    ).resolves.toEqual({
      ok: true,
      user: { id: 'ops-admin-2', roles: [] },
    });

    expect(routeMetadata('revokeAdminOperatorAccess' as keyof AdminController)).toEqual({
      method: RequestMethod.DELETE,
      path: 'users/:id/admin-operator',
    });
    expect(admin.revokeAdminOperatorAccess).toHaveBeenCalledWith('admin-1', 'ops-admin-2', {
      reason: 'Left operations team',
    });
  });

  it('exposes admin operator access lookup for Admin Web session enforcement', async () => {
    admin.getAdminOperatorAccess.mockResolvedValue({ id: 'ops-admin-2' });

    await expect(
      (
        controller as unknown as {
          adminOperatorAccess: (actor: AuthenticatedUser, identity?: string) => Promise<unknown>;
        }
      ).adminOperatorAccess(user, 'ops@hands.vn'),
    ).resolves.toEqual({ id: 'ops-admin-2' });

    expect(routeMetadata('adminOperatorAccess' as keyof AdminController)).toEqual({
      method: RequestMethod.GET,
      path: 'users/admin-operator-access',
    });
    expect(admin.getAdminOperatorAccess).toHaveBeenCalledWith('admin-1', 'ops@hands.vn');
  });

  it('exposes admin web activity recording for operator audit history', async () => {
    admin.recordAdminOperatorActivity.mockResolvedValue({ ok: true });

    await expect(
      (
        controller as unknown as {
          recordAdminOperatorActivity: (
            actor: AuthenticatedUser,
            body: { action: string; operatorIdentity?: string; target: string },
          ) => Promise<unknown>;
        }
      ).recordAdminOperatorActivity(user, {
        action: 'admin_web.page_view',
        operatorIdentity: 'ops@hands.vn',
        target: 'admin_page:/admin-operators',
      }),
    ).resolves.toEqual({ ok: true });

    expect(routeMetadata('recordAdminOperatorActivity' as keyof AdminController)).toEqual({
      method: RequestMethod.POST,
      path: 'operator-activity',
    });
    expect(admin.recordAdminOperatorActivity).toHaveBeenCalledWith('admin-1', {
      action: 'admin_web.page_view',
      operatorIdentity: 'ops@hands.vn',
      target: 'admin_page:/admin-operators',
    });
  });

  it('exposes partner control providers as a lightweight GET list', async () => {
    admin.listPartnerControlProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(
      controller.partnerControlProviders('25', '50', 'linh', 'risk', 'oldest', 'true'),
    ).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('partnerControlProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-controls/providers',
    });
    expect(admin.listPartnerControlProviders).toHaveBeenCalledWith({
      q: 'linh',
      review: 'risk',
      skip: '50',
      sort: 'oldest',
      take: '25',
      withTotal: 'true',
    });
  });

  it('exposes partner control summary separately from lightweight provider rows', async () => {
    admin.partnerControlSummary.mockResolvedValue({
      activeControls: 3,
      blockedAccounts: 2,
      locationGaps: 4,
      onboardingGaps: 5,
      openReports: 6,
      sharedDevices: 1,
      urgentMajorReports: 7,
      walletDebt: 8,
    });

    await expect(controller.partnerControlSummary()).resolves.toEqual({
      activeControls: 3,
      blockedAccounts: 2,
      locationGaps: 4,
      onboardingGaps: 5,
      openReports: 6,
      sharedDevices: 1,
      urgentMajorReports: 7,
      walletDebt: 8,
    });

    expect(routeMetadata('partnerControlSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-controls/summary',
    });
    expect(admin.partnerControlSummary).toHaveBeenCalledWith();
  });

  it('exposes partner directory providers as a lightweight GET list', async () => {
    admin.listPartnerDirectoryProviders.mockResolvedValue([{ id: 'partner-1' }]);
    admin.partnerDirectorySummary.mockResolvedValue({
      generatedAt: '2026-06-27T00:00:00.000Z',
      totalCount: 12,
    });

    await expect(
      controller.partnerDirectoryProviders(
        '25',
        '50',
        'linh',
        'unapproved',
        'SUBMITTED',
        'ONLINE_AVAILABLE',
        'APPROVED',
        'completed-work',
        'name',
        'app-inactive-7d',
        '4-24h',
        'overdue',
        '7d',
        'identity-documents',
        'rejected-evidence',
      ),
    ).resolves.toEqual([{ id: 'partner-1' }]);
    await expect(
      controller.partnerDirectorySummary(
        'linh',
        'unapproved',
        'SUBMITTED',
        'ONLINE_AVAILABLE',
        'APPROVED',
        'completed-work',
        'app-inactive-7d',
        '4-24h',
        'overdue',
        '7d',
        'identity-documents',
        'rejected-evidence',
      ),
    ).resolves.toEqual({
      generatedAt: '2026-06-27T00:00:00.000Z',
      totalCount: 12,
    });

    expect(routeMetadata('partnerDirectoryProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'partners/list-providers',
    });
    expect(routeMetadata('partnerDirectorySummary')).toEqual({
      method: RequestMethod.GET,
      path: 'partners/list-providers/summary',
    });
    expect(admin.listPartnerDirectoryProviders).toHaveBeenCalledWith({
      age: '4-24h',
      activity: 'app-inactive-7d',
      approvalMissing: 'identity-documents',
      approvalRisk: 'rejected-evidence',
      q: 'linh',
      qualityRange: '7d',
      review: 'unapproved',
      sla: 'overdue',
      skip: '50',
      sort: 'name',
      take: '25',
      verification: 'SUBMITTED',
      providerStatus: 'ONLINE_AVAILABLE',
      kyc: 'APPROVED',
      bookingFlow: 'completed-work',
    });
    expect(admin.partnerDirectorySummary).toHaveBeenCalledWith({
      age: '4-24h',
      activity: 'app-inactive-7d',
      approvalMissing: 'identity-documents',
      approvalRisk: 'rejected-evidence',
      q: 'linh',
      qualityRange: '7d',
      review: 'unapproved',
      sla: 'overdue',
      verification: 'SUBMITTED',
      providerStatus: 'ONLINE_AVAILABLE',
      kyc: 'APPROVED',
      bookingFlow: 'completed-work',
    });
  });

  it('exposes an optional operational scope for the service catalog', async () => {
    admin.listServices.mockResolvedValue([{ id: 'svc-foot-60' }]);

    await expect(controller.services('operational')).resolves.toEqual([{ id: 'svc-foot-60' }]);

    expect(routeMetadata('services')).toEqual({
      method: RequestMethod.GET,
      path: 'services',
    });
    expect(admin.listServices).toHaveBeenCalledWith({ scope: 'operational' });
  });
});

function routeMetadata(methodName: keyof AdminController) {
  const handler = AdminController.prototype[methodName] as unknown as (...args: unknown[]) => unknown;
  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    path: Reflect.getMetadata(PATH_METADATA, handler),
  };
}
