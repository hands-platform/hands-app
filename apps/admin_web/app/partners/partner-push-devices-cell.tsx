import { ActionMenu } from '../../components/action-menu';
import { DateTimeText } from '../../components/date-time-text';
import type { AdminProvider } from '../../lib/admin-api';
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
      {pushDevices.map((device) => {
        const lastAttempt = readLastAttempt(device);
        return (
          <div className="admin-mb-8" key={device.id}>
            <p className="muted admin-mb-4">
              {device.platform} / {device.enabled ? 'enabled' : 'disabled'} / Token hidden
            </p>
            {!device.enabled ? (
              <p className="muted admin-mb-4">
                Last failure: {readFailureCode(device) ?? 'Unknown'} / {readFailureStatus(device) ?? 'FAILED'}
              </p>
            ) : null}
            {lastAttempt ? (
              <p className="muted admin-mb-4">
                Last attempt: <DateTimeText value={lastAttempt} />
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
        );
      })}
    </>
  );
}
