import type { AdminProvider } from '../../../lib/admin-api';
import { shortId } from '../../../lib/admin-format';
import type { StatusBadgeTone } from '../../../components/status-badge';
import { buildPartnerDetailTargetHref } from './partner-detail-workspace-model';

export type PartnerControlConfirmationAction = 'lift-control';

export type PartnerControlActionConfirmation = {
  readonly action: PartnerControlConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly providerId: string;
  readonly sanctionId: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

type PartnerSanction = NonNullable<AdminProvider['sanctions']>[number];

export function partnerControlActionConfirmHref(providerId: string, sanctionId: string) {
  const params = new URLSearchParams({
    controlAction: 'lift-control',
    sanctionId,
    access: 'controls',
    section: 'access',
  });

  return `/partners/${encodeURIComponent(providerId)}?${params.toString()}#partner-reports-controls`;
}

export function readPartnerControlConfirmationAction(value: string): PartnerControlConfirmationAction | null {
  return value === 'lift-control' ? value : null;
}

export function buildPartnerControlActionConfirmation(
  provider: AdminProvider,
  action: PartnerControlConfirmationAction | null,
  sanctionId: string,
): PartnerControlActionConfirmation | null {
  if (!action) {
    return null;
  }

  const sanction = (provider.sanctions ?? []).find((item) => item.id === sanctionId);
  if (!sanction) {
    return null;
  }

  return buildLiftControlConfirmation(provider, sanction);
}

function buildLiftControlConfirmation(
  provider: AdminProvider,
  sanction: PartnerSanction,
): PartnerControlActionConfirmation {
  const disabledReason = sanction.status === 'ACTIVE' ? '' : `Control is already ${sanction.status.toLowerCase()}.`;
  const disabled = Boolean(disabledReason);

  return {
    action: 'lift-control',
    cancelHref: buildPartnerDetailTargetHref(provider.id, 'account-controls'),
    confirmLabel: 'Lift control',
    description:
      disabledReason ||
      `Lift ${sanction.type} control ${shortId(sanction.id)} for Partner ${partnerLabel(
        provider,
      )} after the report or control issue is resolved.`,
    disabled,
    hiddenInputs: [
      { name: 'providerProfileId', value: provider.id },
      { name: 'sanctionId', value: sanction.id },
    ],
    providerId: provider.id,
    sanctionId: sanction.id,
    title: `Lift control for ${partnerLabel(provider)}?`,
    tone: disabled ? 'neutral' : 'warning',
  };
}

function partnerLabel(provider: AdminProvider) {
  return provider.displayName?.trim() || provider.user?.fullName?.trim() || provider.user?.phone || shortId(provider.id);
}
