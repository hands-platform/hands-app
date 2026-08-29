import { marketplaceDisplayText } from '../../../lib/admin-copy';
import type { PartnerKycDecisionEvidence } from './partner-detail-kyc-decision-section';
import type { PartnerApprovalEvidenceSummaryRow } from './partner-detail-review-progress-section';
import { formatDate } from './partner-detail-format';
import { buildPartnerDetailTargetHref } from './partner-detail-workspace-model';

type PartnerApprovalEvidenceProvider = {
  readonly id: string;
  readonly kyc?: {
    readonly cccdNumberLast4?: string | null;
    readonly status?: string | null;
    readonly submittedAt?: string | null;
  } | null;
  readonly taxProfile?: {
    readonly legalName: string;
    readonly registeredAddress: string;
    readonly status: string;
    readonly taxCodeLast4?: string | null;
  } | null;
};

type PartnerApprovalEvidenceBank = {
  readonly accountHolderName: string;
  readonly accountNumberLast4?: string | null;
  readonly accountNumberMasked?: string | null;
  readonly bankName: string;
  readonly status: string;
} | null;

export function buildPartnerApprovalEvidenceSummaryRows({
  hasFirstRevenue,
  kycEvidence,
  primaryBank,
  provider,
}: {
  readonly hasFirstRevenue: boolean;
  readonly kycEvidence: PartnerKycDecisionEvidence;
  readonly primaryBank: PartnerApprovalEvidenceBank;
  readonly provider: PartnerApprovalEvidenceProvider;
}): PartnerApprovalEvidenceSummaryRow[] {
  const requiredDocumentRows = kycEvidence.rows;
  const approvedRequiredDocumentCount = requiredDocumentRows.filter(
    (row) => row.status === 'APPROVED',
  ).length;
  const rejectedRequiredDocumentCount = requiredDocumentRows.filter(
    (row) => row.status === 'REJECTED',
  ).length;
  const kycStatus = provider.kyc?.status ?? 'MISSING';
  const bankStatus = primaryBank?.status ?? 'ON_REQUEST';
  const taxStatus = provider.taxProfile?.status ?? (hasFirstRevenue ? 'MISSING' : 'DEFERRED');

  return [
    {
      id: 'kyc-evidence-summary',
      label: 'KYC',
      title: kycStatus === 'APPROVED' ? 'KYC approved' : 'KYC decision needed',
      detail: provider.kyc
        ? `Status ${kycStatus}; CCCD/CMND ${
            provider.kyc.cccdNumberLast4 ? `****${provider.kyc.cccdNumberLast4}` : 'missing'
          }; submitted ${formatDate(provider.kyc.submittedAt)}.`
        : 'Partner has not submitted the KYC identity record yet.',
      status: kycStatus,
      tone: approvalEvidenceStatusTone(kycStatus),
      href: buildPartnerDetailTargetHref(provider.id, 'documents'),
    },
    {
      id: 'document-evidence-summary',
      label: 'DOCS',
      title:
        approvedRequiredDocumentCount === requiredDocumentRows.length
          ? 'Required documents approved'
          : 'Required documents need review',
      detail: `${approvedRequiredDocumentCount}/${requiredDocumentRows.length} required document(s) approved${
        rejectedRequiredDocumentCount ? `; ${rejectedRequiredDocumentCount} rejected` : ''
      }.`,
      status:
        approvedRequiredDocumentCount === requiredDocumentRows.length
          ? 'APPROVED'
          : rejectedRequiredDocumentCount
            ? 'REJECTED'
            : 'PENDING',
      tone:
        approvedRequiredDocumentCount === requiredDocumentRows.length
          ? 'pill-success'
          : rejectedRequiredDocumentCount
            ? 'pill-danger'
            : 'pill-warn',
      href: buildPartnerDetailTargetHref(provider.id, 'documents'),
    },
    {
      id: 'bank-evidence-summary',
      label: 'BANK',
      title: bankStatus === 'APPROVED' ? 'Withdrawal details ready' : 'Withdrawal details on request',
      detail: primaryBank
        ? `${marketplaceDisplayText(primaryBank.bankName)} / ${marketplaceDisplayText(
            primaryBank.accountHolderName,
          )} / ${primaryBank.accountNumberMasked ?? primaryBank.accountNumberLast4 ?? 'account missing'}.`
        : 'Collected only when the Partner requests wallet withdrawal/deposit or manual settlement.',
      status: bankStatus,
      tone: approvalEvidenceStatusTone(bankStatus),
      href: buildPartnerDetailTargetHref(provider.id, 'bank'),
    },
    {
      id: 'tax-evidence-summary',
      label: 'TAX',
      title:
        taxStatus === 'DEFERRED'
          ? 'Tax profile optional'
          : taxStatus === 'APPROVED'
            ? 'Optional tax profile approved'
            : 'Optional tax profile submitted',
      detail:
        taxStatus === 'DEFERRED'
          ? 'Tax profile evidence does not block Level 2 approval, matching, or current payout review.'
          : provider.taxProfile
            ? `${marketplaceDisplayText(provider.taxProfile.legalName)} / tax ****${
                provider.taxProfile.taxCodeLast4 ?? '----'
              } / ${marketplaceDisplayText(provider.taxProfile.registeredAddress)}.`
            : 'No tax profile is required for current Vietnam operations.',
      status: taxStatus,
      tone: taxStatus === 'DEFERRED' ? 'pill-neutral' : approvalEvidenceStatusTone(taxStatus),
      href: buildPartnerDetailTargetHref(provider.id, 'tax'),
    },
  ];
}

export function approvalEvidenceStatusTone(status: string): PartnerApprovalEvidenceSummaryRow['tone'] {
  if (status === 'APPROVED') return 'pill-success';
  if (status === 'REJECTED' || status === 'MISSING') return 'pill-danger';
  if (status === 'DEFERRED' || status === 'ON_REQUEST') return 'pill-neutral';
  return 'pill-warn';
}
