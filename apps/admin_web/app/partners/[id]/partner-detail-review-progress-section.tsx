import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import type { PartnerReviewIssue } from '../partner-list-readiness';

type PartnerReviewPanelTone = 'pill-success' | 'pill-warn' | 'pill-danger' | 'pill-info' | 'pill-neutral';

export type PartnerLevelPlanItem = {
  readonly blocked: boolean;
  readonly detail: string;
  readonly level: string;
  readonly operatorAction: string;
  readonly ready: boolean;
  readonly status: string;
};

export type PartnerLevelPlanView = {
  readonly currentLevel: string;
  readonly items: readonly PartnerLevelPlanItem[];
};

export type PartnerResubmissionItem = {
  readonly operatorAction: string;
  readonly providerInstruction: string;
  readonly reason: string;
  readonly status: string;
  readonly target: string;
};

export type PartnerResubmissionPlanView = {
  readonly items: readonly PartnerResubmissionItem[];
};

export type PartnerReviewHistoryRow = {
  readonly action: string;
  readonly actorLabel: string;
  readonly atLabel: string;
  readonly id: string;
  readonly preview?: string | null;
  readonly statusLabel: string;
  readonly title: string;
};

export type PartnerReviewControlPanelMetric = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

export type PartnerReviewControlPanelItem = {
  readonly detail: string;
  readonly href?: string;
  readonly id: string;
  readonly label: string;
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerReviewPanelTone;
};

export type PartnerReviewControlPanelView = {
  readonly items: readonly PartnerReviewControlPanelItem[];
  readonly metrics: readonly PartnerReviewControlPanelMetric[];
  readonly reviewIssues: readonly PartnerReviewIssue[];
  readonly status: string;
  readonly tone: PartnerReviewPanelTone;
};

export type PartnerApprovalEvidenceSummaryRow = {
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly label: string;
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerReviewPanelTone;
};

type PartnerDetailLevelPathSectionProps = {
  readonly plan: PartnerLevelPlanView;
};

type PartnerDetailApprovalEvidenceSummarySectionProps = {
  readonly rows: readonly PartnerApprovalEvidenceSummaryRow[];
};

type PartnerDetailReviewControlPanelSectionProps = {
  readonly panel: PartnerReviewControlPanelView;
};

type PartnerDetailResubmissionGuidanceSectionProps = {
  readonly plan: PartnerResubmissionPlanView;
};

type PartnerDetailReviewHistorySectionProps = {
  readonly rows: readonly PartnerReviewHistoryRow[];
  readonly totalCount: number;
};

export function PartnerDetailApprovalEvidenceSummarySection({
  rows,
}: PartnerDetailApprovalEvidenceSummarySectionProps) {
  const openRows = rows.filter((row) => row.tone !== 'pill-success' && row.tone !== 'pill-neutral').length;
  const clearRows = rows.length - openRows;
  const firstOpenRow = rows.find((row) => row.tone !== 'pill-success' && row.tone !== 'pill-neutral');

  return (
    <div className="card admin-mb-16" id="partner-approval-evidence-summary">
      <div className="ops-section-header">
        <div>
          <h2>Partner approval evidence summary</h2>
          <p className="muted">
            Compact pre-approval checklist for KYC, required documents, payout bank, and tax evidence. Open
            the detail card only when this row needs a decision.
          </p>
        </div>
        <span className={`pill ${openRows ? 'pill-warn' : 'pill-success'}`}>
          {openRows ? `${openRows} approval task(s)` : 'Ready to approve'}
        </span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        <div>
          <span>Remaining</span>
          <strong>{openRows} item(s)</strong>
          <small>Evidence still needing review.</small>
        </div>
        <div>
          <span>Clear</span>
          <strong>{clearRows} item(s)</strong>
          <small>Rows already clear or not required.</small>
        </div>
        <div>
          <span>Next step</span>
          <strong>{firstOpenRow?.title ?? 'Approve Partner'}</strong>
          <small>Use the linked row before account approval.</small>
        </div>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<PartnerReviewTableEmptyState message="No Partner approval evidence rows." />}
          headers={approvalEvidenceHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="muted">{row.label}</span>
                <p>
                  <Link className="text-link" href={row.href}>
                    <strong>{row.title}</strong>
                  </Link>
                </p>
              </td>
              <td>
                <span className={`pill ${row.tone}`}>{row.status}</span>
              </td>
              <td>
                <p className="muted">{row.detail}</p>
              </td>
              <td>
                <Link className="text-link" href={row.href}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

export function PartnerDetailReviewControlPanelSection({
  panel,
}: PartnerDetailReviewControlPanelSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-review-control-panel">
      <div className="ops-section-header">
        <div>
          <h2>Partner review control panel</h2>
          <p className="muted">
            One-screen review map for submitted Partner information, active hold reason, resubmission needs,
            and the latest admin decision trail.
          </p>
        </div>
        <span className={`pill ${panel.tone}`}>{panel.status}</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {panel.metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.helper}</small>
          </div>
        ))}
      </div>
      <div className="participant-list admin-mt-12" aria-label="Current approval issues">
        <span className="muted">Current approval issues</span>
        <span className={`pill ${panel.reviewIssues.length ? 'pill-warn' : 'pill-success'}`}>
          {panel.reviewIssues.length ? `${panel.reviewIssues.length} approval need(s)` : 'Approval clear'}
        </span>
        {panel.reviewIssues.slice(0, 5).map((issue) => (
          <span
            className={`pill ${issue.severity === 'high' ? 'pill-danger' : 'pill-warn'}`}
            key={issue.label}
          >
            {issue.label}
          </span>
        ))}
        {panel.reviewIssues.length > 5 ? (
          <span className="pill pill-neutral">+{panel.reviewIssues.length - 5} more</span>
        ) : null}
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<PartnerReviewTableEmptyState message="No Partner review control rows." />}
          headers={reviewControlPanelHeaders}
          rowCount={panel.items.length}
        >
          {panel.items.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="muted">{item.label}</span>
                <p>
                  <strong>{item.title}</strong>
                </p>
              </td>
              <td>
                <span className={`pill ${item.tone}`}>{item.status}</span>
              </td>
              <td>
                <p className="muted">{item.detail}</p>
              </td>
              <td>
                {item.href ? (
                  <Link className="text-link" href={item.href}>
                    Open
                  </Link>
                ) : (
                  <span className="muted">Review</span>
                )}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

export function PartnerDetailLevelPathSection({ plan }: PartnerDetailLevelPathSectionProps) {
  return (
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Partner level path</h2>
          <p className="muted">
            Operator view of Level 1 signup, Level 2 activity, Level 3 payout, and optional profile review
            gates.
          </p>
        </div>
        <span className="pill pill-info">{plan.currentLevel}</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<PartnerReviewTableEmptyState message="No Partner level path rows." />}
          headers={levelPathHeaders}
          rowCount={plan.items.length}
        >
          {plan.items.map((item) => (
            <tr key={item.level}>
              <td>
                <strong>{item.level}</strong>
              </td>
              <td>
                <span className={`pill ${levelPathPill(item)}`}>{item.status}</span>
              </td>
              <td>
                <p className="muted">{item.detail}</p>
              </td>
              <td>
                <p className="muted">{item.operatorAction}</p>
              </td>
              <td>
                <span className="muted">{item.ready ? 'Clear' : item.blocked ? 'Blocked' : 'Next'}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

export function PartnerDetailResubmissionGuidanceSection({
  plan,
}: PartnerDetailResubmissionGuidanceSectionProps) {
  return (
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Resubmission guidance</h2>
          <p className="muted">
            Use this when a partner asks what to fix after rejection. Keep the message specific and auditable.
          </p>
        </div>
        <span className={`pill ${plan.items.length ? 'pill-danger' : 'pill-success'}`}>
          {plan.items.length} item(s)
        </span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={
            <PartnerReviewTableEmptyState message="No resubmission request needed. There are no rejected Partner documents, bank accounts, KYC, or tax profiles." />
          }
          headers={resubmissionGuidanceHeaders}
          rowCount={plan.items.length}
        >
          {plan.items.map((item) => (
            <tr key={item.target}>
              <td>
                <strong>{item.target}</strong>
              </td>
              <td>
                <span className={`pill ${resubmissionPill(item.status)}`}>{item.status}</span>
              </td>
              <td>
                <p className="muted">{item.reason}</p>
              </td>
              <td>
                <p className="muted">{item.providerInstruction}</p>
              </td>
              <td>
                <span className="muted">{item.operatorAction}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

export function PartnerDetailReviewHistorySection({
  rows,
  totalCount,
}: PartnerDetailReviewHistorySectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-review-history">
      <div className="ops-section-header">
        <div>
          <h2>Review history</h2>
          <p className="muted">
            Partner, KYC, document, bank, and tax review decisions are shown here for handoff and audit.
          </p>
        </div>
        <span className="pill pill-info">{totalCount} recent event(s)</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={
            <PartnerReviewTableEmptyState message="No partner review logs yet. New approval, rejection, and resubmission actions will appear here." />
          }
          headers={reviewHistoryHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.title}</strong>
              </td>
              <td>
                <span className={`pill ${reviewHistoryPill(row.statusLabel)}`}>{row.statusLabel}</span>
              </td>
              <td>
                <span className="muted">{row.atLabel}</span>
                <p className="muted">{row.actorLabel}</p>
              </td>
              <td>
                <span className="muted">{row.preview ?? 'No preview'}</span>
              </td>
              <td>
                <span className="muted">{row.action}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

const approvalEvidenceHeaders = ['Evidence', 'Status', 'Detail', 'Action'] as const;
const reviewControlPanelHeaders = ['Decision area', 'Status', 'Operator read', 'Open section'] as const;
const levelPathHeaders = ['Level', 'Status', 'Detail', 'Operator action', 'Outcome'] as const;
const resubmissionGuidanceHeaders = [
  'Target',
  'Status',
  'Reason',
  'Partner instruction',
  'Operator action',
] as const;
const reviewHistoryHeaders = ['Review event', 'Status', 'Timeline', 'Preview', 'Action'] as const;

function levelPathPill(item: PartnerLevelPlanItem) {
  if (item.ready) return 'pill-success';
  if (item.blocked) return 'pill-danger';
  return 'pill-warn';
}

function resubmissionPill(status: string) {
  if (status === 'CLEAR' || status === 'APPROVED') return 'pill-success';
  if (status === 'REJECTED' || status === 'BLOCKED') return 'pill-danger';
  return 'pill-warn';
}

function reviewHistoryPill(status: string) {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus.includes('APPROVED') || normalizedStatus.includes('APPROVE')) {
    return 'pill-success';
  }
  if (normalizedStatus.includes('REJECT')) {
    return 'pill-danger';
  }
  if (normalizedStatus.includes('PENDING') || normalizedStatus.includes('HOLD')) {
    return 'pill-warn';
  }
  return 'pill-info';
}

function PartnerReviewTableEmptyState({ message }: { readonly message: string }) {
  return (
    <>
      <strong>No records found</strong>
      <p className="muted">{message}</p>
    </>
  );
}
