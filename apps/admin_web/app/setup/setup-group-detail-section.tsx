import { CommandCopyRow } from '../../components/command-copy-row';
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
  readonly groups: readonly SetupGroupDetail[];
};

export function SetupGroupDetailSection({ groups }: SetupGroupDetailSectionProps) {
  return (
    <section className="stack admin-mt-16">
      {groups.map((group) => {
        const attentionEnvPills = group.envPills.filter(isAttentionEnvPill);
        const nextCommand = nextSetupCommand(group.id, group.commands);

        return (
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
              <h3>Readiness focus</h3>
              <div className="detail-grid admin-mt-12">
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
                        <span className={env.className} key={`attention-${env.name}`}>
                          {env.name}
                        </span>
                      ))
                    ) : (
                      <span className="pill pill-success">No env blockers shown</span>
                    )}
                  </div>
                </div>
                <div>
                  <h4>Next command</h4>
                  <p className="muted">Run this first, then continue through the grouped command list.</p>
                  <CommandCopyRow command={nextCommand} />
                </div>
              </div>
            </div>
            <div className="setup-command-block">
              <h3>Verification commands</h3>
              <p className="muted">
                Run from <code>C:\dev\massage-on-demand-vn</code>. Values inside angle brackets must be
                replaced locally.
              </p>
              <SetupCommandList groupId={group.id} commands={group.commands} />
            </div>
          </div>
        );
      })}
    </section>
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
