import {
  FCM_TOKEN_RECOVERY_SMOKE_COMMAND,
  FCM_TOKEN_SMOKE_COMMAND,
  isFcmSetupReviewCommand,
} from '../notifications/fcm-smoke-commands';

export type SetupCommandGroup = {
  readonly title: string;
  readonly detail: string;
  readonly commands: readonly string[];
};

export function nextSetupCommand(groupId: string, commands: readonly string[]) {
  if (commands.length === 0) {
    return 'No command configured';
  }
  if (groupId === 'notifications') {
    return commands.find((command) => command.includes('external:check:push')) ?? commands[0];
  }
  return commands[0];
}

export function setupCommandGroups(groupId: string, commands: readonly string[]): SetupCommandGroup[] {
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
      detail:
        'Confirm push credentials, Firebase project alignment, env contracts, and smoke inputs before writing test records.',
      commands: commands.filter(
        (command) =>
          command.includes('--dry-run') ||
          command.includes('external:check:push') ||
          command.includes('fcm:env-contract') ||
          command.includes('notifications:push-data-contract') ||
          command.includes('notifications:retry-audit-contract') ||
          command.includes('fcm:credentials:install') ||
          command.includes('security:secrets') ||
          command.includes('fcm:credentials-check') ||
          command.includes('docker:contract'),
      ),
    },
    {
      title: 'Token registration',
      detail:
        'Verify customer/Partner FCM token registration, disabled-token recovery, and replacement-token behavior through the API without sending FCM push.',
      commands: commands.filter(
        (command) => command === FCM_TOKEN_SMOKE_COMMAND || command === FCM_TOKEN_RECOVERY_SMOKE_COMMAND,
      ),
    },
    {
      title: 'API preflight',
      detail:
        'Check API readiness, Firebase project alignment, notification availability, registered device state, Partner alert policy, and post-send retry audit freshness without sending FCM.',
      commands: commands.filter(
        (command) => command.includes('--preflight') && !command.includes('FCM_SMOKE_NOTIFICATION_ID'),
      ),
    },
    {
      title: 'Partner alert policy fallback',
      detail:
        'When Partner alert preflight is routed to in-app delivery, reuse the suggested standard notification id for an FCM-only smoke check.',
      commands: commands.filter((command) => command.includes('FCM_SMOKE_NOTIFICATION_ID')),
    },
    {
      title: 'Live push send',
      detail:
        'Use a real app FCM token, or reuse an enabled device already registered by the selected role, phone, and platform.',
      commands: commands.filter(
        (command) =>
          !command.includes('--preflight') &&
          (command.includes('FCM_SMOKE_DEVICE_TOKEN') || command.includes('FCM_SMOKE_USE_REGISTERED_DEVICE')),
      ),
    },
    {
      title: 'Review queues and evidence',
      detail:
        'Open FCM route for success evidence, failed sends for credential or delivery failures, disabled/stale device queues for token health, pending for worker backlog, and handoff/audit evidence for operator history.',
      commands: commands.filter(isFcmReviewCommand),
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

function isFcmReviewCommand(command: string) {
  return isFcmSetupReviewCommand(command);
}
