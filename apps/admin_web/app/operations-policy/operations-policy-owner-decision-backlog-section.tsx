import { ExternalLink } from 'lucide-react';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminActionCard, AdminCard, AdminSection, AdminTaskCard } from '../../components/admin-surface';
import { PillClassBadge } from '../../components/status-badge';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import type { OwnerDecisionBacklogItem } from './owner-decision-backlog';
import type { OwnerDecisionPressure } from './owner-decision-pressure';

type OperationsPolicyOwnerDecisionBacklogSectionProps = {
  readonly pressure: OwnerDecisionPressure;
  readonly backlog: readonly OwnerDecisionBacklogItem[];
};

export function OperationsPolicyOwnerDecisionBacklogSection({
  pressure,
  backlog,
}: OperationsPolicyOwnerDecisionBacklogSectionProps) {
  return (
    <AdminSection
      className="admin-mt-16"
      description="Product and operations choices that should be reviewed before HANDS turns each policy into stricter automation. Keep the decision in Admin first, then automate after real operating data."
      statusLabel="Review weekly"
      statusTone="info"
      title="Owner decision backlog"
    >
      <div className="ops-task-note admin-mt-14">
        <div className="ops-section-header">
          <div>
            <h3>Current decision pressure</h3>
            <p className="muted">
              Data-driven records that tell the owner which policy choice deserves attention first. This
              keeps HANDS from changing flow rules without matching, supply, wallet, or push evidence.
            </p>
          </div>
          <PillClassBadge pillClass={pressure.alertCount ? 'pill-warn' : 'pill-success'}>
            {pressure.alertCount} active record(s)
          </PillClassBadge>
        </div>
        <div className="service-trace-summary admin-mt-12">
          {pressure.summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-grid admin-mt-14">
          {pressure.cards.map((item) => (
            <AdminActionCard
              actionLabel={item.operatorAction}
              className={item.className}
              detail={item.detail}
              href={item.href}
              key={item.title}
              leading={<PillClassBadge pillClass={item.pillClass}>{item.status}</PillClassBadge>}
              title={item.title}
              variant="ops-task"
            />
          ))}
        </div>
      </div>
      <div className="ops-task-grid admin-mt-14">
        {backlog.map((item) => (
          <AdminTaskCard
            actionLabel={item.evidence}
            className={item.className}
            detail={item.question}
            key={item.title}
            leading={<PillClassBadge pillClass={item.pillClass}>{item.owner}</PillClassBadge>}
            title={item.title}
          >
            <div className="booking-radar admin-mt-12">
              {item.options.map((option) => (
                <AdminCard className="insight-card" key={option.label}>
                  <strong>{displayOperationalWording(option.label)}</strong>
                  <p className="muted">{displayOperationalWording(option.tradeoff)}</p>
                </AdminCard>
              ))}
            </div>
            <div className="ops-task-note admin-mt-12">
              <strong>Recommended direction</strong>
              <p className="muted">{item.recommendation}</p>
              <strong>Decision trigger</strong>
              <p className="muted">{item.decisionTrigger}</p>
              <AdminFormControlLink className="button-secondary policy-inline-action" href={item.href}>
                <ExternalLink size={14} aria-hidden="true" />
                Review data
              </AdminFormControlLink>
            </div>
          </AdminTaskCard>
        ))}
      </div>
    </AdminSection>
  );
}
