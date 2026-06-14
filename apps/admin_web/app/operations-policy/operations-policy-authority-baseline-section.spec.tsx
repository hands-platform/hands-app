import { OperationsPolicyAuthorityBaselineSection } from './operations-policy-authority-baseline-section';
import { normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyAuthorityBaselineSection', () => {
  it('renders the MVP authority rules as operator-facing copy', () => {
    const section = OperationsPolicyAuthorityBaselineSection();
    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('MVP authority baseline');
    expect(rendered).toContain('Address snapshot required');
    expect(rendered).toContain('First-pick priority with fallback choice');
    expect(rendered).toContain('Booking-address radius');
    expect(rendered).toContain('View demand, block finalization');
    expect(rendered).toContain('Vietnam booking');
  });
});
