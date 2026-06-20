import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

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
      {rejectionReason ? <p className="muted">Partner app correction: {rejectionReason}</p> : null}
      <div className="actions admin-mt-12">
        <ActionMenu actions={reviewActions} label="KYC review actions" variant="dropdown" />
      </div>
      <div className="service-trace-summary admin-mt-12">
        <div>
          <span>Partner app correction guidance</span>
          <strong>{canApprove ? 'Ready for approval' : 'Correction required'}</strong>
          <small>
            Reject KYC only when the Partner must resubmit. The reason appears in the Partner app correction
            checklist.
          </small>
        </div>
      </div>
      {!canApprove ? (
        <p className="muted admin-mt-10">
          Approve the required CCCD front, CCCD back, and selfie documents before approving KYC.
        </p>
      ) : null}
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<KycDecisionEmptyState message="No KYC checklist rows." />}
          headers={kycChecklistHeaders}
          rowCount={evidence.decisionChecklist.length}
        >
          {evidence.decisionChecklist.map((item) => (
            <tr key={item.label}>
              <td>
                <strong>{item.label}</strong>
              </td>
              <td>
                <span className={`pill ${item.ok ? 'pill-success' : 'pill-danger'}`}>
                  {item.ok ? 'OK' : 'FIX'}
                </span>
              </td>
              <td>
                <p className="muted">{item.detail}</p>
              </td>
              <td>
                <span className="muted">{item.ok ? 'Clear' : 'Needs review'}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<KycDecisionEmptyState message="No KYC evidence files." />}
          headers={kycEvidenceHeaders}
          rowCount={evidence.rows.length}
        >
          {evidence.rows.map((row) => (
            <tr key={row.type}>
              <td>
                <strong>{row.label}</strong>
                <p className="muted">{row.type}</p>
              </td>
              <td>
                <span className={`pill ${kycEvidencePill(row.status)}`}>{row.status}</span>
              </td>
              <td>
                <span className="muted">{row.fileLabel}</span>
              </td>
              <td>
                <span className="muted">{row.uploadedAt ? formatDate(row.uploadedAt) : 'Missing'}</span>
              </td>
              <td>
                {row.rejectionReason ? (
                  <span className="muted">Rejection: {row.rejectionReason}</span>
                ) : (
                  <span className="muted">No rejection note</span>
                )}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <p className="muted admin-mt-10">{evidence.nextAction}</p>
    </div>
  );
}

const kycChecklistHeaders = ['Gate', 'Status', 'Detail', 'Outcome'] as const;
const kycEvidenceHeaders = ['Evidence', 'Status', 'File', 'Uploaded', 'Review note'] as const;

function kycEvidencePill(status: string) {
  if (status === 'APPROVED') return 'pill-success';
  if (status === 'REJECTED') return 'pill-danger';
  if (status === 'PENDING' || status === 'PENDING_REVIEW') return 'pill-warn';
  return 'pill-neutral';
}

function KycDecisionEmptyState({ message }: { readonly message: string }) {
  return (
    <>
      <strong>No records found</strong>
      <p className="muted">{message}</p>
    </>
  );
}
