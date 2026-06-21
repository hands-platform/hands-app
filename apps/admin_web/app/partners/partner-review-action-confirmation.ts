import type { AdminProvider } from '../../lib/admin-api';
import { providerDocumentLabel } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';
import { missingApprovedRequiredKycDocuments } from './partner-kyc-facts';
import { providerPublicMedia } from './partner-list-profile';

export type PartnerReviewConfirmationAction =
  | 'approve-bank'
  | 'approve-document'
  | 'approve-kyc'
  | 'approve-media'
  | 'approve-tax'
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

const BANK_CORRECTION_DEFAULT_REASON = '입금 정보가 정확하지 않아 입금이 되지 않습니다';

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
  if (action === 'approve-media' || action === 'reject-media') {
    return buildMediaConfirmation(provider, action, values.fileId, options);
  }
  if (action === 'approve-kyc' || action === 'reject-kyc') {
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
    title: `${isReject ? 'Reject' : 'Approve'} ${documentLabel} ${shortId(document.id)}?`,
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
    title: `${isReject ? 'Reject' : 'Approve'} bank ${shortId(bankAccount.id)}?`,
    tone: isReject ? 'danger' : 'success',
  });
}

function buildMediaConfirmation(
  provider: AdminProvider,
  action: 'approve-media' | 'reject-media',
  fileId: string,
  options: PartnerReviewActionOptions,
): PartnerReviewActionConfirmation | null {
  const file = providerPublicMedia(provider).find((item) => item.id === fileId);
  if (!file) {
    return null;
  }

  const isReject = action === 'reject-media';
  const blockedStatus = isReject ? 'REJECTED' : 'APPROVED';
  const mediaLabel = file.purpose || 'public media';

  return baseConfirmation({
    action,
    confirmLabel: isReject ? 'Reject media' : 'Approve media',
    description: `${isReject ? 'Reject' : 'Approve'} ${mediaLabel} for Partner ${partnerLabel(
      provider,
    )} after checking the public profile asset.`,
    disabledReason:
      file.reviewStatus === blockedStatus ? `Public media is already ${blockedStatus.toLowerCase()}.` : '',
    hiddenInputs: [
      { name: 'providerId', value: provider.id },
      { name: 'fileId', value: file.id },
    ],
    options,
    provider,
    reasonPlaceholder: isReject ? 'Media rejection reason for Partner app correction' : '',
    title: `${isReject ? 'Reject' : 'Approve'} media ${shortId(file.id)}?`,
    tone: isReject ? 'danger' : 'success',
  });
}

function buildKycConfirmation(
  provider: AdminProvider,
  action: 'approve-kyc' | 'reject-kyc',
  options: PartnerReviewActionOptions,
): PartnerReviewActionConfirmation {
  const isReject = action === 'reject-kyc';
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const disabledReason = isReject
    ? !provider.kyc
      ? 'KYC record is missing.'
      : provider.kyc.status === 'REJECTED'
        ? 'KYC is already rejected.'
        : ''
    : provider.kyc?.status === 'APPROVED'
      ? 'KYC is already approved.'
      : missingDocuments.length > 0
        ? `Approve required documents first: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`
        : '';

  return baseConfirmation({
    action,
    confirmLabel: isReject ? 'Reject KYC' : 'Approve KYC',
    description: isReject
      ? `Reject KYC for Partner ${partnerLabel(
          provider,
        )} and show the reason in the Partner app correction checklist for resubmission.`
      : `Approve KYC for Partner ${partnerLabel(provider)} after reviewing required identity evidence.`,
    disabledReason,
    hiddenInputs: [{ name: 'providerId', value: provider.id }],
    options,
    provider,
    reasonPlaceholder: isReject ? 'KYC rejection reason for Partner app correction' : '',
    title: `${isReject ? 'Reject' : 'Approve'} KYC for Partner ${shortId(provider.id)}?`,
    tone: isReject ? 'danger' : 'success',
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
    title: `${isReject ? 'Reject' : 'Approve'} tax profile ${shortId(provider.id)}?`,
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
