import type { AdminProvider } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type PartnerAccountConfirmationAction = 'approve' | 'block' | 'reject' | 'sync-role' | 'unblock';

export type PartnerAccountActionConfirmation = {
  readonly action: PartnerAccountConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly providerId: string;
  readonly textInputs: readonly PartnerAccountActionTextInput[];
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

type PartnerAccountActionTextInput = {
  readonly label: string;
  readonly maxLength: number;
  readonly minLength: number;
  readonly name: string;
  readonly placeholder: string;
  readonly required: true;
};

type PartnerAccountActionMetadata = {
  readonly confirmLabel: string;
  readonly description: (provider: AdminProvider) => string;
  readonly disabledReason?: (provider: AdminProvider) => string;
  readonly reasonPlaceholder?: string;
  readonly title: (provider: AdminProvider) => string;
  readonly tone: StatusBadgeTone;
};

const REVIEW_REASON_LIMITS = {
  maxLength: 500,
  minLength: 12,
} as const;

const partnerAccountActionMetadata: Record<PartnerAccountConfirmationAction, PartnerAccountActionMetadata> = {
  approve: {
    confirmLabel: 'Approve Partner',
    description: (provider) =>
      `Approve Partner ${partnerLabel(provider)} after identity, profile, and operating readiness review.`,
    title: (provider) => `Approve Partner ${shortId(provider.id)}?`,
    tone: 'success',
  },
  block: {
    confirmLabel: 'Block account',
    description: (provider) =>
      `Block Partner ${partnerLabel(provider)} from going online, updating location, or appearing to customers.`,
    reasonPlaceholder: 'Account block reason',
    title: (provider) => `Block Partner ${shortId(provider.id)}?`,
    tone: 'danger',
  },
  reject: {
    confirmLabel: 'Reject Partner',
    description: (provider) =>
      `Reject Partner ${partnerLabel(provider)} and keep the reason clear for audit and re-submission.`,
    reasonPlaceholder: 'Partner rejection reason',
    title: (provider) => `Reject Partner ${shortId(provider.id)}?`,
    tone: 'danger',
  },
  'sync-role': {
    confirmLabel: 'Sync Supabase role',
    description: (provider) =>
      `Sync Partner ${partnerLabel(provider)} role after NestJS verification is approved. Supabase remains infrastructure only.`,
    disabledReason: (provider) =>
      provider.verification?.status === 'APPROVED'
        ? ''
        : 'Partner verification must be approved before syncing the Supabase role.',
    title: (provider) => `Sync role for Partner ${shortId(provider.id)}?`,
    tone: 'info',
  },
  unblock: {
    confirmLabel: 'Unblock account',
    description: (provider) =>
      `Unblock Partner ${partnerLabel(provider)} only after the recorded identity, safety, payout, or policy issue is resolved.`,
    title: (provider) => `Unblock Partner ${shortId(provider.id)}?`,
    tone: 'warning',
  },
};

export function partnerAccountActionConfirmHref(
  providerId: string,
  action: PartnerAccountConfirmationAction,
  options: { readonly baseHref?: string } = {},
) {
  const baseHref = options.baseHref ?? '/partners';
  const separator = baseHref.includes('?') ? '&' : '?';

  return `${baseHref}${separator}confirm=${action}&providerId=${encodeURIComponent(providerId)}`;
}

export function readPartnerAccountConfirmationAction(value: string): PartnerAccountConfirmationAction | null {
  if (
    value === 'approve' ||
    value === 'block' ||
    value === 'reject' ||
    value === 'sync-role' ||
    value === 'unblock'
  ) {
    return value;
  }
  return null;
}

export function buildPartnerAccountActionConfirmation(
  providers: readonly AdminProvider[],
  action: PartnerAccountConfirmationAction | null,
  providerId: string,
  options: { readonly cancelHref?: string } = {},
): PartnerAccountActionConfirmation | null {
  if (!action) {
    return null;
  }

  const provider = providers.find((item) => item.id === providerId);
  if (!provider) {
    return null;
  }

  const metadata = partnerAccountActionMetadata[action];
  const disabledReason = metadata.disabledReason?.(provider) ?? '';
  const disabled = Boolean(disabledReason);

  return {
    action,
    cancelHref: options.cancelHref ?? '/partners',
    confirmLabel: metadata.confirmLabel,
    description: disabledReason || metadata.description(provider),
    disabled,
    hiddenInputs: [{ name: 'providerId', value: provider.id }],
    providerId: provider.id,
    textInputs: metadata.reasonPlaceholder
      ? [
          {
            label: 'Reason',
            maxLength: REVIEW_REASON_LIMITS.maxLength,
            minLength: REVIEW_REASON_LIMITS.minLength,
            name: 'reason',
            placeholder: metadata.reasonPlaceholder,
            required: true,
          },
        ]
      : [],
    title: metadata.title(provider),
    tone: disabled ? 'neutral' : metadata.tone,
  };
}

function partnerLabel(provider: AdminProvider) {
  return provider.displayName?.trim() || provider.user?.fullName?.trim() || provider.user?.phone || shortId(provider.id);
}
