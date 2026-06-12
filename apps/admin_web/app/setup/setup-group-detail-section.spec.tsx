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
    expect(rendered).toContain('Exit criteria: Push readiness check passes.');
    expect(rendered).toContain('npm.cmd run external:check:push');
    expect(rendered).toContain('C:\\dev\\massage-on-demand-vn');
    expect(section.props.children[0].props.id).toBe('notifications');
  });
});

function textContent(value: unknown): string {
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

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
