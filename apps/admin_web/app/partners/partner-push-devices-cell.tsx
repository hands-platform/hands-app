import { ActionMenu } from '../../components/action-menu';
import type { AdminProvider } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/admin-format';
import {
  maskToken,
  readFailureCode,
  readFailureStatus,
  readLastAttempt,
} from './partner-list-profile';
import { partnerPushDeviceActionConfirmHref } from './partner-push-device-action-confirmation';

type PartnerPushDevicesCellProps = {
  readonly provider: AdminProvider;
};

export function PartnerPushDevicesCell({ provider }: PartnerPushDevicesCellProps) {
  const pushDevices = provider.user?.pushDevices ?? [];

  if (!pushDevices.length) {
    return <>None</>;
  }

  return (
    <>
      {pushDevices.map((device) => (
        <div key={device.id} style={{ marginBottom: 8 }}>
          <p className="muted" style={{ marginBottom: 4 }}>
            {device.platform} / {device.enabled ? 'enabled' : 'disabled'} / Token hidden
          </p>
          {!device.enabled ? (
            <p className="muted" style={{ marginBottom: 4 }}>
              Last failure: {readFailureCode(device) ?? 'Unknown'} / {readFailureStatus(device) ?? 'FAILED'}
            </p>
          ) : null}
          {readLastAttempt(device) ? (
            <p className="muted" style={{ marginBottom: 4 }}>
              Last attempt: {formatDateTime(readLastAttempt(device))}
            </p>
          ) : null}
          {!device.enabled ? (
            <ActionMenu
              actions={[
                {
                  description: 'Review token health before re-enabling this Partner push device.',
                  href: partnerPushDeviceActionConfirmHref(device.id),
                  kind: 'link',
                  label: 'Re-enable',
                  tone: 'danger',
                },
              ]}
              label={`Push device actions for ${maskToken(device.id)}`}
            />
          ) : null}
        </div>
      ))}
    </>
  );
}
