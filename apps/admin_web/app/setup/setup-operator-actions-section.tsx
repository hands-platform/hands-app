import { CommandCopyRow } from '../../components/command-copy-row';

type SetupOperatorAction = {
  readonly groupId: string;
  readonly name: string;
  readonly phase: string;
  readonly action: string;
  readonly commands: readonly string[];
};

type SetupOperatorActionsSectionProps = {
  readonly nextActions: readonly SetupOperatorAction[];
  readonly deferredActions: readonly SetupOperatorAction[];
};

export function SetupOperatorActionsSection({
  nextActions,
  deferredActions,
}: SetupOperatorActionsSectionProps) {
  return (
    <div className="card" id="live-readiness">
      <div className="ops-section-header">
        <div>
          <h2>Next operator actions</h2>
          <p className="muted">
            These are the highest-priority human setup steps. Code checks can keep passing while these external
            values are pending.
          </p>
        </div>
        <span className={`signal ${nextActions.length === 0 ? 'signal-ok' : 'signal-warn'}`}>
          {nextActions.length === 0 ? 'No pending actions' : `${nextActions.length} pending`}
        </span>
      </div>
      <div className="setup-action-list">
        {nextActions.slice(0, 6).map((item) => (
          <a className="setup-action-item" href={`#${item.groupId}`} key={`${item.groupId}-${item.name}`}>
            <span>{item.phase}</span>
            <strong>{item.name}</strong>
            <p className="muted">{item.action}</p>
            {item.commands.length > 0 && (
              <div className="setup-command-list admin-mt-8">
                {item.commands.slice(0, 2).map((command) => (
                  <code key={`${item.groupId}-${item.name}-${command}`}>{command}</code>
                ))}
              </div>
            )}
          </a>
        ))}
        {nextActions.length === 0 && (
          <p className="muted">
            All current-stage setup actions are clear. Deferred production integrations stay tracked
            separately.
          </p>
        )}
      </div>
      {deferredActions.length > 0 && (
        <div className="setup-command-block admin-mt-16">
          <h3>Deferred production setup</h3>
          <p className="muted">
            These are intentionally parked until the right E2E pass, so they should not interrupt current
            product development.
          </p>
          <div className="setup-command-list">
            {deferredActions.slice(0, 6).map((item) => (
              <CommandCopyRow command={deferredActionCommand(item)} key={`${item.groupId}-${item.name}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function deferredActionCommand(item: SetupOperatorAction) {
  return `${item.name}: ${item.action}${item.commands.length > 0 ? ` Verify: ${item.commands[0]}` : ''}`;
}
