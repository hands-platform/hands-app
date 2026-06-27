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
  readonly backlogLimit?: number;
};

export function SetupExternalBacklogSection({
  missingCount,
  backlog,
  backlogLimit,
}: SetupExternalBacklogSectionProps) {
  const visibleBacklog =
    typeof backlogLimit === 'number' && backlogLimit > 0 ? backlog.slice(0, backlogLimit) : backlog;
  const hiddenCount = Math.max(0, backlog.length - visibleBacklog.length);

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
        {visibleBacklog.map((item) => (
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
        {hiddenCount > 0 ? (
          <div className="setup-backlog-item setup-backlog-summary">
            <span>Compact setup view</span>
            <strong>
              {hiddenCount} more setup {hiddenCount === 1 ? 'item is' : 'items are'} hidden from the default
              view.
            </strong>
            <p className="muted">
              Open full setup details only when actively working the external checklist.
            </p>
            <a className="button button-secondary setup-card-action" href="/setup?details=all">
              <ArrowRight size={16} aria-hidden="true" />
              Show all setup details
            </a>
          </div>
        ) : null}
        {backlog.length === 0 && (
          <p className="muted">All external readiness values are configured for the current environment.</p>
        )}
      </div>
    </section>
  );
}
