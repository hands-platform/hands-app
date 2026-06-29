import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ReferralRewardMode } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';

describe('AdminController notification and push actions', () => {
  const admin = {
    enablePushDevice: vi.fn(),
    listFileReviewProviders: vi.fn(),
    fileReviewSummary: vi.fn(),
    getMarketingOverview: vi.fn(),
    listMarketingDimensionRows: vi.fn(),
    getMarketingSummary: vi.fn(),
    getUsageOverview: vi.fn(),
    getVietnamOverview: vi.fn(),
    getVietnamOverviewRealtimePoints: vi.fn(),
    getVietnamOverviewSummary: vi.fn(),
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
    listOperationsPolicyProviders: vi.fn(),
    listOperationalPolicySettings: vi.fn(),
    listAuditLogs: vi.fn(),
    auditLogSummary: vi.fn(),
    listUsers: vi.fn(),
    listNotifications: vi.fn(),
    notificationSummary: vi.fn(),
    listProviderReports: vi.fn(),
    listProviderSanctions: vi.fn(),
    listReviews: vi.fn(),
    reviewSummary: vi.fn(),
    listPartnerCustomerReviews: vi.fn(),
    partnerCustomerReviewSummary: vi.fn(),
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
    refundSummary: vi.fn(),
    listEarnings: vi.fn(),
    earningsSummary: vi.fn(),
    listCashSettlementEarnings: vi.fn(),
    cashSettlementSummary: vi.fn(),
    previewManualWalletAdjustment: vi.fn(),
    createManualWalletAdjustment: vi.fn(),
    listManualWalletAdjustments: vi.fn(),
    recordPartnerBankDeposit: vi.fn(),
    listProviderWalletWithdrawalRequests: vi.fn(),
    providerWalletWithdrawalRequestSummary: vi.fn(),
    listBookingSettlementSnapshots: vi.fn(),
    bookingSettlementSnapshotSummary: vi.fn(),
    listPartnerWithholdingTax: vi.fn(),
    partnerWithholdingTaxSummary: vi.fn(),
    listMonthlyTaxClosings: vi.fn(),
    monthlyTaxClosingSummary: vi.fn(),
    updateMonthlyTaxClosingStatus: vi.fn(),
    platformVatSummary: vi.fn(),
    paymentFeeSummary: vi.fn(),
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
    couponSummary: vi.fn(),
    listCouponUsageBookings: vi.fn(),
    retryNotification: vi.fn(),
    updateNotificationTemplate: vi.fn(),
    updateReferralPolicy: vi.fn(),
    upsertMarketingSpendDaily: vi.fn(),
    listAppSessions: vi.fn(),
    appSessionSummary: vi.fn(),
    listChatArchive: vi.fn(),
    chatArchiveSummary: vi.fn(),
    listBookingNotifications: vi.fn(),
    listBookingMarketplaceProviders: vi.fn(),
  };
  const controller = new AdminController(admin as unknown as AdminService);
  const user = { id: 'admin-1' } as AuthenticatedUser;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes push device enablement as a POST action and delegates with actor id', async () => {
    admin.enablePushDevice.mockResolvedValue({ ok: true, pushDeviceId: 'push-device-1' });

    await expect(controller.enablePushDevice(user, 'push-device-1')).resolves.toEqual({
      ok: true,
      pushDeviceId: 'push-device-1',
    });

    expect(routeMetadata('enablePushDevice')).toEqual({
      method: RequestMethod.POST,
      path: 'push-devices/:id/enable',
    });
    expect(admin.enablePushDevice).toHaveBeenCalledWith('admin-1', 'push-device-1');
  });

  it('exposes notification retry as a POST action and delegates with actor id', async () => {
    admin.retryNotification.mockResolvedValue({ ok: true, notificationId: 'notification-1' });

    await expect(controller.retryNotification(user, 'notification-1')).resolves.toEqual({
      ok: true,
      notificationId: 'notification-1',
    });

    expect(routeMetadata('retryNotification')).toEqual({
      method: RequestMethod.POST,
      path: 'notifications/:id/retry',
    });
    expect(admin.retryNotification).toHaveBeenCalledWith('admin-1', 'notification-1');
  });

  it('exposes notifications as a bounded board list', async () => {
    admin.listNotifications.mockResolvedValue([{ id: 'notification-1' }]);

    await expect(
      controller.notifications(
        '25',
        '40',
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'failed',
        'booking-1',
      ),
    ).resolves.toEqual([{ id: 'notification-1' }]);

    expect(routeMetadata('notifications')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications',
    });
    expect(admin.listNotifications).toHaveBeenCalledWith({
      from: '2026-06-27T00:00:00.000Z',
      booking: 'booking-1',
      review: 'failed',
      skip: '40',
      take: '25',
      to: '2026-06-28T00:00:00.000Z',
    });
  });

  it('exposes partner bank deposit approval as a POST action and delegates with actor id', async () => {
    admin.recordPartnerBankDeposit.mockResolvedValue({ id: 'wallet-deposit-1' });

    await expect(
      controller.recordPartnerBankDeposit(user, {
        providerProfileId: 'provider-1',
        amount: 1000000,
        bankTransactionId: 'BIDV-20260629-001',
        depositDate: '2026-06-29T09:30:00.000Z',
        attachmentFileId: 'file-deposit-proof-1',
      }),
    ).resolves.toEqual({ id: 'wallet-deposit-1' });

    expect(routeMetadata('recordPartnerBankDeposit')).toEqual({
      method: RequestMethod.POST,
      path: 'provider-wallet/deposits',
    });
    expect(admin.recordPartnerBankDeposit).toHaveBeenCalledWith('admin-1', {
      providerProfileId: 'provider-1',
      amount: 1000000,
      bankTransactionId: 'BIDV-20260629-001',
      depositDate: '2026-06-29T09:30:00.000Z',
      attachmentFileId: 'file-deposit-proof-1',
    });
  });

  it('exposes manual wallet adjustment preview and creation as admin-only POST actions', async () => {
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
    admin.createManualWalletAdjustment.mockResolvedValue({ ledger: { id: 'ledger-1' } });

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
    expect(admin.previewManualWalletAdjustment).toHaveBeenCalledWith('admin-1', payload);
    expect(admin.createManualWalletAdjustment).toHaveBeenCalledWith('admin-1', payload);
  });

  it('exposes manual wallet adjustment history with owner filtering', async () => {
    admin.listManualWalletAdjustments.mockResolvedValue([{ id: 'ledger-1' }]);

    await expect(
      controller.manualWalletAdjustments('25', 'PARTNER', 'provider-1'),
    ).resolves.toEqual([{ id: 'ledger-1' }]);

    expect(routeMetadata('manualWalletAdjustments')).toEqual({
      method: RequestMethod.GET,
      path: 'wallet-adjustments',
    });
    expect(admin.listManualWalletAdjustments).toHaveBeenCalledWith({
      ownerId: 'provider-1',
      ownerType: 'PARTNER',
      take: '25',
    });
  });

  it('exposes partner wallet withdrawal requests with provider filtering', async () => {
    admin.listProviderWalletWithdrawalRequests.mockResolvedValue([{ id: 'withdrawal-request-1' }]);

    await expect(
      controller.providerWalletWithdrawalRequests('10', 'all', 'REQUESTED', 'provider-1'),
    ).resolves.toEqual([{ id: 'withdrawal-request-1' }]);

    expect(routeMetadata('providerWalletWithdrawalRequests')).toEqual({
      method: RequestMethod.GET,
      path: 'provider-wallet/withdrawal-requests',
    });
    expect(admin.listProviderWalletWithdrawalRequests).toHaveBeenCalledWith({
      providerProfileId: 'provider-1',
      range: 'all',
      status: 'REQUESTED',
      take: '10',
    });
  });

  it('exposes partner wallet withdrawal request summary with provider filtering', async () => {
    admin.providerWalletWithdrawalRequestSummary.mockResolvedValue({ total: 4 });

    await expect(
      controller.providerWalletWithdrawalRequestSummary('7d', 'provider-1'),
    ).resolves.toEqual({ total: 4 });

    expect(routeMetadata('providerWalletWithdrawalRequestSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'provider-wallet/withdrawal-requests/summary',
    });
    expect(admin.providerWalletWithdrawalRequestSummary).toHaveBeenCalledWith({
      providerProfileId: 'provider-1',
      range: '7d',
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
    admin.auditLogSummary.mockResolvedValue({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 120 });

    await expect(
      controller.auditLogs(
        'booking.create.rejected',
        '20',
        '40',
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'booking-1',
        'Notification',
        '4',
      ),
    ).resolves.toEqual([{ id: 'audit-1' }]);
    await expect(
      controller.auditLogSummary(
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'booking-1',
        'Notification',
        '4',
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
      action: 'booking.create.rejected',
      bucket: 'Notification',
      from: '2026-06-27T00:00:00.000Z',
      priority: '4',
      q: 'booking-1',
      skip: '40',
      take: '20',
      to: '2026-06-28T00:00:00.000Z',
    });
    expect(admin.auditLogSummary).toHaveBeenCalledWith({
      bucket: 'Notification',
      from: '2026-06-27T00:00:00.000Z',
      priority: '4',
      q: 'booking-1',
      to: '2026-06-28T00:00:00.000Z',
    });
  });

  it('exposes notification summary as a separate aggregate endpoint', async () => {
    admin.notificationSummary.mockResolvedValue({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 2400 });

    await expect(
      controller.notificationSummary(
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'failed',
        'booking-1',
      ),
    ).resolves.toEqual({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 2400 });

    expect(routeMetadata('notificationSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications/summary',
    });
    expect(admin.notificationSummary).toHaveBeenCalledWith({
      from: '2026-06-27T00:00:00.000Z',
      booking: 'booking-1',
      review: 'failed',
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
    });
  });

  it('exposes payments as a bounded filtered operations list', async () => {
    admin.listPayments.mockResolvedValue([{ id: 'payment-1' }]);

    await expect(controller.payments('25', 'today', 'cash-debt')).resolves.toEqual([{ id: 'payment-1' }]);

    expect(routeMetadata('payments')).toEqual({
      method: RequestMethod.GET,
      path: 'payments',
    });
    expect(admin.listPayments).toHaveBeenCalledWith({
      range: 'today',
      review: 'cash-debt',
      take: '25',
    });
  });

  it('exposes payment summary with the same operations filters', async () => {
    admin.paymentSummary.mockResolvedValue({ totalCount: 42, needsAction: 7 });

    await expect(controller.paymentSummary('7d', 'callback-review')).resolves.toEqual({
      totalCount: 42,
      needsAction: 7,
    });

    expect(routeMetadata('paymentSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'payments/summary',
    });
    expect(admin.paymentSummary).toHaveBeenCalledWith({
      range: '7d',
      review: 'callback-review',
    });
  });

  it('exposes payment callback attempts as a bounded filtered ledger list', async () => {
    admin.listPaymentCallbackAttempts.mockResolvedValue([{ id: 'attempt-1' }]);

    await expect(
      controller.paymentCallbackAttempts('75', '7d', 'callback-review'),
    ).resolves.toEqual([{ id: 'attempt-1' }]);

    expect(routeMetadata('paymentCallbackAttempts')).toEqual({
      method: RequestMethod.GET,
      path: 'payment-callback-attempts',
    });
    expect(admin.listPaymentCallbackAttempts).toHaveBeenCalledWith({
      range: '7d',
      review: 'callback-review',
      take: '75',
    });
  });

  it('exposes refunds as a bounded filtered operations list', async () => {
    admin.listRefunds.mockResolvedValue([{ id: 'refund-1' }]);

    await expect(controller.refunds('50', '30d', 'needs-update')).resolves.toEqual([{ id: 'refund-1' }]);

    expect(routeMetadata('refunds')).toEqual({
      method: RequestMethod.GET,
      path: 'refunds',
    });
    expect(admin.listRefunds).toHaveBeenCalledWith({
      range: '30d',
      review: 'needs-update',
      take: '50',
    });
  });

  it('exposes refund summary with the same operations filters', async () => {
    admin.refundSummary.mockResolvedValue({ totalCount: 12, requestedCount: 4 });

    await expect(controller.refundSummary('30d', 'needs-update')).resolves.toEqual({
      totalCount: 12,
      requestedCount: 4,
    });

    expect(routeMetadata('refundSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'refunds/summary',
    });
    expect(admin.refundSummary).toHaveBeenCalledWith({
      range: '30d',
      review: 'needs-update',
    });
  });

  it('exposes earnings as a bounded filtered finance list', async () => {
    admin.listEarnings.mockResolvedValue([{ id: 'earning-1' }]);

    await expect(controller.earnings('75', '7d', 'ready')).resolves.toEqual([{ id: 'earning-1' }]);

    expect(routeMetadata('earnings')).toEqual({
      method: RequestMethod.GET,
      path: 'earnings',
    });
    expect(admin.listEarnings).toHaveBeenCalledWith({
      range: '7d',
      review: 'ready',
      take: '75',
    });
  });

  it('exposes earning summary with the same finance range filter', async () => {
    admin.earningsSummary.mockResolvedValue({ count: 1, grossAmount: 200000 });

    await expect(controller.earningsSummary('today')).resolves.toEqual({
      count: 1,
      grossAmount: 200000,
    });

    expect(routeMetadata('earningsSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'earnings/summary',
    });
    expect(admin.earningsSummary).toHaveBeenCalledWith({ range: 'today' });
  });

  it('exposes booking settlement snapshots as a bounded filtered finance list', async () => {
    admin.listBookingSettlementSnapshots.mockResolvedValue([{ id: 'settlement-1' }]);

    await expect(controller.bookingSettlementSnapshots('50', '7d', 'open')).resolves.toEqual([
      { id: 'settlement-1' },
    ]);

    expect(routeMetadata('bookingSettlementSnapshots')).toEqual({
      method: RequestMethod.GET,
      path: 'booking-settlement-snapshots',
    });
    expect(admin.listBookingSettlementSnapshots).toHaveBeenCalledWith({
      range: '7d',
      review: 'open',
      take: '50',
    });
  });

  it('exposes booking settlement snapshot summary with the same filters', async () => {
    admin.bookingSettlementSnapshotSummary.mockResolvedValue({
      count: 1,
      partnerWithholdingTotal: 42000,
    });

    await expect(controller.bookingSettlementSnapshotSummary('30d', 'paid')).resolves.toEqual({
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
    });
  });

  it('exposes partner withholding tax monthly summaries', async () => {
    admin.listPartnerWithholdingTax.mockResolvedValue([{ providerProfileId: 'provider-1' }]);

    await expect(controller.partnerWithholdingTax('2026-06', '25')).resolves.toEqual([
      { providerProfileId: 'provider-1' },
    ]);

    expect(routeMetadata('partnerWithholdingTax')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-withholding-tax',
    });
    expect(admin.listPartnerWithholdingTax).toHaveBeenCalledWith({
      period: '2026-06',
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

    await expect(controller.monthlyTaxClosings('2026-06', '25')).resolves.toEqual([{ period: '2026-06' }]);

    expect(routeMetadata('monthlyTaxClosings')).toEqual({
      method: RequestMethod.GET,
      path: 'monthly-tax-closings',
    });
    expect(admin.listMonthlyTaxClosings).toHaveBeenCalledWith({
      period: '2026-06',
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

  it('exposes cash settlement earnings as a bounded filtered finance list', async () => {
    admin.listCashSettlementEarnings.mockResolvedValue([{ id: 'cash-earning-1' }]);

    await expect(controller.cashSettlementEarnings('100', '7d')).resolves.toEqual([{ id: 'cash-earning-1' }]);

    expect(routeMetadata('cashSettlementEarnings')).toEqual({
      method: RequestMethod.GET,
      path: 'cash-settlement-earnings',
    });
    expect(admin.listCashSettlementEarnings).toHaveBeenCalledWith({
      range: '7d',
      take: '100',
    });
  });

  it('exposes cash settlement summary with the same finance range filter', async () => {
    admin.cashSettlementSummary.mockResolvedValue({ rowCount: 1, totalDebtAmount: 300000 });

    await expect(controller.cashSettlementSummary('7d')).resolves.toEqual({
      rowCount: 1,
      totalDebtAmount: 300000,
    });

    expect(routeMetadata('cashSettlementSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'cash-settlement-summary',
    });
    expect(admin.cashSettlementSummary).toHaveBeenCalledWith({ range: '7d' });
  });

  it('exposes payout batches as a bounded filtered finance list', async () => {
    admin.listPayoutBatches.mockResolvedValue([{ id: 'payout-1' }]);

    await expect(controller.payoutBatches('75', '30d', 'needs-review')).resolves.toEqual([
      { id: 'payout-1' },
    ]);

    expect(routeMetadata('payoutBatches')).toEqual({
      method: RequestMethod.GET,
      path: 'payout-batches',
    });
    expect(admin.listPayoutBatches).toHaveBeenCalledWith({
      range: '30d',
      review: 'needs-review',
      take: '75',
    });
  });

  it('exposes payout batch summary with the same finance range and review filters', async () => {
    admin.payoutBatchSummary.mockResolvedValue({ generatedAt: '2026-06-27T00:00:00.000Z', total: 12 });

    await expect(controller.payoutBatchSummary('30d', 'needs-review')).resolves.toEqual({
      generatedAt: '2026-06-27T00:00:00.000Z',
      total: 12,
    });

    expect(routeMetadata('payoutBatchSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'payout-batches/summary',
    });
    expect(admin.payoutBatchSummary).toHaveBeenCalledWith({
      range: '30d',
      review: 'needs-review',
    });
  });

  it('exposes app sessions as a bounded filtered list', async () => {
    admin.listAppSessions.mockResolvedValue([{ id: 'session-1' }]);

    await expect(
      controller.appSessions('50', '100', 'customer', 'live', 'ios', '8490'),
    ).resolves.toEqual([{ id: 'session-1' }]);

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

  it('exposes chat archive as a paged filtered audit list with a separate summary', async () => {
    admin.listChatArchive.mockResolvedValue([{ id: 'booking-1' }]);
    admin.chatArchiveSummary.mockResolvedValue({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 10 });

    await expect(
      controller.chatArchive('today', '2026-06-01', '2026-06-02', 'completed', 'partner', 'late', '50', '100'),
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
    expect(admin.listChatArchive).toHaveBeenCalledWith({
      dateFrom: '2026-06-01',
      dateRange: 'today',
      dateTo: '2026-06-02',
      q: 'late',
      sender: 'partner',
      skip: '100',
      status: 'completed',
      take: '50',
    });
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
      controller.reviewSummary(
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'held',
        'mai',
      ),
    ).resolves.toEqual({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 8 });

    expect(routeMetadata('reviews')).toEqual({
      method: RequestMethod.GET,
      path: 'reviews',
    });
    expect(routeMetadata('reviewSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'reviews/summary',
    });
    expect(admin.listReviews).toHaveBeenCalledWith(expect.objectContaining({
      from: '2026-06-27T00:00:00.000Z',
      q: 'mai',
      review: 'held',
      skip: '50',
      sort: 'rating-desc',
      take: '25',
      to: '2026-06-28T00:00:00.000Z',
    }));
    expect(admin.reviewSummary).toHaveBeenCalledWith(expect.objectContaining({
      from: '2026-06-27T00:00:00.000Z',
      q: 'mai',
      review: 'held',
      to: '2026-06-28T00:00:00.000Z',
    }));
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
        'late',
      ),
    ).resolves.toEqual([{ id: 'evaluation-1' }]);
    await expect(
      controller.partnerCustomerReviewSummary(
        '2026-06-27T00:00:00.000Z',
        '2026-06-28T00:00:00.000Z',
        'late',
      ),
    ).resolves.toEqual({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 4 });

    expect(routeMetadata('partnerCustomerReviews')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-customer-reviews',
    });
    expect(routeMetadata('partnerCustomerReviewSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-customer-reviews/summary',
    });
    expect(admin.listPartnerCustomerReviews).toHaveBeenCalledWith(expect.objectContaining({
      from: '2026-06-27T00:00:00.000Z',
      q: 'late',
      skip: '20',
      sort: 'oldest',
      take: '10',
      to: '2026-06-28T00:00:00.000Z',
    }));
    expect(admin.partnerCustomerReviewSummary).toHaveBeenCalledWith(expect.objectContaining({
      from: '2026-06-27T00:00:00.000Z',
      q: 'late',
      to: '2026-06-28T00:00:00.000Z',
    }));
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

  it('exposes notification templates as a GET catalog', async () => {
    admin.listNotificationTemplates.mockResolvedValue([{ key: 'booking.matched' }]);

    await expect(controller.notificationTemplates()).resolves.toEqual([{ key: 'booking.matched' }]);

    expect(routeMetadata('notificationTemplates')).toEqual({
      method: RequestMethod.GET,
      path: 'notifications/templates',
    });
    expect(admin.listNotificationTemplates).toHaveBeenCalledWith();
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

    await expect(controller.providerReports('25')).resolves.toEqual([{ id: 'report-1' }]);
    await expect(controller.providerSanctions('30')).resolves.toEqual([{ id: 'sanction-1' }]);

    expect(routeMetadata('providerReports')).toEqual({
      method: RequestMethod.GET,
      path: ['provider-reports', 'partner-reports'],
    });
    expect(routeMetadata('providerSanctions')).toEqual({
      method: RequestMethod.GET,
      path: ['provider-sanctions', 'partner-sanctions'],
    });
    expect(admin.listProviderReports).toHaveBeenCalledWith({ take: '25' });
    expect(admin.listProviderSanctions).toHaveBeenCalledWith({ take: '30' });
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

  it('exposes coupon summary as a separate aggregate endpoint', async () => {
    admin.couponSummary.mockResolvedValue({ liveCount: 2, totalCount: 4 });

    await expect(controller.couponSummary()).resolves.toEqual({ liveCount: 2, totalCount: 4 });

    expect(routeMetadata('couponSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'coupons/summary',
    });
    expect(admin.couponSummary).toHaveBeenCalledWith();
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

  it('exposes file review providers as a lightweight paged GET list', async () => {
    admin.listFileReviewProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.fileReviewProviders('25', '50')).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('fileReviewProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'files/review-providers',
    });
    expect(admin.listFileReviewProviders).toHaveBeenCalledWith({ skip: '50', take: '25' });
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

    await expect(controller.usageOverview('month')).resolves.toEqual({
      range: 'month',
      customerUsage: [],
      partnerUsage: [],
    });

    expect(routeMetadata('usageOverview')).toEqual({
      method: RequestMethod.GET,
      path: 'usage-overview',
    });
    expect(admin.getUsageOverview).toHaveBeenCalledWith('month');
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

    await expect(controller.customerReferralParents('25', '50', 'Parent', 'blocked', 'held')).resolves.toEqual([
      { referrer: { id: 'customer-1' } },
    ]);

    expect(routeMetadata('customerReferralParents')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/customers',
    });
    expect(admin.listCustomerReferralParents).toHaveBeenCalledWith({
      q: 'Parent',
      reward: 'held',
      skip: '50',
      status: 'blocked',
      take: '25',
    });
  });

  it('exposes customer referral parent summary without loading parent rows', async () => {
    admin.customerReferralParentSummary.mockResolvedValue({ totalCount: 12, rewardQueueSummaries: [] });

    await expect(controller.customerReferralParentSummary()).resolves.toEqual({
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

    await expect(controller.partnerReferralParents('10', '20', 'Partner', 'qualified', 'available')).resolves.toEqual([
      { referrer: { id: 'partner-1' } },
    ]);

    expect(routeMetadata('partnerReferralParents')).toEqual({
      method: RequestMethod.GET,
      path: 'referrals/partners',
    });
    expect(admin.listPartnerReferralParents).toHaveBeenCalledWith({
      q: 'Partner',
      reward: 'available',
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

    await expect(controller.referralCashoutQueue('25', '50', 'customer', 'approved', 'parent')).resolves.toEqual([
      { id: 'reward-1', audience: 'CUSTOMER' },
    ]);
    await expect(controller.referralCashoutQueueSummary('partner', 'needs-action', 'smoke')).resolves.toEqual({
      totalCount: 3,
      statusSummaries: [],
    });

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

    await expect(controller.approveReferralRewardCashout(user, 'reward-1', { reason: 'paid' })).resolves.toEqual({
      id: 'reward-1',
      status: 'CASHOUT_APPROVED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    expect(routeMetadata('approveReferralRewardCashout')).toEqual({
      method: RequestMethod.POST,
      path: 'referrals/rewards/:id/cashout-approve',
    });
    expect(admin.approveReferralRewardCashout).toHaveBeenCalledWith('admin-1', 'reward-1', { reason: 'paid' });
  });

  it('exposes referral reward tax review requirement as a POST action', async () => {
    admin.requireReferralRewardTaxReview.mockResolvedValue({
      id: 'reward-1',
      status: 'TAX_REVIEW_REQUIRED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });

    await expect(controller.requireReferralRewardTaxReview(user, 'reward-1', { reason: 'tax review' })).resolves.toEqual({
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

    await expect(controller.operationsHandoffProviders('25')).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('operationsHandoffProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-handoff/providers',
    });
    expect(admin.listOperationsHandoffProviders).toHaveBeenCalledWith({ take: '25' });
  });

  it('exposes admin users as a bounded list', async () => {
    admin.listUsers.mockResolvedValue([{ id: 'user-1' }]);

    await expect(controller.users('50', '100')).resolves.toEqual([{ id: 'user-1' }]);

    expect(routeMetadata('users')).toEqual({
      method: RequestMethod.GET,
      path: 'users',
    });
    expect(admin.listUsers).toHaveBeenCalledWith({
      skip: '100',
      take: '50',
    });
  });

  it('exposes partner control providers as a lightweight GET list', async () => {
    admin.listPartnerControlProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.partnerControlProviders('25')).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('partnerControlProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-controls/providers',
    });
    expect(admin.listPartnerControlProviders).toHaveBeenCalledWith({ take: '25' });
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
    admin.partnerDirectorySummary.mockResolvedValue({ generatedAt: '2026-06-27T00:00:00.000Z', totalCount: 12 });

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
      q: 'linh',
      review: 'unapproved',
      skip: '50',
      sort: 'name',
      take: '25',
      verification: 'SUBMITTED',
      providerStatus: 'ONLINE_AVAILABLE',
      kyc: 'APPROVED',
      bookingFlow: 'completed-work',
    });
    expect(admin.partnerDirectorySummary).toHaveBeenCalledWith({
      q: 'linh',
      review: 'unapproved',
      verification: 'SUBMITTED',
      providerStatus: 'ONLINE_AVAILABLE',
      kyc: 'APPROVED',
      bookingFlow: 'completed-work',
    });
  });
});

function routeMetadata(methodName: keyof AdminController) {
  const handler = AdminController.prototype[methodName] as unknown as (...args: unknown[]) => unknown;
  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    path: Reflect.getMetadata(PATH_METADATA, handler),
  };
}
