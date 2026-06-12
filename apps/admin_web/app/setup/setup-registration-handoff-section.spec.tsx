import { SetupRegistrationHandoffSection } from './setup-registration-handoff-section';

describe('SetupRegistrationHandoffSection', () => {
  it('renders registration handoff cards with status, owner, env, and anchors', () => {
    const section = SetupRegistrationHandoffSection({
      registrationPlan: [
        {
          id: 'sms',
          provider: 'SMS',
          title: 'Phone verification',
          detail: 'Configure OTP credentials outside Git.',
          groupId: 'supabase-auth',
          status: 'Partial',
          statusClass: 'pill-info',
          owner: 'Operator',
          env: ['SUPABASE_URL', 'SMS_PROVIDER'],
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('External registration handoff');
    expect(rendered.replace(/\s+/g, ' ')).toContain('1 services tracked');
    expect(rendered).toContain('Phone verification');
    expect(rendered).toContain('Partial');
    expect(rendered).toContain('SUPABASE_URL');
    expect(hrefsIn(section)).toContain('#supabase-auth');
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
