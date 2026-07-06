import { readFileSync } from 'node:fs';

import { OperationsPolicyAuthorityBaselineSection } from './operations-policy-authority-baseline-section';
import { normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyAuthorityBaselineSection', () => {
  it('uses shared Vuexy badge atoms for authority labels', () => {
    const source = readFileSync('app/operations-policy/operations-policy-authority-baseline-section.tsx', 'utf8');

    expect(source).toContain('AdminTaskGrid');
    expect(source).not.toContain('bodyClassName="ops-task-grid admin-mt-14"');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-success">BookingAddressSnapshot</span>');
    expect(source).not.toContain('<span className="pill pill-success">No auto assignment</span>');
    expect(source).not.toContain('<span className="pill pill-info">10km marketplace</span>');
    expect(source).not.toContain('<span className="pill pill-warn">Negative wallet gate</span>');
  });

  it('renders the MVP authority rules as operator-facing copy', () => {
    const section = OperationsPolicyAuthorityBaselineSection();
    const rendered = normalizedTextContent(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      className: 'admin-mb-16',
      statusLabel: 'Command center rules',
      statusTone: 'success',
      title: 'MVP authority baseline',
    });
    expect(rendered).toContain('MVP authority baseline');
    expect(rendered).toContain('Address snapshot required');
    expect(rendered).toContain('First-pick priority with fallback choice');
    expect(rendered).toContain('Booking-address radius');
    expect(rendered).toContain('View demand, block finalization');
    expect(rendered).toContain('Vietnam booking');
  });
});
