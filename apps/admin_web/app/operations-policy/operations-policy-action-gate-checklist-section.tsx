import { AdminTraceSummary } from '../../components/admin-overview-card';
import {
  AdminActionCard,
  AdminSection,
  AdminTaskCard,
  AdminTaskGrid,
} from '../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import type { ActionGatePolicyChecklist } from './action-gate-policy-checklist';

type OperationsPolicyActionGateChecklistSectionProps = {
  readonly checklist: ActionGatePolicyChecklist;
};

export function OperationsPolicyActionGateChecklistSection({
  checklist,
}: OperationsPolicyActionGateChecklistSectionProps) {
  const allRecommended = checklist.alignedCount === checklist.totalCount;
  const visibleCards = checklist.cards.filter((item) => item.status !== 'Recommended');

  return (
    <AdminSection
      className="admin-mb-16"
      description="These admin-editable policies explain which evidence operators should check before booking capture, release, cash-fee clearance, first-pick expiry, no-show closeout, and completed closeout actions."
      id="action-gate-policy-checklist"
      status={
        <StatusBadge tone={allRecommended ? 'success' : 'warning'}>
          {checklist.alignedCount}/{checklist.totalCount} recommended
        </StatusBadge>
      }
      title="Action gate policy checklist"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={checklist.summary.map((item) => ({
          detail: item.helper,
          label: item.label,
          value: item.value,
        }))}
      />
      <AdminTaskGrid className="admin-mt-14">
        {visibleCards.map((item) => (
          <AdminActionCard
            actionLabel={item.operatorAction}
            className={item.className}
            detail={item.detail}
            href={item.href}
            key={item.title}
            leading={
              <StatusBadge tone={statusBadgeToneFromPillClass(item.pillClass)}>{item.status}</StatusBadge>
            }
            title={item.title}
            variant="ops-task"
          >
            <small>Current: {item.current}</small>
          </AdminActionCard>
        ))}
        {visibleCards.length === 0 ? (
          <AdminTaskCard
            actionLabel="Keep using booking detail evidence before irreversible operator decisions."
            className="ops-task-done"
            detail="Booking, cash, payout, first-pick, and no-show evidence gates follow the recommended baseline."
            leading={<StatusBadge tone="success">Clear</StatusBadge>}
            title="Action gate policies are aligned"
          />
        ) : null}
      </AdminTaskGrid>
    </AdminSection>
  );
}
