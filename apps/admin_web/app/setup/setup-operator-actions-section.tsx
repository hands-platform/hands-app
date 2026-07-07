import { ArrowRight } from 'lucide-react';
import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { CommandCopyRow } from '../../components/command-copy-row';
import { AdminSignal, StatusBadgeLink } from '../../components/status-badge';

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
  readonly showCommandDetails?: boolean;
};

export function SetupOperatorActionsSection({
  nextActions,
  deferredActions,
  showCommandDetails = true,
}: SetupOperatorActionsSectionProps) {
  return (
    <AdminSection
      actions={
        <AdminSignal tone={nextActions.length === 0 ? 'ok' : 'warn'}>
          {nextActions.length === 0 ? 'No pending actions' : `${nextActions.length} pending`}
        </AdminSignal>
      }
      description="These are the highest-priority human setup steps. Code checks can keep passing while these external values are pending."
      id="live-readiness"
      title="Next operator actions"
    >
      <div className="setup-action-list">
        {nextActions.slice(0, 6).map((item) => (
          <AdminActionCard
            actionLabel={
              <>
                <ArrowRight size={16} aria-hidden="true" />
                Open setup group
              </>
            }
            actionLabelClassName="button button-secondary setup-card-action"
            className="setup-action-item"
            detail={item.action}
            href={`#${item.groupId}`}
            key={`${item.groupId}-${item.name}`}
            leading={<span>{item.phase}</span>}
            title={item.name}
            variant="ops-task"
          >
            {showCommandDetails && item.commands.length > 0 && (
              <div className="setup-command-list admin-mt-8">
                {item.commands.slice(0, 2).map((command) => (
                  <code key={`${item.groupId}-${item.name}-${command}`}>{command}</code>
                ))}
              </div>
            )}
          </AdminActionCard>
        ))}
        {nextActions.length === 0 && (
          <p className="muted">
            All current-stage setup actions are clear. Deferred production integrations stay tracked
            separately.
          </p>
        )}
      </div>
      {deferredActions.length > 0 && showCommandDetails ? (
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
      ) : null}
      {deferredActions.length > 0 && !showCommandDetails ? (
        <div className="setup-command-block admin-mt-16">
          <h3>Deferred production setup</h3>
          <p className="muted">
            Deferred command packs are kept out of the default setup payload. Open the full setup view when
            actively working external registration.
          </p>
          <StatusBadgeLink tone="neutral" href="/setup?details=all">
            Show command details
          </StatusBadgeLink>
        </div>
      ) : null}
    </AdminSection>
  );
}

function deferredActionCommand(item: SetupOperatorAction) {
  return `${item.name}: ${item.action}${item.commands.length > 0 ? ` Verify: ${item.commands[0]}` : ''}`;
}
