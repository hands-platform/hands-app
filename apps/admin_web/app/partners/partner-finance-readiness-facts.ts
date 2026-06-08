import type { AdminProvider } from '../../lib/admin-api';

export function partnerHasFirstRevenueSignal(provider: AdminProvider) {
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
