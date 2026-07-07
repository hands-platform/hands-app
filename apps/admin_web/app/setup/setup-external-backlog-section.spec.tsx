import { SetupExternalBacklogSection } from './setup-external-backlog-section';
import { classNamesIn, hrefsIn, textContent } from './setup-section-test-utils';

describe('SetupExternalBacklogSection', () => {
  it('renders pending external registration backlog items', () => {
    const section = SetupExternalBacklogSection({
      missingCount: 2,
      backlog: [
        {
          groupId: 'notifications',
          groupTitle: 'FCM push',
          name: 'FIREBASE_PROJECT_ID',
          reason: 'Required before push delivery smoke.',
          commands: ['npm.cmd run external:check:push'],
        },
      ],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'setup-backlog',
      className: 'admin-mt-16',
      statusLabel: '2 value(s) pending',
      statusTone: 'warning',
      title: 'What still needs external registration',
    });
    expect(rendered).toContain('What still needs external registration');
    expect(rendered).toContain('2 value(s) pending');
    expect(rendered).toContain('FIREBASE_PROJECT_ID');
    expect(rendered).toContain('Required before push delivery smoke.');
    expect(rendered).toContain('npm.cmd run external:check:push');
    expect(hrefsIn(section)).toContain('#notifications');
    expect(classNamesIn(section)).toContain('command-copy-row');
    expect(classNamesIn(section)).toContain('admin-form-control-link button button-secondary setup-card-action');
  });

  it('renders a clear state when there are no backlog items', () => {
    const section = SetupExternalBacklogSection({
      missingCount: 0,
      backlog: [],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('No missing values');
    expect(rendered).toContain('All external readiness values are configured for the current environment.');
  });

  it('can keep the default setup page compact by limiting visible backlog rows', () => {
    const section = SetupExternalBacklogSection({
      missingCount: 3,
      backlogLimit: 2,
      showCommands: false,
      backlog: [
        {
          groupId: 'supabase',
          groupTitle: 'Supabase',
          name: 'SUPABASE_URL',
          reason: 'Needed for API checks.',
          commands: ['npm.cmd run external:check:supabase'],
        },
        {
          groupId: 'maps',
          groupTitle: 'Maps',
          name: 'GEOAPIFY_API_KEY',
          reason: 'Needed for address search.',
        },
        {
          groupId: 'payments',
          groupTitle: 'Payments',
          name: 'MOMO_ACCESS_KEY',
          reason: 'Needed for payment smoke.',
        },
      ],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('SUPABASE_URL');
    expect(rendered).toContain('GEOAPIFY_API_KEY');
    expect(rendered).not.toContain('MOMO_ACCESS_KEY');
    expect(rendered).not.toContain('npm.cmd run external:check:supabase');
    expect(rendered).toContain('1 more setup item is hidden from the default view.');
    expect(hrefsIn(section)).toContain('/setup?details=all');
    expect(classNamesIn(section)).not.toContain('command-copy-row');
    expect(classNamesIn(section)).toContain('admin-form-control-link button button-secondary setup-card-action');
  });

  it('keeps command copy rows available for the full setup backlog view', () => {
    const section = SetupExternalBacklogSection({
      missingCount: 1,
      showCommands: true,
      backlog: [
        {
          groupId: 'notifications',
          groupTitle: 'FCM push',
          name: 'FIREBASE_PROJECT_ID',
          reason: 'Required before push delivery smoke.',
          commands: ['npm.cmd run external:check:push'],
        },
      ],
    });

    expect(textContent(section)).toContain('npm.cmd run external:check:push');
    expect(classNamesIn(section)).toContain('command-copy-row');
  });
});
