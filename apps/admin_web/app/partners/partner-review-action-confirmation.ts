import type { AdminProvider } from '../../lib/admin-api';
import { providerDocumentLabel } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';
import { missingSubmittedRequiredKycDocuments } from './partner-kyc-facts';
import { providerPublicMedia } from './partner-list-profile';

export type PartnerReviewConfirmationAction =
  | 'approve-bank'
  | 'approve-document'
  | 'approve-kyc'
  | 'approve-media'
  | 'approve-tax'
  | 'delete-media'
  | 'hold-kyc'
  | 'reject-bank'
  | 'reject-document'
  | 'reject-kyc'
  | 'reject-media'
  | 'reject-tax';

export type PartnerReviewActionConfirmation = {
  readonly action: PartnerReviewConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly providerId: string;
  readonly supportingLinks: readonly { readonly description?: string; readonly href: string; readonly label: string }[];
  readonly textInputs: readonly PartnerReviewActionTextInput[];
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

type PartnerReviewActionTextInput = {
  readonly defaultValue?: string;
  readonly label: string;
  readonly maxLength: number;
  readonly minLength: number;
  readonly name: string;
  readonly placeholder: string;
  readonly required: true;
};

type PartnerReviewActionValues = {
  readonly bankAccountId: string;
  readonly documentId: string;
  readonly fileId: string;
  readonly providerId: string;
};

type PartnerReviewActionOptions = {
  readonly baseHref?: string;
  readonly cancelHref?: string;
};

const REVIEW_REASON_INPUT_LIMITS = {
  maxLength: 500,
  minLength: 12,
} as const;

const BANK_CORRECTION_DEFAULT_REASON =
  'Withdrawal bank information is incorrect, so the payout cannot be sent.';

export function partnerReviewActionConfirmHref(
  providerId: string,
  action: PartnerReviewConfirmationAction,
  target: { readonly bankAccountId?: string; readonly documentId?: string; readonly fileId?: string } = {},
  options: { readonly baseHref?: string } = {},
) {
  const params = new URLSearchParams({
    providerId,
    reviewAction: action,
  });

  if (target.bankAccountId) {
    params.set('bankAccountId', target.bankAccountId);
  }
  if (target.documentId) {
    params.set('documentId', target.documentId);
  }
  if (target.fileId) {
    params.set('fileId', target.fileId);
  }

  const baseHref = options.baseHref ?? '/partners';
  const separator = baseHref.includes('?') ? '&' : '?';

  return `${baseHref}${separator}${params.toString()}`;
}

export function readPartnerReviewConfirmationAction(value: string): PartnerReviewConfirmationAction | null {
  if (
    value === 'approve-bank' ||
    value === 'approve-document' ||
    value === 'approve-kyc' ||
    value === 'approve-media' ||
    value === 'approve-tax' ||
    value === 'delete-media' ||
    value === 'hold-kyc' ||
    value === 'reject-bank' ||
    value === 'reject-document' ||
    value === 'reject-kyc' ||
    value === 'reject-media' ||
    value === 'reject-tax'
  ) {
    return value;
  }
  return null;
}

export function buildPartnerReviewActionConfirmation(
  providers: readonly AdminProvider[],
  action: PartnerReviewConfirmationAction | null,
  values: PartnerReviewActionValues,
  options: PartnerReviewActionOptions = {},
): PartnerReviewActionConfirmation | null {
  if (!action) {
    return null;
  }

  const provider = providers.find((item) => item.id === values.providerId);
  if (!provider) {
    return null;
  }

  if (action === 'approve-document' || action === 'reject-document') {
    return buildDocumentConfirmation(provider, action, values.documentId, options);
  }
  if (action === 'approve-bank' || action === 'reject-bank') {
    return buildBankConfirmation(provider, action, values.bankAccountId, options);
  }
  if (action === 'approve-media' || action === 'reject-media' || action === 'delete-media') {
    return buildMediaConfirmation(provider, action, values.fileId, options);
  }
  if (action === 'approve-kyc' || action === 'reject-kyc' || action === 'hold-kyc') {
    return buildKycConfirmation(provider, action, options);
  }
  return buildTaxConfirmation(provider, action, options);
}

function buildDocumentConfirmation(
  provider: AdminProvider,
  action: 'approve-document' | 'reject-document',
  documentId: string,
  options: PartnerReviewActionOptions,
): PartnerReviewActionConfirmation | null {
  const document = (provider.documents ?? []).find((item) => item.id === documentId);
  if (!document) {
    return null;
  }

  const isReject = action === 'reject-document';
  const blockedStatus = isReject ? 'REJECTED' : 'APPROVED';
  const documentLabel = providerDocumentLabel(document.type);

  return baseConfirmation({
    action,
    confirmLabel: isReject ? 'Reject document' : 'Approve document',
    description: `${isReject ? 'Reject' : 'Approve'} ${documentLabel} for Partner ${partnerLabel(
      provider,
    )} after checking the uploaded private file.`,
    disabledReason:
      document.status === blockedStatus ? `${documentLabel} is already ${blockedStatus.toLowerCase()}.` : '',
    hiddenInputs: [
      { name: 'providerId', value: provider.id },
      { name: 'documentId', value: document.id },
    ],
    options,
    provider,
    reasonPlaceholder: isReject ? 'Document rejection reason for Partner app correction' : '',
    title: `${isReject ? 'Reject' : 'Approve'} ${documentLabel} for ${partnerLabel(provider)}?`,
    tone: isReject ? 'danger' : 'success',
  });
}

function buildBankConfirmation(
  provider: AdminProvider,
  action: 'approve-bank' | 'reject-bank',
  bankAccountId: string,
  options: PartnerReviewActionOptions,
): PartnerReviewActionConfirmation | null {
  const bankAccount = (provider.bankAccounts ?? []).find((item) => item.id === bankAccountId);
  if (!bankAccount) {
    return null;
  }

  const isReject = action === 'reject-bank';
  const blockedStatus = isReject ? 'REJECTED' : 'APPROVED';

  return baseConfirmation({
    action,
    confirmLabel: isReject ? 'Reject bank' : 'Approve bank',
    description: isReject
      ? `Request Partner ${partnerLabel(provider)} to correct ${bankAccount.bankName} withdrawal details for manual wallet withdrawal or deposit checks.`
      : `Approve ${bankAccount.bankName} withdrawal details for Partner ${partnerLabel(
          provider,
        )} after manual wallet withdrawal or deposit checks.`,
    disabledReason:
      bankAccount.status === blockedStatus ? `Bank account is already ${blockedStatus.toLowerCase()}.` : '',
    hiddenInputs: [
      { name: 'providerId', value: provider.id },
      { name: 'bankAccountId', value: bankAccount.id },
    ],
    options,
    provider,
    reasonDefaultValue: isReject ? BANK_CORRECTION_DEFAULT_REASON : '',
    reasonPlaceholder: isReject ? 'Partner withdrawal detail correction reason' : '',
    title: `${isReject ? 'Reject' : 'Approve'} withdrawal bank for ${partnerLabel(provider)}?`,
    tone: isReject ? 'danger' : 'success',
  });
}

function buildMediaConfirmation(
  provider: AdminProvider,
  action: 'approve-media' | 'delete-media' | 'reject-media',
  fileId: string,
  options: PartnerReviewActionOptions,
): PartnerReviewActionConfirmation | null {
  const file = providerPublicMedia(provider).find((item) => item.id === fileId);
  if (!file) {
    return null;
  }

  const isDelete = action === 'delete-media';
  const isReject = action === 'reject-media';
  const blockedStatus = isReject ? 'REJECTED' : 'APPROVED';
  const mediaLabel = file.purpose || 'public media';

  return baseConfirmation({
    action,
    confirmLabel: isDelete ? 'Delete public media' : isReject ? 'Reject media' : 'Approve media',
    description: isDelete
      ? `Delete ${mediaLabel} from Partner ${partnerLabel(provider)}. It will no longer appear in the customer app.`
      : `${isReject ? 'Reject' : 'Approve'} ${mediaLabel} for Partner ${partnerLabel(
          provider,
        )} after checking the public profile asset.`,
    disabledReason:
      !isDelete && file.reviewStatus === blockedStatus ? `Public media is already ${blockedStatus.toLowerCase()}.` : '',
    hiddenInputs: [
      { name: 'providerId', value: provider.id },
      { name: 'fileId', value: file.id },
    ],
    options,
    provider,
    reasonPlaceholder: isDelete
      ? 'Why this public Partner image must be deleted'
      : isReject
        ? 'Media rejection reason for Partner app correction'
        : '',
    supportingLinks: file.url
      ? [{ description: `Preview ${mediaLabel} before the final action.`, href: file.url, label: 'Preview media' }]
      : [],
    title: `${isDelete ? 'Delete' : isReject ? 'Reject' : 'Approve'} ${mediaLabel} for ${partnerLabel(provider)}?`,
    tone: isDelete || isReject ? 'danger' : 'success',
  });
}

function buildKycConfirmation(
  provider: AdminProvider,
  action: 'approve-kyc' | 'hold-kyc' | 'reject-kyc',
  options: PartnerReviewActionOptions,
): PartnerReviewActionConfirmation {
  const isHold = action === 'hold-kyc';
  const isReject = action === 'reject-kyc';
  const missingDocuments = missingSubmittedRequiredKycDocuments(provider);
  const disabledReason = isReject || isHold
    ? !provider.kyc
      ? 'KYC record is missing.'
      : isReject && provider.kyc.status === 'REJECTED'
        ? 'KYC is already rejected.'
        : ''
    : !provider.kyc
      ? 'KYC record is missing.'
      : provider.kyc.status === 'APPROVED'
        ? 'KYC is already approved.'
        : missingDocuments.length > 0
          ? `Required documents must be submitted first: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`
          : '';

  return baseConfirmation({
    action,
    confirmLabel: isHold ? 'Put KYC on hold' : isReject ? 'Reject KYC' : 'Approve KYC',
    description: isHold
      ? `Put KYC for Partner ${partnerLabel(provider)} on hold and show the correction reason in the Partner app.`
      : isReject
      ? `Reject KYC for Partner ${partnerLabel(
          provider,
        )} and show the reason in the Partner app correction checklist for resubmission.`
      : `Approve KYC for Partner ${partnerLabel(provider)} after reviewing required identity evidence.`,
    disabledReason,
    hiddenInputs: [{ name: 'providerId', value: provider.id }],
    options,
    provider,
    reasonDefaultValue: isHold ? provider.kyc?.rejectionReason ?? '' : '',
    reasonPlaceholder: isHold
      ? 'KYC hold reason shown to the Partner'
      : isReject
        ? 'KYC rejection reason for Partner app correction'
        : '',
    title: `${isHold ? 'Put KYC on hold' : isReject ? 'Reject KYC' : 'Approve KYC'} for ${partnerLabel(provider)}?`,
    tone: isHold ? 'warning' : isReject ? 'danger' : 'success',
  });
}

function buildTaxConfirmation(
  provider: AdminProvider,
  action: 'approve-tax' | 'reject-tax',
  options: PartnerReviewActionOptions,
): PartnerReviewActionConfirmation | null {
  if (!provider.taxProfile) {
    return null;
  }

  const isReject = action === 'reject-tax';
  const blockedStatus = isReject ? 'REJECTED' : 'APPROVED';

  return baseConfirmation({
    action,
    confirmLabel: isReject ? 'Reject tax' : 'Approve tax',
    description: `${isReject ? 'Reject' : 'Approve'} tax profile for Partner ${partnerLabel(
      provider,
    )} after checking payout and withholding readiness.`,
    disabledReason:
      provider.taxProfile.status === blockedStatus ? `Tax profile is already ${blockedStatus.toLowerCase()}.` : '',
    hiddenInputs: [{ name: 'providerId', value: provider.id }],
    options,
    provider,
    reasonPlaceholder: isReject ? 'Tax rejection reason for Partner app correction' : '',
    title: `${isReject ? 'Reject' : 'Approve'} tax profile for ${partnerLabel(provider)}?`,
    tone: isReject ? 'danger' : 'success',
  });
}

function baseConfirmation(input: {
  readonly action: PartnerReviewConfirmationAction;
  readonly confirmLabel: string;
  readonly description: string;
  readonly disabledReason: string;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly options: PartnerReviewActionOptions;
  readonly provider: AdminProvider;
  readonly reasonDefaultValue?: string;
  readonly reasonPlaceholder: string;
  readonly supportingLinks?: readonly { readonly description?: string; readonly href: string; readonly label: string }[];
  readonly title: string;
  readonly tone: StatusBadgeTone;
}): PartnerReviewActionConfirmation {
  const disabled = Boolean(input.disabledReason);

  return {
    action: input.action,
    cancelHref: input.options.cancelHref ?? '/partners',
    confirmLabel: input.confirmLabel,
    description: input.disabledReason || input.description,
    disabled,
    hiddenInputs: input.hiddenInputs,
    providerId: input.provider.id,
    supportingLinks: input.supportingLinks ?? [],
    textInputs: input.reasonPlaceholder
      ? [
          {
            defaultValue: input.reasonDefaultValue,
            label: 'Reason',
            maxLength: REVIEW_REASON_INPUT_LIMITS.maxLength,
            minLength: REVIEW_REASON_INPUT_LIMITS.minLength,
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
