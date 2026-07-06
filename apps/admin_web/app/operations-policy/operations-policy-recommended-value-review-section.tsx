import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import type { PolicyRecommendationReview } from './policy-recommendation-review';

type OperationsPolicyRecommendedValueReviewSectionProps = {
  readonly review: PolicyRecommendationReview;
};

export function OperationsPolicyRecommendedValueReviewSection({
  review,
}: OperationsPolicyRecommendedValueReviewSectionProps) {
  const visibleCards = review.cards.filter((card) => card.status !== 'Recommended');

  return (
    <AdminSection
      className="admin-mb-16"
      description="Compares current policy values with the HANDS recommended baseline. Differences are allowed, but operators should know the likely tradeoff before keeping them."
      status={
        <StatusBadge
          tone={statusBadgeToneFromPillClass(review.warningCount ? 'pill-warn' : 'pill-success')}
        >
          {review.warningCount ? `${review.warningCount} owner choice(s)` : 'Aligned'}
        </StatusBadge>
      }
      title="Recommended value review"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={review.summary.map((item) => ({
          detail: item.helper,
          label: item.label,
          value: item.value,
        }))}
      />
      <AdminTaskGrid className="admin-mt-14">
        {visibleCards.map((card) => (
          <AdminTaskCard
            actionLabel={card.operatorAction}
            className={card.className}
            detail={card.detail}
            key={card.key}
            leading={<StatusBadge tone={statusBadgeToneFromPillClass(card.pillClass)}>{card.status}</StatusBadge>}
            title={card.label}
          />
        ))}
        {visibleCards.length === 0 ? (
          <AdminTaskCard
            actionLabel="Review this again before changing live matching or booking gates."
            className="ops-task-done"
            detail="Current policy values match the recommended baseline for the loaded review set."
            leading={<StatusBadge tone="success">Aligned</StatusBadge>}
            title="Recommended values are aligned"
          />
        ) : null}
      </AdminTaskGrid>
    </AdminSection>
  );
}
