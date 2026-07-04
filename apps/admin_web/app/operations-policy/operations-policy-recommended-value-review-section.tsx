import { AdminSection, AdminTaskCard } from '../../components/admin-surface';
import { PillClassBadge, StatusBadge } from '../../components/status-badge';
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
        <PillClassBadge pillClass={review.warningCount ? 'pill-warn' : 'pill-success'}>
          {review.warningCount ? `${review.warningCount} owner choice(s)` : 'Aligned'}
        </PillClassBadge>
      }
      title="Recommended value review"
    >
      <div className="service-trace-summary admin-mt-12">
        {review.summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-grid admin-mt-14">
        {visibleCards.map((card) => (
          <AdminTaskCard
            actionLabel={card.operatorAction}
            className={card.className}
            detail={card.detail}
            key={card.key}
            leading={<PillClassBadge pillClass={card.pillClass}>{card.status}</PillClassBadge>}
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
      </div>
    </AdminSection>
  );
}
