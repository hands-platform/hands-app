import { Users } from 'lucide-react';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminSection, AdminTaskCard } from '../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';

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
      <div className="service-trace-summary admin-mt-12">
        {matrix.summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-grid admin-mt-14">
        {matrix.cards.map((card) => (
          <AdminTaskCard
            actionLabel={card.operatorAction}
            className={card.className}
            detail={card.detail}
            key={card.title}
            leading={<StatusBadge tone={statusBadgeToneFromPillClass(card.pillClass)}>{card.status}</StatusBadge>}
            title={card.title}
          />
        ))}
      </div>
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
      <div className="service-trace-summary admin-mt-12">
        {matrix.impact.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}
