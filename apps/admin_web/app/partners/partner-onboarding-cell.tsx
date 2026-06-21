import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import type { AdminProvider } from '../../lib/admin-api';
import {
  providerDocumentLabel,
  providerDocumentReviewHint,
} from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { formatDateTime } from '../../lib/admin-format';
import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../lib/operations-policy';
import { formatBytes } from './partner-list-ops';
import {
  kycDocumentPillClass,
  missingApprovedRequiredKycDocuments,
  partnerKycState,
  providerKycDocumentStatus,
} from './partner-kyc-facts';
import {
  partnerTaxNeedsReview,
  partnerTaxPillClass,
} from './partner-finance-readiness-facts';

export type PartnerOnboardingCellBankAccount = NonNullable<AdminProvider['bankAccounts']>[number];
export type PartnerOnboardingCellDocument = NonNullable<AdminProvider['documents']>[number];

type PartnerOnboardingCellProps = {
  readonly bankActions: (
    providerId: string,
    bank: PartnerOnboardingCellBankAccount,
  ) => readonly ActionMenuItem[];
  readonly documentActions: (
    providerId: string,
    document: PartnerOnboardingCellDocument,
  ) => readonly ActionMenuItem[];
  readonly kycActions: (
    provider: AdminProvider,
    canApproveKyc: boolean,
  ) => readonly ActionMenuItem[];
  readonly partnerName: string;
  readonly provider: AdminProvider;
  readonly taxActions: (provider: AdminProvider) => readonly ActionMenuItem[];
};

export function PartnerOnboardingCell({
  bankActions,
  documentActions,
  kycActions,
  partnerName,
  provider,
  taxActions,
}: PartnerOnboardingCellProps) {
  const primaryBank = provider.bankAccounts?.[0];
  const rejectedBankReason = latestRejectedBankReason(provider);
  const bankCorrectionResubmitted = primaryBank?.status === 'PENDING_REVIEW' && Boolean(rejectedBankReason);
  const missingAgreements = 5 - (provider.agreements?.length ?? 0);
  const documents = provider.documents ?? [];
  const canApproveKyc = hasApprovedRequiredKycDocuments(provider);
  const kycState = partnerKycState(provider);
  const taxNeedsReview = partnerTaxNeedsReview(provider);
  const taxStatus = provider.taxProfile?.status ?? (taxNeedsReview ? 'MISSING' : 'DEFERRED');

  return (
    <div>
      <div className="participant-list admin-mb-8">
        <span className="pill pill-info">{provider.level ?? 'LEVEL_1_SIGNUP'}</span>
        <span className={`pill ${provider.kyc?.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
          KYC {provider.kyc?.status ?? 'DRAFT'}
        </span>
        <span className={`pill ${primaryBank?.status === 'APPROVED' ? 'pill-success' : 'pill-neutral'}`}>
          Bank {primaryBank?.status ?? 'MISSING'}
        </span>
        <span className={`pill ${partnerTaxPillClass(provider)}`}>Tax {taxStatus}</span>
      </div>
      <p className="muted admin-mb-8">
        {provider.legalName ? `Legal: ${marketplaceDisplayText(provider.legalName)}` : 'Legal name not saved'}
        {provider.kyc?.cccdNumberLast4 ? ` / CCCD ****${provider.kyc.cccdNumberLast4}` : ''}
      </p>
      <div className="participant-list admin-mb-8">
        {ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.map((documentType) => {
          const documentStatus = providerKycDocumentStatus(provider, documentType);
          return (
            <span className={`pill ${kycDocumentPillClass(documentStatus)}`} key={documentType}>
              {providerDocumentLabel(documentType)} {documentStatus}
            </span>
          );
        })}
      </div>
      <p className="muted admin-mb-8">
        {kycState.operatorAction}
      </p>
      <p className="muted admin-mb-8">
        Agreements: {provider.agreements?.length ?? 0}/5
        {missingAgreements > 0 ? ` (${missingAgreements} missing)` : ''}
      </p>
      {primaryBank ? (
        <p className="muted admin-mb-8">
          {marketplaceDisplayText(primaryBank.bankName)} / {primaryBank.accountNumberMasked ?? 'no account'} /{' '}
          {marketplaceDisplayText(primaryBank.accountHolderName)}
        </p>
      ) : null}
      {bankCorrectionResubmitted ? (
        <div className="admin-mb-8">
          <p className="muted admin-mb-4">
            Bank correction resubmitted
          </p>
          <p className="muted admin-mb-0">
            Previous issue: {marketplaceDisplayText(rejectedBankReason)}
          </p>
        </div>
      ) : null}
      {provider.taxProfile ? (
        <p className="muted admin-mb-8">
          Tax code ****{provider.taxProfile.taxCodeLast4 ?? '----'} / {provider.taxProfile.registeredAddress}
        </p>
      ) : null}
      {documents.length ? (
        <div className="admin-mb-10">
          <p className="muted admin-mb-6">
            Typed documents
          </p>
          {documents.map((document) => (
            <div key={document.id} className="provider-file-row">
              <div className="participant-list admin-mb-6">
                <span className="pill pill-info">{providerDocumentLabel(document.type)}</span>
                <span className={`pill ${document.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
                  {document.status}
                </span>
              </div>
              <p className="muted admin-mb-6">
                {providerDocumentReviewHint(document.type)}
              </p>
              <p className="muted admin-mb-6">
                {document.fileAsset?.contentType ?? 'unknown file'}
                {document.fileAsset?.sizeBytes ? ` / ${formatBytes(document.fileAsset.sizeBytes)}` : ''}
                {document.fileAsset?.uploadedAt
                  ? ` / uploaded ${formatDateTime(document.fileAsset.uploadedAt)}`
                  : ''}
              </p>
              <p className="muted admin-mb-6">
                {marketplaceDisplayText(document.fileAsset?.key ?? 'No file key')}
                {document.fileAsset?.id ? (
                  <>
                    {' / '}
                    <AdminFormControlLink className="text-link" href={`/partners/${provider.id}#documents`}>
                      open detail to view
                    </AdminFormControlLink>
                  </>
                ) : null}
              </p>
              <ActionMenu
                actions={documentActions(provider.id, document)}
                label={`${providerDocumentLabel(document.type)} review actions for ${partnerName}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="muted admin-mb-8">
          No typed partner documents yet.
        </p>
      )}
      <div className="actions">
        <ActionMenu actions={kycActions(provider, canApproveKyc)} label={`KYC review actions for ${partnerName}`} />
        {primaryBank ? (
          <ActionMenu actions={bankActions(provider.id, primaryBank)} label={`Bank review actions for ${partnerName}`} />
        ) : null}
        {provider.taxProfile ? (
          <ActionMenu actions={taxActions(provider)} label={`Legacy tax profile review actions for ${partnerName}`} />
        ) : null}
      </div>
      {!canApproveKyc ? (
        <p className="muted admin-mt-8">
          KYC approval unlocks after CCCD front, CCCD back, and selfie documents are approved.
        </p>
      ) : null}
    </div>
  );
}

function hasApprovedRequiredKycDocuments(provider: AdminProvider) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function latestRejectedBankReason(provider: AdminProvider) {
  const rejectedBank = (provider.bankAccounts ?? []).find(
    (account) => account.status === 'REJECTED' && account.rejectionReason?.trim(),
  );
  return rejectedBank?.rejectionReason?.trim() ?? null;
}
