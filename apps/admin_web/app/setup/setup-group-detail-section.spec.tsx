import { readFileSync } from 'node:fs';

import { classNamesIn, textContent } from './setup-section-test-utils';
import { SetupGroupDetailSection } from './setup-group-detail-section';
import {
  FCM_CUSTOMER_LIVE_REGISTERED_DEVICE_SMOKE_COMMAND,
  FCM_CUSTOMER_LIVE_TOKEN_SMOKE_COMMAND,
  FCM_NOTIFICATION_AUDIT_COMMAND,
  FCM_NOTIFICATION_REVIEW_COMMANDS,
  FCM_OPERATIONS_HANDOFF_COMMAND,
  FCM_PROVIDER_SUGGESTED_NOTIFICATION_PREFLIGHT_COMMAND,
} from '../notifications/fcm-smoke-commands';

describe('SetupGroupDetailSection', () => {
  it('uses shared badge atoms instead of raw pill markup', () => {
    const source = readFileSync(new URL('./setup-group-detail-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminDetailGrid');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="detail-grid admin-mt-12">');
    expect(source).toContain('StatusBadgeLink');
    expect(source).toContain('actions={');
    expect(source).toContain('pillClass={group.statusClass}');
    expect(source).not.toContain('actions={<span className={group.statusClass}>{group.status}</span>}');
    expect(source).not.toContain('<span className={env.className} key={env.name}>');
    expect(source).not.toContain('<span className={env.className} key={`attention-${env.name}`}>');
    expect(source).not.toContain('<span className="pill pill-success">No env blockers shown</span>');
    expect(source).not.toContain('<a className="pill pill-neutral"');
  });

  it('renders setup group details with environment pills and commands', () => {
    const section = SetupGroupDetailSection({
      groups: [
        {
          id: 'notifications',
          title: 'FCM push',
          phase: 'Notification setup',
          operatorAction: 'Fill push credentials outside Git.',
          purpose: 'Required before push delivery smoke.',
          status: 'Partial',
          statusClass: 'signal signal-info',
          envPills: [
            { name: 'PUSH_PROVIDER', className: 'pill pill-success' },
            { name: 'FIREBASE_PROJECT_ID', className: 'pill pill-warn' },
          ],
          notes: ['Keep Firebase limited to push surfaces.'],
          exitCriteria: 'Push readiness check passes.',
          commands: ['npm.cmd run external:check:push'],
        },
      ],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(section.type).toBe('section');
    expect(rendered).toContain('FCM push');
    expect(rendered).toContain('Notification setup : Fill push credentials outside Git.');
    expect(rendered).toContain('PUSH_PROVIDER');
    expect(rendered).toContain('FIREBASE_PROJECT_ID');
    expect(rendered).toContain('Readiness focus');
    expect(rendered).toContain('Attention values');
    expect(rendered).toContain('Fill or correct these values before expecting the group to pass.');
    expect(rendered).toContain('Next command');
    expect(rendered).toContain('Exit criteria: Push readiness check passes.');
    expect(rendered).toContain('npm.cmd run external:check:push');
    expect(rendered).toContain('C:\\dev\\massage-on-demand-vn');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section',
        'ops-section-header admin-section-header',
        'command-copy-row',
      ]),
    );
    expect(section.props.children[0].props.id).toBe('notifications');
  });

  it('groups notification commands by dry-run, token registration, live send, and review queues', () => {
    const section = SetupGroupDetailSection({
      groups: [
        {
          id: 'notifications',
          title: 'FCM push notifications',
          phase: 'Messaging E2E',
          operatorAction: 'Configure FCM only when native push E2E starts.',
          purpose: 'Required before native FCM push notifications.',
          status: 'Partial',
          statusClass: 'signal signal-info',
          envPills: [],
          notes: ['Run fcm:token-smoke before live push smoke.'],
          exitCriteria: 'Mobile device delivery is confirmed.',
          commands: [
            'npm.cmd run external:check:push',
            'npm.cmd run fcm:env-contract',
            'npm.cmd run notifications:push-data-contract',
            'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -CheckOnly',
            'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -UpdateEnv',
            'npm.cmd run security:secrets',
            'npm.cmd run fcm:credentials-check',
            'npm.cmd run docker:contract',
            'npm.cmd run fcm:token-smoke -- --dry-run',
            'npm.cmd run fcm:token-recovery-smoke -- --dry-run',
            'npm.cmd run fcm:push-smoke -- --dry-run',
            'npm.cmd run fcm:push-smoke -- --preflight',
            'npm.cmd run fcm:push-smoke -- --preflight --use-registered-device',
            FCM_PROVIDER_SUGGESTED_NOTIFICATION_PREFLIGHT_COMMAND,
            'npm.cmd run fcm:token-smoke',
            'npm.cmd run fcm:token-recovery-smoke',
            FCM_CUSTOMER_LIVE_TOKEN_SMOKE_COMMAND,
            FCM_CUSTOMER_LIVE_REGISTERED_DEVICE_SMOKE_COMMAND,
            FCM_NOTIFICATION_REVIEW_COMMANDS[0],
            FCM_NOTIFICATION_REVIEW_COMMANDS[2],
            FCM_OPERATIONS_HANDOFF_COMMAND,
            FCM_NOTIFICATION_AUDIT_COMMAND,
            'npm.cmd run notifications:future-check',
          ],
        },
      ],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Dry-run readiness');
    expect(rendered).toContain('npm.cmd run notifications:push-data-contract');
    expect(rendered).toContain('npm.cmd run fcm:credentials:install');
    expect(rendered).toContain('npm.cmd run security:secrets');
    expect(rendered).toContain('npm.cmd run fcm:credentials-check');
    expect(rendered).toContain('npm.cmd run docker:contract');
    expect(rendered).toContain('Token registration');
    expect(rendered).toContain('customer/Partner FCM token registration');
    expect(rendered).toContain('disabled-token recovery');
    expect(rendered).toContain('without sending FCM push');
    expect(rendered).toContain('API preflight');
    expect(rendered).toContain('post-send retry audit freshness');
    expect(rendered).toContain('without sending FCM');
    expect(rendered).toContain('Partner alert policy fallback');
    expect(rendered).toContain('When Partner alert preflight is routed to in-app delivery');
    expect(rendered).toContain('preflight suggested standard notification id');
    expect(rendered).toContain('Live push send');
    expect(rendered).toContain('reuse an enabled device already registered');
    expect(rendered).toContain('Review queues and evidence');
    expect(rendered).toContain('failed sends for credential or delivery failures');
    expect(rendered).toContain('pending for worker backlog');
    expect(rendered).toContain('Additional checks');
    expect(rendered).toContain('npm.cmd run fcm:token-smoke -- --dry-run');
    expect(rendered).toContain('npm.cmd run fcm:token-recovery-smoke -- --dry-run');
    expect(rendered).toContain('npm.cmd run fcm:push-smoke -- --preflight');
    expect(rendered).toContain('npm.cmd run fcm:push-smoke -- --preflight --use-registered-device');
    expect(rendered).toContain('npm.cmd run fcm:token-smoke');
    expect(rendered).toContain('npm.cmd run fcm:token-recovery-smoke');
    expect(rendered).toContain('FCM_SMOKE_ROLE="CUSTOMER"');
    expect(rendered).toContain('FCM_SMOKE_PHONE="+84900000001"');
    expect(rendered).toContain('FCM_SMOKE_USE_REGISTERED_DEVICE="true"');
    expect(rendered).toContain('FCM_SMOKE_EXPECT_STATUS="SENT"');
    expect(rendered).toContain(FCM_NOTIFICATION_REVIEW_COMMANDS[2]);
    expect(rendered).toContain(FCM_OPERATIONS_HANDOFF_COMMAND);
    expect(rendered).toContain(FCM_NOTIFICATION_AUDIT_COMMAND);
    expect(rendered).toContain('npm.cmd run notifications:future-check');
  });

  it('shows a clear readiness focus when a setup group has no highlighted env blockers', () => {
    const section = SetupGroupDetailSection({
      groups: [
        {
          id: 'maps',
          title: 'Map setup',
          phase: 'Location E2E',
          operatorAction: 'Verify map keys.',
          purpose: 'Required for customer address search.',
          status: 'Ready',
          statusClass: 'signal signal-ok',
          envPills: [{ name: 'MAPTILER_API_KEY', className: 'pill pill-success' }],
          notes: ['Use MapTiler only for map tiles.'],
          exitCriteria: 'Map checks pass.',
          commands: ['npm.cmd run external:check:maps'],
        },
      ],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('No missing or invalid environment values are currently highlighted.');
    expect(rendered).toContain('No env blockers shown');
    expect(rendered).toContain('Next command');
    expect(rendered).toContain('npm.cmd run external:check:maps');
  });
});
