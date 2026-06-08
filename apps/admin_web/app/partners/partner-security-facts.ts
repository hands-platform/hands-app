import type { AdminProvider } from '../../lib/admin-api';
import type { ProviderSecurityState } from './partner-filters';

export function partnerSecurityStatus(provider: AdminProvider): ProviderSecurityState {
  if (provider.blockedAt) {
    return 'account-blocked';
  }
  if ((provider.devices ?? []).some((device) => Boolean(device.blockedAt))) {
    return 'blocked';
  }
  if ((provider.sessions ?? []).some((session) => session.suspicious)) {
    return 'session-check';
  }
  if (sharedPartnerDeviceIds(provider).size > 0) {
    return 'shared';
  }
  if (!(provider.devices ?? []).length && !(provider.sessions ?? []).length) {
    return 'missing';
  }
  return 'clear';
}

export function sharedPartnerDeviceIds(provider: AdminProvider) {
  return new Set((provider.sharedDeviceMatches ?? []).map((match) => match.deviceId).filter(Boolean));
}

export function partnerSecurityPillClass(status: ProviderSecurityState) {
  if (status === 'clear') return 'pill-success';
  if (status === 'missing') return 'pill-neutral';
  return 'pill-danger';
}
