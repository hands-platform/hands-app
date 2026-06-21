import type { AdminProvider } from '../../lib/admin-api';

export function partnerHasFirstRevenueSignal(provider: AdminProvider) {
  if (provider.activitySummary) {
    return (
      provider.activitySummary.completedWorkCount > 0 ||
      provider.activitySummary.grossRevenue > 0 ||
      provider.activitySummary.pendingPayout !== 0 ||
      provider.activitySummary.availablePayout !== 0 ||
      provider.activitySummary.walletBalance !== 0
    );
  }

  return (provider.earnings ?? []).some((earning) =>
    ['PENDING', 'AVAILABLE', 'PAID'].includes(earning.status),
  );
}

export function partnerPayoutSetupNeedsReview(provider: AdminProvider) {
  if (!partnerHasFirstRevenueSignal(provider)) {
    return false;
  }

  return (
    provider.taxProfile?.status !== 'APPROVED' ||
    !provider.residentialAddress?.trim() ||
    (provider.agreements?.length ?? 0) < 5
  );
}

export function partnerTaxNeedsReview(provider: AdminProvider) {
  const taxStatus = provider.taxProfile?.status ?? 'MISSING';
  if (['PENDING_REVIEW', 'REJECTED'].includes(taxStatus)) {
    return true;
  }

  return partnerHasFirstRevenueSignal(provider) && taxStatus !== 'APPROVED';
}

export function partnerTaxPillClass(provider: AdminProvider) {
  if (provider.taxProfile?.status === 'APPROVED') {
    return 'pill-success';
  }
  if (partnerTaxNeedsReview(provider)) {
    return provider.taxProfile?.status === 'REJECTED' ? 'pill-danger' : 'pill-warn';
  }
  return 'pill-neutral';
}
