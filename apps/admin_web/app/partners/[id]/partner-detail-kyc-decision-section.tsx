import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, statusBadgeToneFromPillClass, type StatusBadgeTone } from '../../../components/status-badge';

import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

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
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Partner identity review, required CCCD evidence, selfie evidence, and app correction guidance."
      id="kyc"
      resultLabel={`KYC ${status ?? 'MISSING'}`}
      resultTone={kycDecisionPanelTone(status)}
      title="KYC decision"
    >
      <div className="participant-list admin-mb-10">
        <StatusBadge tone={evidence.allRequiredApproved ? 'success' : 'danger'}>
          {evidence.allRequiredApproved ? 'Evidence complete' : 'Evidence incomplete'}
        </StatusBadge>
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
          className={partnerDetailReviewTableClassName}
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
                <StatusBadge tone={item.ok ? 'success' : 'danger'}>
                  {item.ok ? 'OK' : 'FIX'}
                </StatusBadge>
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
      <PartnerDetailVuexyTableFooter rowCount={evidence.decisionChecklist.length} />
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
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
                <StatusBadge tone={statusBadgeToneFromPillClass(kycEvidencePill(row.status))}>
                  {row.status}
                </StatusBadge>
              </td>
              <td>
                <span className="muted">{row.fileLabel}</span>
              </td>
              <td>
                <span className="muted">
                  <DateTimeText fallback="Missing" value={row.uploadedAt} />
                </span>
              </td>
              <td>
                {row.rejectionReason ? (
                  <span className="muted">Rejection: {row.rejectionReason}</span>
                ) : (
                  <AdminInlineFallback>No rejection note</AdminInlineFallback>
                )}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={evidence.rows.length} />
      <p className="muted admin-mt-10">{evidence.nextAction}</p>
    </AdminFilterPanel>
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

function kycDecisionPanelTone(status?: string | null): StatusBadgeTone {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED' || status === 'MISSING') return 'danger';
  if (!status) return 'warning';
  return 'warning';
}

function KycDecisionEmptyState({ message }: { readonly message: string }) {
  return <AdminEmptyState message={message} />;
}
