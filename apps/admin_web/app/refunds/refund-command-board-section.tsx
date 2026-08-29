import { RefreshCw } from 'lucide-react';

import { AdminMiniMetricStrip } from '../../components/admin-overview-card';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';

type RefundCommandBoardSectionProps = {
  readonly approvalRequired: number;
  readonly approvalHref: string;
  readonly currentReview: string;
  readonly currentSla: string;
  readonly currentSort: string;
  readonly generatedAt: string;
  readonly gatewayProcessing: number;
  readonly gatewayHref: string;
  readonly oldestOpenLabel: string;
  readonly oldestOpenHref: string;
  readonly otherReview: number;
  readonly otherReviewHref: string;
  readonly reconciliationRequired: number;
  readonly reconciliationHref: string;
  readonly refreshHref: string;
  readonly slaOverdue: number;
  readonly slaOverdueHref: string;
};

export function RefundCommandBoardSection({
  approvalRequired,
  approvalHref,
  currentReview,
  currentSla,
  currentSort,
  generatedAt,
  gatewayProcessing,
  gatewayHref,
  oldestOpenLabel,
  oldestOpenHref,
  otherReview,
  otherReviewHref,
  reconciliationRequired,
  reconciliationHref,
  refreshHref,
  slaOverdue,
  slaOverdueHref,
}: RefundCommandBoardSectionProps) {
  const needsAction = approvalRequired + reconciliationRequired + otherReview + slaOverdue > 0;

  return (
    <AdminTablePanel
      className="refund-command-panel"
      description="Exclusive workstreams from the current refund scope. Reconciliation cases are not repeated in approval or gateway counts."
      resultLabel={needsAction ? 'Action required' : 'No urgent action'}
      resultTone={needsAction ? 'warning' : 'success'}
      title="Current refund work"
    >
      <div className="refund-command-layout">
        <div className="refund-command-metric-groups">
          <section aria-label="Refund workstreams" className="refund-command-metric-group">
            <div className="refund-command-metric-heading">
              <strong>Workstreams</strong>
              <small>Exclusive queue counts</small>
            </div>
            <AdminMiniMetricStrip
              ariaLabel="Refund workstream summary"
              className="refund-command-metrics refund-command-workstreams"
              metrics={[
                { ariaCurrent: currentReview === 'requested' ? 'page' : undefined, href: approvalHref, key: 'approval', label: 'Approval required', tone: approvalRequired ? 'warning' : 'neutral', value: approvalRequired },
                { ariaCurrent: currentReview === 'processing' ? 'page' : undefined, href: gatewayHref, key: 'gateway', label: 'Gateway processing', tone: gatewayProcessing ? 'info' : 'neutral', value: gatewayProcessing },
                { ariaCurrent: currentReview === 'state-mismatch' ? 'page' : undefined, href: reconciliationHref, key: 'reconciliation', label: 'Reconciliation required', tone: reconciliationRequired ? 'danger' : 'neutral', value: reconciliationRequired },
                ...(otherReview > 0
                  ? [{
                      ariaCurrent: currentReview === 'other' ? 'page' as const : undefined,
                      href: otherReviewHref,
                      key: 'other-review',
                      label: 'Other review',
                      tone: 'warning' as const,
                      value: otherReview,
                    }]
                  : []),
              ]}
            />
          </section>
          <section aria-label="Refund urgency" className="refund-command-metric-group">
            <div className="refund-command-metric-heading">
              <strong>Urgency</strong>
              <small>SLA overdue overlaps the workstreams above.</small>
            </div>
            <AdminMiniMetricStrip
              ariaLabel="Refund urgency summary"
              className="refund-command-metrics refund-command-urgency"
              metrics={[
                { ariaCurrent: currentReview === 'open' && currentSla === 'overdue' ? 'page' : undefined, href: slaOverdueHref, key: 'overdue', label: 'SLA overdue', tone: slaOverdue ? 'danger' : 'neutral', value: slaOverdue },
                {
                  ariaCurrent: currentReview === 'open' && currentSla === 'all' && currentSort === 'oldest' ? 'page' : undefined,
                  href: oldestOpenHref,
                  key: 'oldest',
                  label: 'Oldest open',
                  value: oldestOpenLabel,
                },
              ]}
            />
          </section>
        </div>
        <div className="refund-command-actions">
          <span className="muted">
            Updated <DateTimeText value={generatedAt} />
          </span>
          <AdminTextLink href={refreshHref}>
            <RefreshCw aria-hidden="true" size={15} />
            Refresh
          </AdminTextLink>
          <AdminTextLink href="/finance-tax/approval-queue?view=refunds">
            Open Approval Queue
          </AdminTextLink>
        </div>
      </div>
    </AdminTablePanel>
  );
}
