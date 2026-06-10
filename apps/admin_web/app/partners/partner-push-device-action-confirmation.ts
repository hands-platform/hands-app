import type { AdminProvider } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type PartnerPushDeviceConfirmationAction = 'enable-device';

export type PartnerPushDeviceActionConfirmation = {
  readonly action: PartnerPushDeviceConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly pushDeviceId: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

export function partnerPushDeviceActionConfirmHref(pushDeviceId: string) {
  return `/partners?pushAction=enable-device&pushDeviceId=${encodeURIComponent(pushDeviceId)}`;
}

export function readPartnerPushDeviceConfirmationAction(
  value: string,
): PartnerPushDeviceConfirmationAction | null {
  return value === 'enable-device' ? value : null;
}

export function buildPartnerPushDeviceActionConfirmation(
  providers: readonly AdminProvider[],
  action: PartnerPushDeviceConfirmationAction | null,
  pushDeviceId: string,
): PartnerPushDeviceActionConfirmation | null {
  if (!action) {
    return null;
  }

  const match = findPartnerPushDevice(providers, pushDeviceId);
  if (!match) {
    return null;
  }

  const disabledReason = match.device.enabled ? 'Push device is already enabled.' : '';
  const partnerLabel =
    match.provider.displayName?.trim() ||
    match.provider.user?.fullName?.trim() ||
    match.provider.user?.phone ||
    shortId(match.provider.id);

  return {
    action,
    cancelHref: '/partners',
    confirmLabel: 'Re-enable device',
    description:
      disabledReason ||
      `Re-enable ${match.device.platform} push device ${shortId(
        match.device.id,
      )} for Partner ${partnerLabel} after token health or operator confirmation is reviewed.`,
    disabled: Boolean(disabledReason),
    hiddenInputs: [{ name: 'pushDeviceId', value: match.device.id }],
    pushDeviceId: match.device.id,
    title: `Re-enable device ${shortId(match.device.id)}?`,
    tone: disabledReason ? 'neutral' : 'danger',
  };
}

function findPartnerPushDevice(providers: readonly AdminProvider[], pushDeviceId: string) {
  for (const provider of providers) {
    for (const device of provider.user?.pushDevices ?? []) {
      if (device.id === pushDeviceId) {
        return { device, provider } as const;
      }
    }
  }
  return null;
}
