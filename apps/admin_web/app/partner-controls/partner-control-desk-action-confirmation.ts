import type { AdminProviderSanction } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type PartnerControlDeskConfirmationAction = 'lift-control';

export type PartnerControlDeskActionConfirmation = {
  readonly action: PartnerControlDeskConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly sanctionId: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

type PartnerControlDeskFilters = {
  readonly q?: string;
  readonly sanction?: string;
  readonly severity?: string;
  readonly status?: string;
};

type PartnerControlDeskTarget = PartnerControlDeskFilters & {
  readonly sanctionId: string;
};

export function partnerControlDeskActionConfirmHref(target: PartnerControlDeskTarget) {
  return `/partner-controls?${partnerControlDeskActionSearchParams(target).toString()}`;
}

export function partnerControlDeskCancelHref(filters: PartnerControlDeskFilters = {}) {
  const params = new URLSearchParams();
  appendFilterParams(params, filters);
  const query = params.toString();

  return query ? `/partner-controls?${query}` : '/partner-controls';
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

  const disabledReason = sanction.status === 'ACTIVE' ? '' : `Control is already ${sanction.status.toLowerCase()}.`;
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
    title: `Lift control ${shortId(sanction.id)}?`,
    tone: disabledReason ? 'neutral' : 'warning',
  };
}

function partnerControlDeskActionSearchParams(target: PartnerControlDeskTarget) {
  const params = new URLSearchParams({
    controlAction: 'lift-control',
    sanctionId: target.sanctionId,
  });
  appendFilterParams(params, target);
  return params;
}

function appendFilterParams(params: URLSearchParams, filters: PartnerControlDeskFilters) {
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.sanction) params.set('sanction', filters.sanction);
}

function providerLabel(sanction: AdminProviderSanction) {
  return marketplaceDisplayText(
    sanction.providerProfile?.displayName ||
      sanction.providerProfile?.user?.fullName ||
      sanction.providerProfile?.user?.phone ||
      sanction.providerProfileId,
  );
}
