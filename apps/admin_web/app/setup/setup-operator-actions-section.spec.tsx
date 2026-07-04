import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './setup-section-test-utils';
import { SetupOperatorActionsSection } from './setup-operator-actions-section';

describe('SetupOperatorActionsSection', () => {
  it('uses the shared AdminSignal atom for setup action chips', () => {
    const source = readFileSync(new URL('./setup-operator-actions-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminSignal');
    expect(source).not.toContain('className={`signal');
  });

  it('renders current and deferred setup actions with commands', () => {
    const section = SetupOperatorActionsSection({
      nextActions: [
        {
          groupId: 'supabase',
          name: 'Database credentials',
          phase: 'Staging foundation',
          action: 'Fill server-side Supabase credentials.',
          commands: ['npm.cmd run external:check:supabase', 'npm.cmd run security:secrets'],
        },
      ],
      deferredActions: [
        {
          groupId: 'payments',
          name: 'Payment gateway',
          phase: 'Deferred production setup',
          action: 'Configure real payment gateway credentials.',
          commands: ['npm.cmd run external:check:payments'],
        },
      ],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(section.props.id).toBe('live-readiness');
    expect(rendered).toContain('Next operator actions');
    expect(rendered).toContain('1 pending');
    expect(rendered).toContain('Database credentials');
    expect(rendered).toContain('npm.cmd run external:check:supabase');
    expect(rendered).toContain('Deferred production setup');
    expect(rendered).toContain('Payment gateway: Configure real payment gateway credentials.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section',
        'ops-section-header admin-section-header',
      ]),
    );
    expect(classNamesIn(section)).toContain('command-copy-row');
    expect(hrefsIn(section)).toContain('#supabase');
  });

  it('renders a clear state when no current action is pending', () => {
    const section = SetupOperatorActionsSection({
      nextActions: [],
      deferredActions: [],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('No pending actions');
    expect(rendered).toContain('All current-stage setup actions are clear.');
  });
});
