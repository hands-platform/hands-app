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
              Run from <code>C:\dev\massage-on-demand-vn</code>. Values inside angle brackets must be replaced
              locally.
            </p>
            <SetupCommandList groupId={group.id} commands={group.commands} />
          </div>
        </div>
      ))}
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
              <code key={command}>{command}</code>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function setupCommandGroups(groupId: string, commands: readonly string[]) {
  if (groupId !== 'notifications') {
    return [
      {
        title: 'Command sequence',
        detail: 'Run these checks in order for this setup group.',
        commands,
      },
    ];
  }

  const groups = [
    {
      title: 'Dry-run readiness',
      detail: 'Confirm push credentials, env contracts, and smoke inputs before writing test records.',
      commands: commands.filter(
        (command) =>
          command.includes('--dry-run') ||
          command.includes('external:check:push') ||
          command.includes('fcm:env-contract'),
      ),
    },
    {
      title: 'Token registration',
      detail: 'Verify customer/provider FCM token registration through the API without sending OS push.',
      commands: commands.filter((command) => command === 'npm.cmd run fcm:token-smoke'),
    },
    {
      title: 'Live push send',
      detail: 'Use a real app FCM token from the current mobile build and expect FCM/SENT delivery.',
      commands: commands.filter((command) => command.includes('FCM_SMOKE_DEVICE_TOKEN')),
    },
    {
      title: 'Review queues',
      detail:
        'Open the operational queues that confirm route, failures, disabled devices, stale tokens, and pending attempts.',
      commands: commands.filter((command) => command.startsWith('Open http://localhost:3101/notifications')),
    },
  ].filter((group) => group.commands.length > 0);
  const groupedCommands = new Set(groups.flatMap((group) => group.commands));
  const additionalCommands = commands.filter((command) => !groupedCommands.has(command));

  return additionalCommands.length
    ? [
        ...groups,
        {
          title: 'Additional checks',
          detail: 'Run any remaining notification setup checks that do not belong to the standard FCM path.',
          commands: additionalCommands,
        },
      ]
    : groups;
}
