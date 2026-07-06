import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminCard } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import type { PartnerReviewIssue } from '../partner-list-readiness';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

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
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Compact review checklist for Level 2 approval evidence plus finance-only follow-up rows. Open the detail card only when this row needs a decision."
      id="partner-approval-evidence-summary"
      resultLabel={openRows ? `${openRows} approval task(s)` : 'Ready to approve'}
      resultTone={openRows ? 'warning' : 'success'}
      title="Partner review evidence summary"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={[
          {
            detail: 'Evidence still needing review.',
            label: 'Remaining',
            value: `${openRows} item(s)`,
          },
          {
            detail: 'Rows already clear or not required.',
            label: 'Clear',
            value: `${clearRows} item(s)`,
          },
          {
            detail: 'Use the linked row before account or finance follow-up.',
            label: 'Next step',
            value: firstOpenRow?.title ?? 'Approve Partner',
          },
        ]}
      />
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<PartnerReviewTableEmptyState message="No Partner approval evidence rows." />}
          headers={approvalEvidenceHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="muted">{row.label}</span>
                <p>
                  <AdminTextLink href={row.href}>
                    <strong>{row.title}</strong>
                  </AdminTextLink>
                </p>
              </td>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(row.tone)}>{row.status}</StatusBadge>
              </td>
              <td>
                <p className="muted">{row.detail}</p>
              </td>
              <td>
                <AdminTextLink href={row.href}>
                  Open
                </AdminTextLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}

export function PartnerDetailReviewControlPanelSection({
  panel,
}: PartnerDetailReviewControlPanelSectionProps) {
  const approvalDecision = panel.items.find((item) => item.id === 'approval-decision');
  const resubmissionNeeds = panel.items.find((item) => item.id === 'resubmission-needs');
  const latestReview = panel.items.find((item) => item.id === 'latest-review-event');
  const correctionLoopItems = [
    {
      item: resubmissionNeeds,
      label: 'Partner correction',
      fallback: 'No correction request is currently open.',
    },
    {
      item: approvalDecision,
      label: 'Admin gate',
      fallback: 'No admin approval gate is currently open.',
    },
    {
      item: latestReview,
      label: 'Audit trail',
      fallback: 'No review event is loaded yet.',
    },
  ] as const;

  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="One-screen review map for submitted Partner information, active hold reason, resubmission needs, and the latest admin decision trail."
      id="partner-review-control-panel"
      resultLabel={panel.status}
      resultTone={reviewPanelResultTone(panel.tone)}
      title="Partner review control panel"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={panel.metrics.map((metric) => ({
          detail: metric.helper,
          label: metric.label,
          value: metric.value,
        }))}
      />
      <div className="participant-list admin-mt-12" aria-label="Current approval issues">
        <span className="muted">Current approval issues</span>
        <StatusBadge tone={panel.reviewIssues.length ? 'warning' : 'success'}>
          {panel.reviewIssues.length ? `${panel.reviewIssues.length} approval need(s)` : 'Approval clear'}
        </StatusBadge>
        {panel.reviewIssues.slice(0, 5).map((issue) => (
          <StatusBadge key={issue.label} tone={issue.severity === 'high' ? 'danger' : 'warning'}>
            {issue.label}
          </StatusBadge>
        ))}
        {panel.reviewIssues.length > 5 ? (
          <StatusBadge tone="neutral">+{panel.reviewIssues.length - 5} more</StatusBadge>
        ) : null}
      </div>
      <div className="partner-review-correction-loop" aria-label="Partner correction loop">
        {correctionLoopItems.map(({ fallback, item, label }) => (
          <AdminCard className="partner-review-correction-card" key={label}>
            <div>
              <span>{label}</span>
              <strong>{item?.title ?? fallback}</strong>
            </div>
            {item ? (
              <StatusBadge tone={statusBadgeToneFromPillClass(item.tone)}>{item.status}</StatusBadge>
            ) : null}
            <p className="muted">{item?.detail ?? fallback}</p>
            {item?.href ? (
              <AdminTextLink href={item.href}>
                Open related section
              </AdminTextLink>
            ) : null}
          </AdminCard>
        ))}
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
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
                <StatusBadge tone={statusBadgeToneFromPillClass(item.tone)}>{item.status}</StatusBadge>
              </td>
              <td>
                <p className="muted">{item.detail}</p>
              </td>
              <td>
                {item.href ? (
                  <AdminTextLink href={item.href}>
                    Open
                  </AdminTextLink>
                ) : (
                  <span className="muted">Review</span>
                )}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={panel.items.length} />
    </AdminFilterPanel>
  );
}

export function PartnerDetailLevelPathSection({ plan }: PartnerDetailLevelPathSectionProps) {
  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Operator view of Level 1 signup and Level 2 activity approval. Withdrawal detail review happens when wallet withdrawal is requested."
      id="partner-level-path"
      resultLabel={plan.currentLevel}
      title="Partner level path"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
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
                <StatusBadge tone={statusBadgeToneFromPillClass(levelPathPill(item))}>
                  {item.status}
                </StatusBadge>
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
      <PartnerDetailVuexyTableFooter rowCount={plan.items.length} />
    </AdminFilterPanel>
  );
}

export function PartnerDetailResubmissionGuidanceSection({
  plan,
}: PartnerDetailResubmissionGuidanceSectionProps) {
  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Use this when a partner asks what to fix after rejection. Keep the message specific and auditable."
      id="partner-resubmission-guidance"
      resultLabel={`${plan.items.length} item(s)`}
      resultTone={plan.items.length ? 'danger' : 'success'}
      title="Resubmission guidance"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={
            <PartnerReviewTableEmptyState message="No resubmission request needed. There are no rejected KYC, document, service profile, public media, or finance follow-up items." />
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
                <StatusBadge tone={statusBadgeToneFromPillClass(resubmissionPill(item.status))}>
                  {item.status}
                </StatusBadge>
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
      <PartnerDetailVuexyTableFooter rowCount={plan.items.length} />
    </AdminFilterPanel>
  );
}

export function PartnerDetailReviewHistorySection({
  rows,
  totalCount,
}: PartnerDetailReviewHistorySectionProps) {
  return (
    <AdminFilterPanel
      className={partnerDetailReviewCardClassName}
      description="Partner approval, KYC, document, service profile, public media, finance follow-up, and hold decisions are shown here for handoff and audit."
      id="partner-review-history"
      resultLabel={`${totalCount} recent event(s)`}
      title="Review history"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
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
                <StatusBadge tone={statusBadgeToneFromPillClass(reviewHistoryPill(row.statusLabel))}>
                  {row.statusLabel}
                </StatusBadge>
              </td>
              <td>
                <span className="muted">{row.atLabel}</span>
                <p className="muted">{row.actorLabel}</p>
              </td>
              <td>
                {row.preview ? (
                  <span className="muted">{row.preview}</span>
                ) : (
                  <AdminInlineFallback>No preview</AdminInlineFallback>
                )}
              </td>
              <td>
                <span className="muted">{row.action}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
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

function reviewPanelResultTone(
  tone: PartnerReviewPanelTone,
): 'danger' | 'info' | 'neutral' | 'success' | 'warning' {
  if (tone === 'pill-danger') return 'danger';
  if (tone === 'pill-success') return 'success';
  if (tone === 'pill-warn') return 'warning';
  if (tone === 'pill-neutral') return 'neutral';
  return 'info';
}

function PartnerReviewTableEmptyState({ message }: { readonly message: string }) {
  return <AdminEmptyState message={message} />;
}
