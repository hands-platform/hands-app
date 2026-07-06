import { CommandCopyRow } from '../../components/command-copy-row';
import { AdminDetailGrid, AdminSection } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass, StatusBadgeLink } from '../../components/status-badge';
import { nextSetupCommand, setupCommandGroups } from './setup-command-groups';

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
  readonly commandMode?: 'full' | 'summary';
  readonly groups: readonly SetupGroupDetail[];
};

export function SetupGroupDetailSection({ commandMode = 'full', groups }: SetupGroupDetailSectionProps) {
  return (
    <div className="stack admin-mt-16">
      {groups.map((group) => {
        const attentionEnvPills = group.envPills.filter(isAttentionEnvPill);
        const nextCommand = nextSetupCommand(group.id, group.commands);

        return (
          <AdminSection
            actions={
              <StatusBadgeFromPillClass pillClass={group.statusClass}>{group.status}</StatusBadgeFromPillClass>
            }
            description={
              <>
                <strong>{group.phase}:</strong> {group.operatorAction} {group.purpose}
              </>
            }
            id={group.id}
            key={group.id}
            title={group.title}
          >
            <AdminDetailGrid className="admin-mt-12">
              <div>
                <h3>Environment values</h3>
                <div className="participant-list">
                  {group.envPills.map((env) => (
                    <StatusBadgeFromPillClass key={env.name} pillClass={env.className}>
                      {env.name}
                    </StatusBadgeFromPillClass>
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
            </AdminDetailGrid>
            <div className="setup-command-block">
              <h3>Readiness focus</h3>
              <AdminDetailGrid className="admin-mt-12">
                <div>
                  <h4>Attention values</h4>
                  <p className="muted">
                    {attentionEnvPills.length
                      ? 'Fill or correct these values before expecting the group to pass.'
                      : 'No missing or invalid environment values are currently highlighted.'}
                  </p>
                  <div className="participant-list">
                    {attentionEnvPills.length ? (
                      attentionEnvPills.map((env) => (
                        <StatusBadgeFromPillClass key={`attention-${env.name}`} pillClass={env.className}>
                          {env.name}
                        </StatusBadgeFromPillClass>
                      ))
                    ) : (
                      <StatusBadge tone="success">No env blockers shown</StatusBadge>
                    )}
                  </div>
                </div>
                <div>
                  <h4>Next command</h4>
                  <p className="muted">Run this first, then continue through the grouped command list.</p>
                  <CommandCopyRow command={nextCommand} />
                </div>
              </AdminDetailGrid>
            </div>
            <div className="setup-command-block">
              <h3>Verification commands</h3>
              <p className="muted">
                Run from <code>C:\dev\massage-on-demand-vn</code>. Values inside angle brackets must be
                replaced locally.
              </p>
              {commandMode === 'summary' ? (
                <SetupCommandSummary commands={group.commands} groupId={group.id} />
              ) : (
                <SetupCommandList groupId={group.id} commands={group.commands} />
              )}
            </div>
          </AdminSection>
        );
      })}
    </div>
  );
}

function SetupCommandSummary({
  commands,
  groupId,
}: {
  readonly commands: readonly string[];
  readonly groupId: string;
}) {
  return (
    <div className="setup-command-summary">
      <p className="muted">
        Full command packs are hidden from the default setup payload. Use the first command above for the
        immediate check, or open the full command list when you are actively working this setup group.
      </p>
      <StatusBadgeLink tone="neutral" href={`/setup?commands=all#${groupId}`}>
        Show full command set ({commands.length})
      </StatusBadgeLink>
    </div>
  );
}

function SetupCommandList({
  commands,
  groupId,
}: {
  readonly commands: readonly string[];
  readonly groupId: string;
}) {
  const groups = setupCommandGroups(groupId, commands);

  return (
    <div className="setup-command-list">
      {groups.map((group) => (
        <div key={group.title}>
          <h4>{group.title}</h4>
          <p className="muted">{group.detail}</p>
          <div className="setup-command-list">
            {group.commands.map((command) => (
              <CommandCopyRow command={command} key={command} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function isAttentionEnvPill(env: SetupGroupDetail['envPills'][number]) {
  return env.className.includes('pill-warn') || env.className.includes('pill-danger');
}
