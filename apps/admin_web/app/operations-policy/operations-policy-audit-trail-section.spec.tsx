import { OperationsPolicyAuditTrailSection } from './operations-policy-audit-trail-section';
import { hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyAuditTrailSection', () => {
  it('renders policy audit rows and audit link', () => {
    const section = OperationsPolicyAuditTrailSection({
      rows: [
        {
          actorName: 'Ops Admin',
          createdAt: '2026-06-15T09:00:00.000Z',
          effect: 'New bookings use the latest enforced setting.',
          enforced: true,
          id: 'audit-1',
          label: 'Matching / provider response window minutes',
          policyContext: 'First-pick response timer',
          previousValue: '10',
          reason: 'Tune response timer',
          value: '12',
        },
      ],
    });

    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Recent policy audit trail');
    expect(rendered).toContain('Open policy audit');
    expect(rendered).toContain('Ops Admin');
    expect(rendered).toContain('Live behavior');
    expect(rendered).toContain('New bookings use the latest enforced setting.');
    expect(hrefsIn(section)).toContain('/audit-log?bucket=Operations%2FPolicy');
  });

  it('renders empty audit state', () => {
    const rendered = normalizedTextContent(OperationsPolicyAuditTrailSection({ rows: [] }));

    expect(rendered).toContain('No policy change has been audited yet.');
  });
});
