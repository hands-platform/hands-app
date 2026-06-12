type SetupRegistrationHandoffItem = {
  readonly id: string;
  readonly provider: string;
  readonly title: string;
  readonly detail: string;
  readonly groupId: string;
  readonly status: string;
  readonly statusClass: string;
  readonly owner: string;
  readonly env: readonly string[];
};

type SetupRegistrationHandoffSectionProps = {
  readonly registrationPlan: readonly SetupRegistrationHandoffItem[];
};

export function SetupRegistrationHandoffSection({
  registrationPlan,
}: SetupRegistrationHandoffSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>External registration handoff</h2>
          <p className="muted">
            Account ownership, service consoles, and credential status in one place. Secret values are never
            printed here; this page only shows whether each integration is ready, deferred, or needs a human
            setup step.
          </p>
        </div>
        <span className="signal signal-info">{registrationPlan.length} services tracked</span>
      </div>
      <div className="setup-backlog">
        {registrationPlan.map((item) => (
          <a className="setup-backlog-item" href={`#${item.groupId}`} key={item.id}>
            <span>{item.provider}</span>
            <strong>{item.title}</strong>
            <p className="muted">{item.detail}</p>
            <div className="participant-list">
              <span className={`pill ${item.statusClass}`}>{item.status}</span>
              <span className="pill pill-neutral">{item.owner}</span>
            </div>
            <div className="participant-list admin-mt-8">
              {item.env.map((name) => (
                <span className="pill pill-info" key={`${item.id}-${name}`}>
                  {name}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
