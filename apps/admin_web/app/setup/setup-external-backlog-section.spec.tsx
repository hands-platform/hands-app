import { SetupExternalBacklogSection } from './setup-external-backlog-section';
import { hrefsIn, textContent } from './setup-section-test-utils';

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
        },
      ],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(section.type).toBe('section');
    expect(rendered).toContain('What still needs external registration');
    expect(rendered).toContain('2 value(s) pending');
    expect(rendered).toContain('FIREBASE_PROJECT_ID');
    expect(rendered).toContain('Required before push delivery smoke.');
    expect(hrefsIn(section)).toContain('#notifications');
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
});
