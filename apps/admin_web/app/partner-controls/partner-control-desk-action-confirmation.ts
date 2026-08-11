import type { AdminProviderSanction } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';
import { partnerControlHref } from './partner-control-page-load-plan';

export type PartnerControlDeskConfirmationAction = 'lift-control';

export type PartnerControlDeskActionConfirmation = {
  readonly action: PartnerControlDeskConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly sanctionId: string;
  readonly textInputs: readonly {
    readonly label: string;
    readonly maxLength: number;
    readonly minLength: number;
    readonly name: string;
    readonly placeholder: string;
    readonly required: boolean;
  }[];
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

type PartnerControlDeskFilters = {
  readonly controlType?: string;
  readonly details?: string;
  readonly q?: string;
  readonly sanction?: string;
  readonly sanctionPage?: string;
  readonly severity?: string;
  readonly sort?: string;
  readonly status?: string;
};

type PartnerControlDeskTarget = PartnerControlDeskFilters & {
  readonly sanctionId: string;
};

export function partnerControlDeskActionConfirmHref(target: PartnerControlDeskTarget) {
  return partnerControlHref(target, {
    controlAction: 'lift-control',
    details: 'sanctions',
    sanctionId: target.sanctionId,
  });
}

export function partnerControlDeskCancelHref(filters: PartnerControlDeskFilters = {}) {
  return partnerControlHref(filters, { controlAction: undefined, sanctionId: undefined });
}

export function readPartnerControlDeskConfirmationAction(
  value: string,
): PartnerControlDeskConfirmationAction | null {
  return value === 'lift-control' ? value : null;
}

export function buildPartnerControlDeskActionConfirmation(
  sanctions: readonly AdminProviderSanction[],
  action: PartnerControlDeskConfirmationAction | null,
  sanctionId: string,
  filters: PartnerControlDeskFilters = {},
): PartnerControlDeskActionConfirmation | null {
  if (!action) {
    return null;
  }

  const sanction = sanctions.find((item) => item.id === sanctionId);
  if (!sanction) {
    return null;
  }

  const disabledReason =
    sanction.status === 'ACTIVE' ? '' : `Control is already ${sanction.status.toLowerCase()}.`;
  const partnerLabel = providerLabel(sanction);

  return {
    action,
    cancelHref: partnerControlDeskCancelHref(filters),
    confirmLabel: 'Lift control',
    description:
      disabledReason ||
      `Lift ${sanction.type} control ${shortId(sanction.id)} for Partner ${partnerLabel} after the issue is resolved.`,
    disabled: Boolean(disabledReason),
    hiddenInputs: [
      { name: 'providerProfileId', value: sanction.providerProfileId },
      { name: 'sanctionId', value: sanction.id },
    ],
    sanctionId: sanction.id,
    textInputs: disabledReason
      ? []
      : [
          {
            label: 'Lift reason and evidence',
            maxLength: 500,
            minLength: 12,
            name: 'reason',
            placeholder: 'State what was resolved and which evidence was verified',
            required: true,
          },
        ],
    title: `Lift control ${shortId(sanction.id)}?`,
    tone: disabledReason ? 'neutral' : 'warning',
  };
}

function providerLabel(sanction: AdminProviderSanction) {
  return marketplaceDisplayText(
    sanction.providerProfile?.displayName ||
      sanction.providerProfile?.user?.fullName ||
      sanction.providerProfile?.user?.phone ||
      sanction.providerProfileId,
  );
}
