import type { PolicyEnforcementTraceItem } from './policy-enforcement-trace';

type OperationsPolicyEnforcementTraceSectionProps = {
  readonly trace: readonly PolicyEnforcementTraceItem[];
};

export function OperationsPolicyEnforcementTraceSection({
  trace,
}: OperationsPolicyEnforcementTraceSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Policy enforcement trace</h2>
          <p className="muted">
            Shows where each operating decision is enforced today, so operators know whether a policy change
            affects customer matching, Partner acceptance, notifications, or finance gates.
          </p>
        </div>
        <span className="pill pill-info">{trace.length} enforced lane(s)</span>
      </div>
      <div className="ops-task-grid admin-mt-14">
        {trace.map((item) => (
          <div className="ops-task-card ops-task-done" key={item.title}>
            <span className="pill pill-success">{item.scope}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <small>{`API touchpoint: ${item.api}`}</small>
            <small>{`Server owner: ${item.server}`}</small>
            <small>{item.verify}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
