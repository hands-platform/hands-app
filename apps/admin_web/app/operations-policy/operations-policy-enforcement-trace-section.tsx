import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

import type { PolicyEnforcementTraceItem } from './policy-enforcement-trace';

type OperationsPolicyEnforcementTraceSectionProps = {
  readonly trace: readonly PolicyEnforcementTraceItem[];
};

export function OperationsPolicyEnforcementTraceSection({
  trace,
}: OperationsPolicyEnforcementTraceSectionProps) {
  return (
    <AdminSection
      className="admin-mb-16"
      description="Shows where each operating decision is enforced today, so operators know whether a policy change affects customer matching, Partner acceptance, notifications, or finance gates."
      statusLabel={`${trace.length} enforced lane(s)`}
      statusTone="info"
      title="Policy enforcement evidence"
    >
      <AdminTaskGrid className="admin-mt-14">
        {trace.map((item) => (
          <AdminTaskCard
            className="ops-task-done"
            detail={item.detail}
            key={item.title}
            leading={<StatusBadge tone="success">{item.scope}</StatusBadge>}
            title={item.title}
          >
            <small>{`API touchpoint: ${item.api}`}</small>
            <small>{`Server owner: ${item.server}`}</small>
            <small>{item.verify}</small>
          </AdminTaskCard>
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}
