import { readFileSync } from 'node:fs';

import { OperationsPolicyAuditTrailSection } from './operations-policy-audit-trail-section';
import { classNamesIn, hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyAuditTrailSection', () => {
  it('uses shared Vuexy badge atoms for audit enforced labels', () => {
    const source = readFileSync('app/operations-policy/operations-policy-audit-trail-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('AdminTableSection');
    expect(source).not.toContain(
      'className="admin-card-scroll admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"',
    );
    expect(source).not.toContain('<a className="button button-secondary"');
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

    expect(section.type.name).toBe('AdminTableSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'admin-table-section-body',
      className: 'admin-card-scroll admin-mb-16',
      title: 'Recent policy audit trail',
    });
    expect(rendered).toContain('Recent policy audit trail');
    expect(rendered).toContain('Open policy audit');
    expect(rendered).toContain('Ops Admin');
    expect(rendered).toContain('Live behavior');
    expect(rendered).toContain('New bookings use the latest enforced setting.');
    expect(classNamesIn(section)).toContain('admin-form-control-link button button-secondary');
    expect(classNamesIn(section)).toContain('table vuexy-data-table vuexy-booking-table service-trace');
    expect(hrefsIn(section)).toContain('/audit-log?bucket=Operations%2FPolicy');
  });

  it('renders empty audit state', () => {
    const section = OperationsPolicyAuditTrailSection({ rows: [] });
    const rendered = normalizedTextContent(section);

    expect(rendered).toContain('No policy change has been audited yet.');
    expect(classNamesIn(section)).toContain('empty-state');
  });
});
