import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './setup-section-test-utils';
import { SetupOperatorActionsSection } from './setup-operator-actions-section';

describe('SetupOperatorActionsSection', () => {
  it('uses the shared AdminSignal atom for setup action chips', () => {
    const source = readFileSync(new URL('./setup-operator-actions-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminSignal');
    expect(source).not.toContain('className={`signal');
  });

  it('uses the shared AdminActionCard surface for pending setup action cards', () => {
    const source = readFileSync(new URL('./setup-operator-actions-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).not.toContain('<a className="setup-action-item"');
    expect(source).not.toContain('<span className="button-secondary setup-card-action">');
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
        'ops-task-card setup-action-item',
        'button button-secondary setup-card-action',
      ]),
    );
    expect(classNamesIn(section)).toContain('command-copy-row');
    expect(hrefsIn(section)).toContain('#supabase');
  });

  it('can hide command snippets for the compact setup page', () => {
    const section = SetupOperatorActionsSection({
      showCommandDetails: false,
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

    expect(rendered).toContain('Database credentials');
    expect(rendered).not.toContain('npm.cmd run external:check:supabase');
    expect(rendered).not.toContain('Payment gateway: Configure real payment gateway credentials.');
    expect(rendered).toContain('Show command details');
    expect(hrefsIn(section)).toContain('/setup?details=all');
    expect(classNamesIn(section)).not.toContain('command-copy-row');
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
