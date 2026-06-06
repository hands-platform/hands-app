import type { AdminProvider } from '../../lib/admin-api';

type AdminPushDevice = NonNullable<NonNullable<AdminProvider['user']>['pushDevices']>[number];
type AdminProviderPublicMedia = NonNullable<NonNullable<AdminProvider['user']>['fileAssets']>[number];

export function maskToken(token: string) {
  if (token.length <= 4) {
    return '*'.repeat(token.length);
  }
  if (token.length <= 10) {
    return `${token.slice(0, 2)}...${token.slice(-2)}`;
  }
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export function readFailureCode(device: AdminPushDevice) {
  return device.deliveries?.[0]?.response?.body?.error?.details?.[0]?.errorCode;
}

export function readFailureStatus(device: AdminPushDevice) {
  return device.deliveries?.[0]?.status;
}

export function readLastAttempt(device: AdminPushDevice) {
  return device.deliveries?.[0]?.attemptedAt;
}

export function hasHealthyPush(provider: AdminProvider) {
  return (provider.user?.pushDevices ?? []).some((device) => device.enabled);
}

export function hasApprovedBankAccount(provider: AdminProvider) {
  return (provider.bankAccounts ?? []).some((account) => account.status === 'APPROVED');
}

export function providerPublicMedia(provider: AdminProvider): AdminProviderPublicMedia[] {
  return provider.user?.fileAssets ?? [];
}

export function providerPublicMediaNeedsReview(provider: AdminProvider) {
  return providerPublicMedia(provider).some((file) =>
    ['PENDING_REVIEW', 'REJECTED'].includes(file.reviewStatus ?? 'PENDING_REVIEW'),
  );
}

export function publicMediaReviewPillClass(status?: string) {
  if (status === 'APPROVED') return 'pill-success';
  if (status === 'REJECTED') return 'pill-danger';
  return 'pill-warn';
}
