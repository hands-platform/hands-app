import { readFileSync } from 'node:fs';

import { SetupRegistrationHandoffSection } from './setup-registration-handoff-section';
import { hrefsIn, textContent } from './setup-section-test-utils';

describe('SetupRegistrationHandoffSection', () => {
  it('uses shared badge atoms instead of raw pill markup', () => {
    const source = readFileSync(new URL('./setup-registration-handoff-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${item.statusClass}`}>{item.status}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{item.owner}</span>');
    expect(source).not.toContain('<span className="pill pill-info" key={`${item.id}-${name}`}>');
  });

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

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'setup-backlog',
      className: 'admin-mb-16',
      statusLabel: '1 services tracked',
      statusTone: 'info',
      title: 'External registration handoff',
    });
    expect(rendered).toContain('External registration handoff');
    expect(rendered.replace(/\s+/g, ' ')).toContain('1 services tracked');
    expect(rendered).toContain('Phone verification');
    expect(rendered).toContain('Partial');
    expect(rendered).toContain('SUPABASE_URL');
    expect(hrefsIn(section)).toContain('#supabase-auth');
  });
});
