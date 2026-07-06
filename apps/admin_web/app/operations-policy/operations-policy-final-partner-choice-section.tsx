import { Users } from 'lucide-react';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../components/status-badge';

type FinalPartnerChoiceMatrix = {
  readonly blockingCount: number;
  readonly summary: readonly { readonly label: string; readonly value: string; readonly helper: string }[];
  readonly cards: readonly {
    readonly title: string;
    readonly status: string;
    readonly detail: string;
    readonly operatorAction: string;
    readonly className: string;
    readonly pillClass: string;
  }[];
  readonly impact: readonly { readonly label: string; readonly value: string; readonly helper: string }[];
};

type OperationsPolicyFinalPartnerChoiceSectionProps = {
  readonly matrix: FinalPartnerChoiceMatrix;
};

export function OperationsPolicyFinalPartnerChoiceSection({
  matrix,
}: OperationsPolicyFinalPartnerChoiceSectionProps) {
  return (
    <AdminSection
      className="admin-mb-16"
      description="Current owner choices for the direct booking window, marketplace participation, Partner push reach, and the negative wallet marketplace/payout gate. This is the screen operators should check before changing the mobile flow."
      statusLabel={`${matrix.blockingCount} control choice(s)`}
      statusTone={matrix.blockingCount ? 'warning' : 'success'}
      title="Final partner choice control matrix"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={matrix.summary.map((item) => ({
          detail: item.helper,
          label: item.label,
          value: item.value,
        }))}
      />
      <AdminTaskGrid className="admin-mt-14">
        {matrix.cards.map((card) => (
          <AdminTaskCard
            actionLabel={card.operatorAction}
            className={card.className}
            detail={card.detail}
            key={card.title}
            leading={<StatusBadgeFromPillClass pillClass={card.pillClass}>{card.status}</StatusBadgeFromPillClass>}
            title={card.title}
          />
        ))}
      </AdminTaskGrid>
      <AdminSectionHeader
        actions={(
          <AdminFormControlLink className="button-secondary" href="/partners">
            <Users size={16} aria-hidden="true" />
            Open Partner queue
          </AdminFormControlLink>
        )}
        className="admin-mt-18"
        description="Applies the policy posture to the current Partner snapshot so operators can see who can pass marketplace and payout gates, who needs account or identity follow-up, and who only needs readiness follow-up."
        title="Current partner acceptance impact"
      />
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={matrix.impact.map((item) => ({
          detail: item.helper,
          label: item.label,
          value: item.value,
        }))}
      />
    </AdminSection>
  );
}
