import { ArrowRight } from 'lucide-react';
import { CommandCopyRow } from '../../components/command-copy-row';

type SetupExternalBacklogItem = {
  readonly groupId: string;
  readonly groupTitle: string;
  readonly name: string;
  readonly reason: string;
  readonly commands?: readonly string[];
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
          <div className="setup-backlog-item" key={`${item.groupId}-${item.name}`}>
            <span>{item.groupTitle}</span>
            <strong>{item.name}</strong>
            <p className="muted">{item.reason}</p>
            <a className="button button-secondary setup-card-action" href={`#${item.groupId}`}>
              <ArrowRight size={16} aria-hidden="true" />
              Open setup group
            </a>
            {item.commands && item.commands.length > 0 && (
              <div className="setup-command-list admin-mt-8">
                {item.commands.slice(0, 2).map((command) => (
                  <CommandCopyRow command={command} key={`${item.groupId}-${item.name}-${command}`} />
                ))}
              </div>
            )}
          </div>
        ))}
        {backlog.length === 0 && (
          <p className="muted">All external readiness values are configured for the current environment.</p>
        )}
      </div>
    </section>
  );
}
