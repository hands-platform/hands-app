import { ShieldCheck } from 'lucide-react';

import { AdminFormControlLink } from '../../components/admin-form-controls';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import type { AdminProvider } from '../../lib/admin-api';
import { maskToken } from './partner-list-profile';
import { providerSecurityLabel } from './partner-filters';
import {
  partnerSecurityPillClass,
  partnerSecurityStatus,
  sharedPartnerDeviceIds,
} from './partner-security-facts';

type PartnerSecurityCellProps = {
  readonly provider: AdminProvider;
};

export function PartnerSecurityCell({ provider }: PartnerSecurityCellProps) {
  const status = partnerSecurityStatus(provider);
  const blockedDevices = (provider.devices ?? []).filter((device) => Boolean(device.blockedAt));
  const sessionCheckSessions = (provider.sessions ?? []).filter((session) => session.suspicious);
  const sharedDevices = sharedPartnerDeviceIds(provider);
  const latestDevice = provider.devices?.[0];
  const latestSession = provider.sessions?.[0];

  return (
    <div>
      <div className="participant-list admin-mb-8">
        <StatusBadgeFromPillClass pillClass={partnerSecurityPillClass(status)}>
          {providerSecurityLabel(status)}
        </StatusBadgeFromPillClass>
      </div>
      <p className="muted admin-mb-4">
        {latestDevice
          ? `Last app device: ${maskToken(latestDevice.deviceId)} / ${latestDevice.platform ?? 'unknown'}`
          : 'No partner app device recorded yet.'}
      </p>
      {provider.blockedAt ? (
        <p className="muted admin-mb-4">
          Account block: {provider.blockedReason ?? 'No reason saved'} /{' '}
          <DateTimeText fallback="Missing" value={provider.blockedAt} />
        </p>
      ) : null}
      {latestSession ? (
        <p className="muted admin-mb-4">
          Last session: {latestSession.ipAddress ?? 'no IP'} /{' '}
          <DateTimeText fallback="Missing" value={latestSession.lastSeenAt} />
        </p>
      ) : null}
      {blockedDevices.length ? <p className="muted">{blockedDevices.length} blocked device(s)</p> : null}
      {sessionCheckSessions.length ? (
        <p className="muted">{sessionCheckSessions.length} session check(s)</p>
      ) : null}
      {sharedDevices.size ? <p className="muted">{sharedDevices.size} shared device id(s)</p> : null}
      <AdminFormControlLink
        className="button-secondary admin-inline-action admin-mt-8"
        href={`/partners/${provider.id}`}
      >
        <ShieldCheck aria-hidden="true" size={14} />
        Review device/session
      </AdminFormControlLink>
    </div>
  );
}
