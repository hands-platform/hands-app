import { ExternalLink } from 'lucide-react';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSectionHeader } from '../../components/admin-page-template';
import {
  AdminActionCard,
  AdminInsightCard,
  AdminNotePanel,
  AdminSection,
  AdminTaskCard,
} from '../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
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
      <AdminNotePanel className="admin-mt-14">
        <AdminSectionHeader
          actions={(
            <StatusBadge
              tone={statusBadgeToneFromPillClass(pressure.alertCount ? 'pill-warn' : 'pill-success')}
            >
              {pressure.alertCount} active record(s)
            </StatusBadge>
          )}
          description="Data-driven records that tell the owner which policy choice deserves attention first. This keeps HANDS from changing flow rules without matching, supply, wallet, or push evidence."
          title="Current decision pressure"
        />
        <AdminTraceSummary
          className="admin-mt-12"
          metrics={pressure.summary.map((item) => ({
            detail: item.helper,
            label: item.label,
            value: item.value,
          }))}
        />
        <div className="ops-task-grid admin-mt-14">
          {pressure.cards.map((item) => (
            <AdminActionCard
              actionLabel={item.operatorAction}
              className={item.className}
              detail={item.detail}
              href={item.href}
              key={item.title}
              leading={<StatusBadge tone={statusBadgeToneFromPillClass(item.pillClass)}>{item.status}</StatusBadge>}
              title={item.title}
              variant="ops-task"
            />
          ))}
        </div>
      </AdminNotePanel>
      <div className="ops-task-grid admin-mt-14">
        {backlog.map((item) => (
          <AdminTaskCard
            actionLabel={item.evidence}
            className={item.className}
            detail={item.question}
            key={item.title}
            leading={<StatusBadge tone={statusBadgeToneFromPillClass(item.pillClass)}>{item.owner}</StatusBadge>}
            title={item.title}
          >
            <div className="booking-radar admin-mt-12">
              {item.options.map((option) => (
                <AdminInsightCard key={option.label}>
                  <strong>{displayOperationalWording(option.label)}</strong>
                  <p className="muted">{displayOperationalWording(option.tradeoff)}</p>
                </AdminInsightCard>
              ))}
            </div>
            <AdminNotePanel className="admin-mt-12">
              <strong>Recommended direction</strong>
              <p className="muted">{item.recommendation}</p>
              <strong>Decision trigger</strong>
              <p className="muted">{item.decisionTrigger}</p>
              <AdminFormControlLink className="button-secondary policy-inline-action" href={item.href}>
                <ExternalLink size={14} aria-hidden="true" />
                Review data
              </AdminFormControlLink>
            </AdminNotePanel>
          </AdminTaskCard>
        ))}
      </div>
    </AdminSection>
  );
}
