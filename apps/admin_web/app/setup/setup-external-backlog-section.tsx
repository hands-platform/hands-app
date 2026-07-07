import { ArrowRight } from 'lucide-react';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSection } from '../../components/admin-surface';
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
  readonly showCommands?: boolean;
};

export function SetupExternalBacklogSection({
  missingCount,
  backlog,
  backlogLimit,
  showCommands = true,
}: SetupExternalBacklogSectionProps) {
  const visibleBacklog =
    typeof backlogLimit === 'number' && backlogLimit > 0 ? backlog.slice(0, backlogLimit) : backlog;
  const hiddenCount = Math.max(0, backlog.length - visibleBacklog.length);
  const statusLabel = missingCount === 0 ? 'No missing values' : `${missingCount} value(s) pending`;
  const statusTone = missingCount === 0 ? 'success' : 'warning';

  return (
    <AdminSection
      bodyClassName="setup-backlog"
      className="admin-mt-16"
      description="This is the human-action backlog. Code checks stay green while these production keys are not filled."
      statusLabel={statusLabel}
      statusTone={statusTone}
      title="What still needs external registration"
    >
        {visibleBacklog.map((item) => (
          <div className="setup-backlog-item" key={`${item.groupId}-${item.name}`}>
            <span>{item.groupTitle}</span>
            <strong>{item.name}</strong>
            <p className="muted">{item.reason}</p>
            <AdminFormControlLink className="button-secondary setup-card-action" href={`#${item.groupId}`}>
              <ArrowRight size={16} aria-hidden="true" />
              Open setup group
            </AdminFormControlLink>
            {showCommands && item.commands && item.commands.length > 0 && (
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
            <AdminFormControlLink className="button-secondary setup-card-action" href="/setup?details=all">
              <ArrowRight size={16} aria-hidden="true" />
              Show all setup details
            </AdminFormControlLink>
          </div>
        ) : null}
        {backlog.length === 0 && (
          <p className="muted">All external readiness values are configured for the current environment.</p>
        )}
    </AdminSection>
  );
}
