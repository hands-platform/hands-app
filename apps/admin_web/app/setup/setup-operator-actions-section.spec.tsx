import { SetupOperatorActionsSection } from './setup-operator-actions-section';

describe('SetupOperatorActionsSection', () => {
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
    expect(rendered).toContain('Payment gateway : Configure real payment gateway credentials.');
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

function hrefsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
