import { nextSetupCommand, setupCommandGroups } from './setup-command-groups';

describe('setup command groups', () => {
  it('keeps non-notification commands in one sequence', () => {
    expect(setupCommandGroups('maps', ['npm.cmd run external:check:maps'])).toEqual([
      {
        commands: ['npm.cmd run external:check:maps'],
        detail: 'Run these checks in order for this setup group.',
        title: 'Command sequence',
      },
    ]);
  });

  it('prioritizes the push external check for notification setup', () => {
    expect(
      nextSetupCommand('notifications', [
        'npm.cmd run fcm:push-smoke -- --dry-run',
        'npm.cmd run external:check:push',
      ]),
    ).toBe('npm.cmd run external:check:push');
  });

  it('groups notification FCM commands by operator phase', () => {
    const groups = setupCommandGroups('notifications', [
      'npm.cmd run external:check:push',
      'npm.cmd run fcm:push-smoke -- --preflight',
      '$env:FCM_SMOKE_ROLE="PROVIDER"; $env:FCM_SMOKE_NOTIFICATION_ID="<id>"; npm.cmd run fcm:push-smoke -- --preflight',
      '$env:FCM_SMOKE_DEVICE_TOKEN="<token>"; npm.cmd run fcm:push-smoke',
      'Open http://localhost:3101/notifications?review=fcm',
      'npm.cmd run custom:check',
    ]);

    expect(groups.map((group) => group.title)).toEqual([
      'Dry-run readiness',
      'API preflight',
      'Partner alert policy fallback',
      'Live push send',
      'Review queues',
      'Additional checks',
    ]);
  });
});
