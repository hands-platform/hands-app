type SetupExternalBacklogItem = {
  readonly groupId: string;
  readonly groupTitle: string;
  readonly name: string;
  readonly reason: string;
};

type SetupExternalBacklogSectionProps = {
  readonly missingCount: number;
  readonly backlog: readonly SetupExternalBacklogItem[];
};

export function SetupExternalBacklogSection({ missingCount, backlog }: SetupExternalBacklogSectionProps) {
  return (
    <section className="card admin-mt-16">
      <div className="ops-section-header">
        <div>
          <h2>What still needs external registration</h2>
          <p className="muted">
            This is the human-action backlog. Code checks stay green while these production keys are not
            filled.
          </p>
        </div>
        <span className={`signal ${missingCount === 0 ? 'signal-ok' : 'signal-warn'}`}>
          {missingCount === 0 ? 'No missing values' : `${missingCount} value(s) pending`}
        </span>
      </div>
      <div className="setup-backlog">
        {backlog.map((item) => (
          <a className="setup-backlog-item" href={`#${item.groupId}`} key={`${item.groupId}-${item.name}`}>
            <span>{item.groupTitle}</span>
            <strong>{item.name}</strong>
            <p className="muted">{item.reason}</p>
          </a>
        ))}
        {backlog.length === 0 && (
          <p className="muted">All external readiness values are configured for the current environment.</p>
        )}
      </div>
    </section>
  );
}
