import { SetupRegistrationHandoffSection } from './setup-registration-handoff-section';
import { hrefsIn, textContent } from './setup-section-test-utils';

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
