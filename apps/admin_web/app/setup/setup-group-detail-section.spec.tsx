import { SetupGroupDetailSection } from './setup-group-detail-section';

describe('SetupGroupDetailSection', () => {
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
    expect(section.props.children[0].props.id).toBe('notifications');
  });

  it('groups notification commands by dry-run, token registration, live send, and review queues', () => {
    const section = SetupGroupDetailSection({
      groups: [
        {
          id: 'notifications',
          title: 'OS push notifications',
          phase: 'Messaging E2E',
          operatorAction: 'Configure FCM only when native push E2E starts.',
          purpose: 'Required before native OS push notifications.',
          status: 'Partial',
          statusClass: 'signal signal-info',
          envPills: [],
          notes: ['Run fcm:token-smoke before live push smoke.'],
          exitCriteria: 'Mobile device delivery is confirmed.',
          commands: [
            'npm.cmd run external:check:push',
            'npm.cmd run fcm:env-contract',
            'npm.cmd run fcm:credentials-check',
            'npm.cmd run fcm:token-smoke -- --dry-run',
            'npm.cmd run fcm:push-smoke -- --dry-run',
            'npm.cmd run fcm:token-smoke',
            '$env:FCM_SMOKE_DEVICE_TOKEN="<real app FCM token>"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; npm.cmd run fcm:push-smoke',
            'Open http://localhost:3101/notifications?review=fcm',
            'Open http://localhost:3101/notifications?review=disabled-device',
            'npm.cmd run notifications:future-check',
          ],
        },
      ],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Dry-run readiness');
    expect(rendered).toContain('npm.cmd run fcm:credentials-check');
    expect(rendered).toContain('Token registration');
    expect(rendered).toContain('Live push send');
    expect(rendered).toContain('Review queues');
    expect(rendered).toContain('Additional checks');
    expect(rendered).toContain('npm.cmd run fcm:token-smoke -- --dry-run');
    expect(rendered).toContain('npm.cmd run fcm:token-smoke');
    expect(rendered).toContain('FCM_SMOKE_EXPECT_STATUS="SENT"');
    expect(rendered).toContain('Open http://localhost:3101/notifications?review=disabled-device');
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

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
