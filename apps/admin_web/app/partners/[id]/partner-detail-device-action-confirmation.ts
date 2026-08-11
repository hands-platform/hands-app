import type { AdminProvider } from '../../../lib/admin-api';
import { shortId } from '../../../lib/admin-format';
import type { StatusBadgeTone } from '../../../components/status-badge';
import { maskDeviceId } from './partner-detail-format';

export type PartnerDeviceConfirmationAction = 'block-device' | 'unblock-device';

export type PartnerDeviceActionConfirmation = {
  readonly action: PartnerDeviceConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly providerDeviceId: string;
  readonly providerId: string;
  readonly textInputs: readonly PartnerDeviceActionTextInput[];
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

type PartnerDeviceActionTextInput = {
  readonly label: string;
  readonly maxLength: number;
  readonly minLength: number;
  readonly name: string;
  readonly placeholder: string;
  readonly required: true;
};

const REVIEW_REASON_LIMITS = {
  maxLength: 500,
  minLength: 12,
} as const;

type PartnerDevice = NonNullable<AdminProvider['devices']>[number];

export function partnerDeviceActionConfirmHref(
  providerId: string,
  action: PartnerDeviceConfirmationAction,
  providerDeviceId: string,
) {
  const params = new URLSearchParams({
    access: 'diagnostics',
    deviceAction: action,
    providerDeviceId,
    section: 'access',
  });

  return `/partners/${encodeURIComponent(providerId)}?${params.toString()}`;
}

export function readPartnerDeviceConfirmationAction(value: string): PartnerDeviceConfirmationAction | null {
  if (value === 'block-device' || value === 'unblock-device') {
    return value;
  }
  return null;
}

export function buildPartnerDeviceActionConfirmation(
  provider: AdminProvider,
  action: PartnerDeviceConfirmationAction | null,
  providerDeviceId: string,
): PartnerDeviceActionConfirmation | null {
  if (!action) {
    return null;
  }

  const device = (provider.devices ?? []).find((item) => item.id === providerDeviceId);
  if (!device) {
    return null;
  }

  return action === 'block-device'
    ? buildBlockDeviceConfirmation(provider, device)
    : buildUnblockDeviceConfirmation(provider, device);
}

function buildBlockDeviceConfirmation(
  provider: AdminProvider,
  device: PartnerDevice,
): PartnerDeviceActionConfirmation {
  const disabledReason = device.blockedAt
    ? 'Device is already blocked.'
    : !device.enabled
      ? 'Device is already disabled.'
      : '';

  return baseConfirmation({
    action: 'block-device',
    confirmLabel: 'Block device',
    description: `Block Partner device ${maskDeviceId(device.deviceId)} for ${partnerLabel(
      provider,
    )}. This prevents the device from being trusted for Partner app activity.`,
    disabledReason,
    device,
    provider,
    reasonPlaceholder: 'Device block reason',
    title: `Block a device for ${partnerLabel(provider)}?`,
    tone: 'danger',
  });
}

function buildUnblockDeviceConfirmation(
  provider: AdminProvider,
  device: PartnerDevice,
): PartnerDeviceActionConfirmation {
  const disabledReason = device.blockedAt || !device.enabled ? '' : 'Device is already active.';

  return baseConfirmation({
    action: 'unblock-device',
    confirmLabel: 'Unblock device',
    description: `Unblock Partner device ${maskDeviceId(device.deviceId)} for ${partnerLabel(
      provider,
    )} after the device/session issue is resolved.`,
    disabledReason,
    device,
    provider,
    reasonPlaceholder: '',
    title: `Unblock a device for ${partnerLabel(provider)}?`,
    tone: 'warning',
  });
}

function baseConfirmation(input: {
  readonly action: PartnerDeviceConfirmationAction;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabledReason: string;
  readonly device: PartnerDevice;
  readonly provider: AdminProvider;
  readonly reasonPlaceholder: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
}): PartnerDeviceActionConfirmation {
  const disabled = Boolean(input.disabledReason);

  return {
    action: input.action,
    cancelHref: `/partners/${input.provider.id}?section=access&access=diagnostics#app-activity`,
    confirmLabel: input.confirmLabel,
    description: input.disabledReason || input.description,
    disabled,
    hiddenInputs: [
      { name: 'providerId', value: input.provider.id },
      { name: 'providerDeviceId', value: input.device.id },
    ],
    providerDeviceId: input.device.id,
    providerId: input.provider.id,
    textInputs: input.reasonPlaceholder
      ? [
          {
            label: 'Reason',
            maxLength: REVIEW_REASON_LIMITS.maxLength,
            minLength: REVIEW_REASON_LIMITS.minLength,
            name: 'reason',
            placeholder: input.reasonPlaceholder,
            required: true,
          },
        ]
      : [],
    title: input.title,
    tone: disabled ? 'neutral' : input.tone,
  };
}

function partnerLabel(provider: AdminProvider) {
  return provider.displayName?.trim() || provider.user?.fullName?.trim() || provider.user?.phone || shortId(provider.id);
}
