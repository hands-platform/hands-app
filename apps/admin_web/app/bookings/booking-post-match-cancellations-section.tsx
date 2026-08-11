import { AdminFilterSummary } from '../../components/admin-filter-summary';
import type { AdminPostMatchCancellationOperationsSummary } from '../../lib/admin-api';

export type BookingPostMatchCancellationBoardProps = {
  readonly periodLabel: string;
  readonly summary?: AdminPostMatchCancellationOperationsSummary;
};

export function BookingPostMatchCancellationBoard({
  periodLabel,
  summary,
}: BookingPostMatchCancellationBoardProps) {
  if (!summary?.generatedAt) return null;

  return (
    <div aria-label="Post-match cancellation workload summary" className="booking-post-match-scope-summary">
      <div>
        <strong>Open workload · Overall</strong>
        <AdminFilterSummary
          ariaLabel="Overall open cancellation workload"
          labels={[
            `Needs decision: ${summary.needsDecisionCount}`,
            `Overdue: ${summary.overdueOpenCount}`,
            `No-show: ${summary.noShowReviewCount}`,
          ]}
          tone={summary.needsDecisionCount > 0 ? 'warning' : 'success'}
        />
      </div>
      <div>
        <strong>Resolved · {periodLabel}</strong>
        <AdminFilterSummary
          ariaLabel={`Resolved cancellations · ${periodLabel}`}
          labels={[
            `Total: ${summary.resolvedCount}`,
            `Auto-approved · fee waived: ${summary.autoResolvedCount}`,
            `Admin approved · fee waived: ${summary.adminApprovedCount}`,
            `Fee kept: ${summary.adminHeldCount}`,
            `Legacy: ${summary.unknownLegacyCount}`,
          ]}
          tone="neutral"
        />
      </div>
    </div>
  );
}
