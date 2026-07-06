import { AdminSection } from '../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import type { MatchingPlaybookItem } from './matching-playbook';

type OperationsPolicyMatchingPlaybookSectionProps = {
  readonly playbook: readonly MatchingPlaybookItem[];
};

export function OperationsPolicyMatchingPlaybookSection({
  playbook,
}: OperationsPolicyMatchingPlaybookSectionProps) {
  return (
    <AdminSection
      bodyClassName="timeline admin-mt-12"
      className="admin-mb-16"
      description="Current operator-facing flow based on the saved policy values. Use this to verify whether the customer, Partner, finance, and alert behavior still matches the intended operation."
      statusLabel="Policy driven"
      statusTone="info"
      title="Booking matching playbook"
    >
      {playbook.map((step) => (
        <div className={`timeline-step ${step.className}`} key={step.title}>
          <span>{step.step}</span>
          <strong>{step.title}</strong>
          <p>{step.detail}</p>
          <div className="participant-list">
            {step.tags.map((tag) => (
              <StatusBadgeFromPillClass pillClass={tag.tone} key={`${step.title}-${tag.label}`}>
                {tag.label}
              </StatusBadgeFromPillClass>
            ))}
          </div>
        </div>
      ))}
    </AdminSection>
  );
}
