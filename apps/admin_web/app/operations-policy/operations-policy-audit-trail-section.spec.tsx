import { readFileSync } from 'node:fs';

import { OperationsPolicyAuditTrailSection } from './operations-policy-audit-trail-section';
import { classNamesIn, hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyAuditTrailSection', () => {
  it('uses shared Vuexy badge atoms for audit enforced labels', () => {
    const source = readFileSync('app/operations-policy/operations-policy-audit-trail-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain("<span className={`pill ${row.enforced ? 'pill-success' : 'pill-warn'}`}>");
  });

  it('renders policy audit rows and audit link', () => {
    const section = OperationsPolicyAuditTrailSection({
      rows: [
        {
          actorName: 'Ops Admin',
          createdAt: '2026-06-15T09:00:00.000Z',
          effect: 'New bookings use the latest enforced setting.',
          enforced: true,
          id: 'audit-1',
          key: 'matching.provider_response_window_minutes',
          label: 'Matching / provider response window minutes',
          policyContext: 'First-pick response timer',
          previousValue: '10',
          reason: 'Tune response timer',
          value: '12',
        },
      ],
    });

    const rendered = normalizedTextContent(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'admin-table-section-body',
      className: 'admin-card-scroll admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group',
      title: 'Recent policy audit trail',
    });
    expect(rendered).toContain('Recent policy audit trail');
    expect(rendered).toContain('Open policy audit');
    expect(rendered).toContain('Ops Admin');
    expect(rendered).toContain('Live behavior');
    expect(rendered).toContain('New bookings use the latest enforced setting.');
    expect(classNamesIn(section)).toContain('table vuexy-data-table vuexy-booking-table service-trace');
    expect(hrefsIn(section)).toContain('/audit-log?bucket=Operations%2FPolicy');
  });

  it('renders empty audit state', () => {
    const rendered = normalizedTextContent(OperationsPolicyAuditTrailSection({ rows: [] }));

    expect(rendered).toContain('No policy change has been audited yet.');
  });
});
