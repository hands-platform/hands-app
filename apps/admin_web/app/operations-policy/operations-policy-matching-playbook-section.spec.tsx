import { readFileSync } from 'node:fs';

import { OperationsPolicyMatchingPlaybookSection } from './operations-policy-matching-playbook-section';
import { classNamesIn, normalizedTextContent } from './operations-policy-section-test-utils';

const sectionSource = readFileSync(
  new URL('./operations-policy-matching-playbook-section.tsx', import.meta.url),
  'utf8',
);

describe('OperationsPolicyMatchingPlaybookSection', () => {
  it('uses shared Vuexy badge atoms for playbook tag labels', () => {
    expect(sectionSource).toContain('AdminFilterChipGroup');
    expect(sectionSource).toContain('StatusBadgeFromPillClass');
    expect(sectionSource).not.toContain('statusBadgeToneFromPillClass');
    expect(sectionSource).not.toContain('PillClassBadge');
    expect(sectionSource).not.toContain('<div className="participant-list');
  });

  it('renders the matching playbook timeline with Partner-facing copy', () => {
    const section = OperationsPolicyMatchingPlaybookSection({
      playbook: [
        {
          className: 'timeline-done',
          detail: 'The customer chooses a Partner profile and service option first.',
          step: '1',
          tags: [{ label: 'Direct request', tone: 'pill-success' }],
          title: 'Customer picks one first-pick Partner',
        },
      ],
    });

    const rendered = normalizedTextContent(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'timeline admin-mt-12',
      className: 'admin-mb-16',
      statusLabel: 'Policy driven',
      statusTone: 'info',
      title: 'Booking matching playbook',
    });
    expect(rendered).toContain('Booking matching playbook');
    expect(rendered).toContain('Policy driven');
    expect(rendered).toContain('customer, Partner, finance');
    expect(rendered).toContain('Customer picks one first-pick Partner');
    expect(rendered).toContain('Direct request');
  });

  it('does not duplicate the base pill class for playbook tag badges', () => {
    const section = OperationsPolicyMatchingPlaybookSection({
      playbook: [
        {
          className: 'timeline-done',
          detail: 'The customer chooses a Partner profile and service option first.',
          step: '1',
          tags: [{ label: 'Direct request', tone: 'pill pill-success' }],
          title: 'Customer picks one first-pick Partner',
        },
      ],
    });

    expect(classNamesIn(section)).toContain('pill pill-success');
    expect(classNamesIn(section)).not.toContain('pill pill pill-success');
  });
});
