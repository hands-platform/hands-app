import { nextSetupCommand, setupCommandGroups } from './setup-command-groups';
import {
  FCM_NOTIFICATION_AUDIT_COMMAND,
  FCM_NOTIFICATION_REVIEW_COMMANDS,
  FCM_OPERATIONS_HANDOFF_COMMAND,
} from '../notifications/fcm-smoke-commands';

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
      'npm.cmd run notifications:push-data-contract',
      'npm.cmd run notifications:retry-audit-contract',
      'npm.cmd run fcm:push-smoke -- --preflight',
      'npm.cmd run fcm:push-smoke -- --preflight --use-registered-device',
      'npm.cmd run fcm:token-smoke',
      'npm.cmd run fcm:token-recovery-smoke -- --dry-run',
      'npm.cmd run fcm:token-recovery-smoke',
      '$env:FCM_SMOKE_ROLE="PROVIDER"; $env:FCM_SMOKE_NOTIFICATION_ID="<id>"; npm.cmd run fcm:push-smoke -- --preflight',
      '$env:FCM_SMOKE_DEVICE_TOKEN="<token>"; npm.cmd run fcm:push-smoke',
      FCM_NOTIFICATION_REVIEW_COMMANDS[0],
      FCM_OPERATIONS_HANDOFF_COMMAND,
      FCM_NOTIFICATION_AUDIT_COMMAND,
      'npm.cmd run custom:check',
    ]);

    expect(groups.map((group) => group.title)).toEqual([
      'Dry-run readiness',
      'Token registration',
      'API preflight',
      'Partner alert policy fallback',
      'Live push send',
      'Review queues and evidence',
      'Additional checks',
    ]);
    expect(groups.find((group) => group.title === 'Review queues and evidence')?.detail).toContain(
      'failed sends for credential or delivery failures',
    );
    expect(groups.find((group) => group.title === 'Review queues and evidence')?.detail).toContain(
      'pending for worker backlog',
    );
    expect(groups.find((group) => group.title === 'API preflight')?.detail).toContain(
      'post-send retry audit freshness',
    );
    expect(groups.find((group) => group.title === 'Review queues and evidence')?.commands).toEqual([
      FCM_NOTIFICATION_REVIEW_COMMANDS[0],
      FCM_OPERATIONS_HANDOFF_COMMAND,
      FCM_NOTIFICATION_AUDIT_COMMAND,
    ]);
    expect(groups.find((group) => group.title === 'Token registration')?.detail).toContain(
      'without sending FCM push',
    );
    expect(groups.find((group) => group.title === 'Token registration')?.commands).toEqual([
      'npm.cmd run fcm:token-smoke',
      'npm.cmd run fcm:token-recovery-smoke',
    ]);
    expect(groups.find((group) => group.title === 'Dry-run readiness')?.commands).toContain(
      'npm.cmd run fcm:token-recovery-smoke -- --dry-run',
    );
    expect(groups.find((group) => group.title === 'API preflight')?.commands).toContain(
      'npm.cmd run fcm:push-smoke -- --preflight --use-registered-device',
    );
    expect(groups.find((group) => group.title === 'Dry-run readiness')?.commands).toContain(
      'npm.cmd run notifications:push-data-contract',
    );
    expect(groups.find((group) => group.title === 'Dry-run readiness')?.commands).toContain(
      'npm.cmd run notifications:retry-audit-contract',
    );
  });
});
