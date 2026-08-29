import { Users } from 'lucide-react';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSectionHeader } from '../../components/admin-page-template';
import {
  AdminSection,
  AdminTaskCard,
  AdminTaskGrid,
  type MetricCardKind,
} from '../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { policyCountLabel } from './policy-copy';

type FinalPartnerChoiceMatrix = {
  readonly blockingCount: number;
  readonly sampledPartnerCount: number;
  readonly summary: readonly { readonly label: string; readonly value: string; readonly helper: string }[];
  readonly cards: readonly {
    readonly title: string;
    readonly status: string;
    readonly detail: string;
    readonly operatorAction: string;
    readonly className: string;
    readonly pillClass: string;
  }[];
  readonly impact: readonly {
    readonly helper: string;
    readonly kind: MetricCardKind;
    readonly label: string;
    readonly scope: string;
    readonly value: string;
  }[];
};

type OperationsPolicyFinalPartnerChoiceSectionProps = {
  readonly canOpenPartnerEvidence?: boolean;
  readonly matrix: FinalPartnerChoiceMatrix;
};

export function OperationsPolicyFinalPartnerChoiceSection({
  canOpenPartnerEvidence = true,
  matrix,
}: OperationsPolicyFinalPartnerChoiceSectionProps) {
  const matchingImpact = matrix.impact.filter(
    (item) => item.label !== 'Bank review' && Number(item.value) > 0,
  );
  return (
    <AdminSection
      className="admin-mb-16"
      description="Current owner choices for the direct booking window, marketplace participation, Partner push reach, and the negative wallet marketplace/payout gate. This is the screen operators should check before changing the mobile flow."
      statusLabel={policyCountLabel(matrix.blockingCount, 'policy deviation')}
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
        actions={canOpenPartnerEvidence ? (
          <AdminFormControlLink className="button-secondary" href="/partners">
            <Users size={16} aria-hidden="true" />
            Open Partner queue
          </AdminFormControlLink>
        ) : null}
        className="admin-mt-18"
        description={`Applies the policy posture to ${policyCountLabel(matrix.sampledPartnerCount, 'sampled Partner')}. Blocker categories overlap, so do not total these cards.`}
        title="Current partner acceptance impact"
      />
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={matchingImpact.map((item) => ({
          detail: item.helper,
          kind: item.kind,
          label: item.label,
          scope: item.scope,
          value: item.value,
        }))}
      />
      {canOpenPartnerEvidence ? (
        <p className="muted admin-mt-10">
          Withdrawal bank evidence stays in{' '}
          <AdminFormControlLink className="policy-inline-action" href="/partner-controls?details=controls&review=bank">
            Partner Controls
          </AdminFormControlLink>.
        </p>
      ) : null}
    </AdminSection>
  );
}
