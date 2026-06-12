type SetupMigrationRunwayStatus = {
  readonly id: string;
  readonly title: string;
  readonly phase: string;
  readonly status: string;
};

type SetupMigrationRunwaySectionProps = {
  readonly groupStatuses: readonly SetupMigrationRunwayStatus[];
};

export function SetupMigrationRunwaySection({ groupStatuses }: SetupMigrationRunwaySectionProps) {
  return (
    <div className="card">
      <h2>Migration runway</h2>
      <p className="muted">
        HANDS is moving from local MVP stability to Supabase-backed staging without breaking the mobile booking
        flow. Current local auth remains Nest/dev OTP until production Phone Auth is deliberately tested.
      </p>
      <div className="setup-stage-list">
        {groupStatuses.map((item, index) => (
          <a className="setup-stage-item" href={`#${item.id}`} key={item.id}>
            <span>Stage {index + 1}</span>
            <strong>{item.phase}</strong>
            <p>{item.title}</p>
            <small>{item.status}</small>
          </a>
        ))}
      </div>
      <div className="setup-command-block admin-mt-16">
        <h3>Operator handoff files</h3>
        <p className="muted">
          Use these files when filling external console values. They stay in the repo path under
          <code>C:\dev\massage-vn-workspace\repo</code>.
        </p>
        <div className="setup-command-list">
          <code>docs\architecture\operator-registration-plan.md</code>
          <code>docs\architecture\master-progress-roadmap.md</code>
          <code>infra\setup\.generated\hands-external-registration-pack.md</code>
          <code>infra\supabase\.generated\hands-staging-setup.sql</code>
        </div>
      </div>
    </div>
  );
}
