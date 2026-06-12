export type SetupGroupDetail = {
  readonly id: string;
  readonly title: string;
  readonly phase: string;
  readonly operatorAction: string;
  readonly purpose: string;
  readonly status: string;
  readonly statusClass: string;
  readonly envPills: readonly {
    readonly name: string;
    readonly className: string;
  }[];
  readonly notes: readonly string[];
  readonly exitCriteria: string;
  readonly commands: readonly string[];
};

type SetupGroupDetailSectionProps = {
  readonly groups: readonly SetupGroupDetail[];
};

export function SetupGroupDetailSection({ groups }: SetupGroupDetailSectionProps) {
  return (
    <section className="stack admin-mt-16">
      {groups.map((group) => (
        <div className="card" id={group.id} key={group.id}>
          <div className="ops-section-header">
            <div>
              <h2>{group.title}</h2>
              <p className="muted">
                <strong>{group.phase}:</strong> {group.operatorAction}
              </p>
              <p className="muted">{group.purpose}</p>
            </div>
            <span className={group.statusClass}>{group.status}</span>
          </div>
          <div className="detail-grid admin-mt-12">
            <div>
              <h3>Environment values</h3>
              <div className="participant-list">
                {group.envPills.map((env) => (
                  <span className={env.className} key={env.name}>
                    {env.name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3>Implementation notes</h3>
              <ul className="muted">
                {group.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p className="muted">
                <strong>Exit criteria:</strong> {group.exitCriteria}
              </p>
            </div>
          </div>
          <div className="setup-command-block">
            <h3>Verification commands</h3>
            <p className="muted">
              Run from <code>C:\dev\massage-vn-workspace\repo</code>. Values inside angle brackets must be
              replaced locally.
            </p>
            <div className="setup-command-list">
              {group.commands.map((command) => (
                <code key={command}>{command}</code>
              ))}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
