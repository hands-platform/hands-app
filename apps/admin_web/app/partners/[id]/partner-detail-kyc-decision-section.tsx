import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';

import { formatDate } from './partner-detail-format';

export type PartnerKycDecisionEvidence = {
  readonly allRequiredApproved: boolean;
  readonly decisionChecklist: readonly PartnerKycDecisionChecklistItem[];
  readonly nextAction: string;
  readonly rows: readonly PartnerKycEvidenceRow[];
};

type PartnerKycDecisionChecklistItem = {
  readonly detail: string;
  readonly label: string;
  readonly ok: boolean;
};

type PartnerKycEvidenceRow = {
  readonly fileLabel: string;
  readonly label: string;
  readonly rejectionReason?: string | null;
  readonly status: string;
  readonly type: string;
  readonly uploadedAt?: string | null;
};

type PartnerDetailKycDecisionSectionProps = {
  readonly canApprove: boolean;
  readonly cccdNumberLast4?: string | null;
  readonly evidence: PartnerKycDecisionEvidence;
  readonly rejectionReason?: string | null;
  readonly reviewActions: readonly ActionMenuItem[];
  readonly reviewedLabel: string;
  readonly status?: string | null;
  readonly submittedLabel: string;
};

export function PartnerDetailKycDecisionSection({
  canApprove,
  cccdNumberLast4,
  evidence,
  rejectionReason,
  reviewActions,
  reviewedLabel,
  status,
  submittedLabel,
}: PartnerDetailKycDecisionSectionProps) {
  return (
    <div className="card" id="kyc">
      <h2>KYC decision</h2>
      <div className="participant-list admin-mb-10">
        <span className={`pill ${status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
          KYC {status ?? 'MISSING'}
        </span>
        <span className={`pill ${evidence.allRequiredApproved ? 'pill-success' : 'pill-danger'}`}>
          {evidence.allRequiredApproved ? 'Evidence complete' : 'Evidence incomplete'}
        </span>
      </div>
      <p className="muted">CCCD last 4: {cccdNumberLast4 ? `****${cccdNumberLast4}` : 'Missing'}</p>
      <p className="muted">Submitted: {submittedLabel}</p>
      <p className="muted">Reviewed: {reviewedLabel}</p>
      {rejectionReason ? <p className="muted">Rejection reason: {rejectionReason}</p> : null}
      <div className="actions admin-mt-12">
        <ActionMenu actions={reviewActions} label="KYC review actions" />
      </div>
      {!canApprove ? (
        <p className="muted admin-mt-10">
          Approve the required CCCD front, CCCD back, and selfie documents before approving KYC.
        </p>
      ) : null}
      <div className="setup-stage-list admin-mt-12">
        {evidence.decisionChecklist.map((item) => (
          <div className="setup-stage-item" key={item.label}>
            <span>{item.ok ? 'OK' : 'FIX'}</span>
            <div>
              <strong>{item.label}</strong>
              <p className="muted">{item.detail}</p>
            </div>
            <small>{item.ok ? 'Clear' : 'Needs review'}</small>
          </div>
        ))}
      </div>
      <div className="setup-stage-list admin-mt-12">
        {evidence.rows.map((row) => (
          <div className="setup-stage-item" key={row.type}>
            <span>{row.status === 'APPROVED' ? 'OK' : 'CHECK'}</span>
            <div>
              <strong>{row.label}</strong>
              <p className="muted">
                {row.status} / {row.fileLabel}
                {row.uploadedAt ? ` / uploaded ${formatDate(row.uploadedAt)}` : ''}
              </p>
              {row.rejectionReason ? <p className="muted">Rejection: {row.rejectionReason}</p> : null}
            </div>
            <small>{row.status}</small>
          </div>
        ))}
      </div>
      <p className="muted admin-mt-10">{evidence.nextAction}</p>
    </div>
  );
}
