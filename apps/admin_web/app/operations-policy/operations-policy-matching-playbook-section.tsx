import type { MatchingPlaybookItem } from './matching-playbook';

type OperationsPolicyMatchingPlaybookSectionProps = {
  readonly playbook: readonly MatchingPlaybookItem[];
};

export function OperationsPolicyMatchingPlaybookSection({
  playbook,
}: OperationsPolicyMatchingPlaybookSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Booking matching playbook</h2>
          <p className="muted">
            Current operator-facing flow based on the saved policy values. Use this to verify whether the
            customer, Partner, finance, and alert behavior still matches the intended operation.
          </p>
        </div>
        <span className="pill pill-info">Policy driven</span>
      </div>
      <div className="timeline admin-mt-12">
        {playbook.map((step) => (
          <div className={`timeline-step ${step.className}`} key={step.title}>
            <span>{step.step}</span>
            <strong>{step.title}</strong>
            <p>{step.detail}</p>
            <div className="participant-list">
              {step.tags.map((tag) => (
                <span className={`pill ${tag.tone}`} key={`${step.title}-${tag.label}`}>
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
