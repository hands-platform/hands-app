import { readFileSync } from 'node:fs';

import { OperationsPolicyAuditTrailSection } from './operations-policy-audit-trail-section';
import { classNamesIn, hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyAuditTrailSection', () => {
  it('uses shared Vuexy badge atoms for audit enforced labels', () => {
    const source = readFileSync('app/operations-policy/operations-policy-audit-trail-section.tsx', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('AdminTableSection');
    expect(source).not.toContain(
      'className="admin-card-scroll admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"',
    );
    expect(source).not.toContain('<a className="button button-secondary"');
    expect(source).not.toContain("<span className={`pill ${row.enforced ? 'pill-success' : 'pill-warn'}`}>");
    expect(source).not.toContain('<p className="muted">{formatDateTime(row.createdAt)}</p>');
  });

  it('renders policy audit rows and audit link', () => {
    const section = OperationsPolicyAuditTrailSection({
      rows: [
        {
          actorName: 'Ops Admin',
          createdAt: '2026-06-15T09:00:00.000Z',
          effect: 'New bookings use the latest enforced setting.',
          environment: 'production',
          enforced: true,
          id: 'audit-1',
          key: 'matching.provider_response_window_minutes',
          label: 'Matching / provider response window minutes',
          policyContext: 'First-pick response timer',
          previousValue: '10',
          reason: 'Tune response timer',
          restoration: false,
          runId: null,
          source: 'operator',
          value: '12',
        },
      ],
    });

    const rendered = normalizedTextContent(section);

    expect(section.type.name).toBe('AdminTableSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'admin-table-section-body',
      className: 'operations-policy-audit-section admin-mb-16',
      scrollable: true,
      title: 'Recent policy audit trail',
    });
    expect(rendered).toContain('Recent policy audit trail');
    expect(rendered).toContain('Open full audit');
    expect(rendered).toContain('Operator changes');
    expect(rendered).toContain('Automated smoke');
    expect(rendered).toContain('Ops Admin');
    expect(rendered).toContain('Policy & actor');
    expect(rendered).toContain('Open evidence');
    expect(rendered).toContain('New bookings use the latest enforced setting.');
    expect(rendered).not.toContain('View details');
    expect(classNamesIn(section)).toContain('admin-form-control-link button button-secondary');
    expect(classNamesIn(section)).toContain('table vuexy-data-table vuexy-booking-table admin-data-table operations-policy-audit-table');
    expect(hrefsIn(section)).toContain('/audit-log?bucket=Operations%2FPolicy&range=all&sort=newest');
    expect(hrefsIn(section)).toContain('/audit-log?bucket=Operations%2FPolicy&event=audit-1&range=all&sort=newest');
  });

  it.each([
    ['operator', 'No operator policy change has been audited yet.'],
    ['automated_smoke', 'No server-verified automated smoke policy change is available.'],
    ['legacy_unknown', 'No legacy or unclassified policy audit record is available.'],
  ] as const)('renders the exact %s empty state', (mode, copy) => {
    const section = OperationsPolicyAuditTrailSection({ mode, rows: [] });
    expect(normalizedTextContent(section)).toContain(copy);
    expect(classNamesIn(section)).toContain('empty-state');
  });

  it('renders bidirectional cursor controls', () => {
    const section = OperationsPolicyAuditTrailSection({
      firstHref: '/operations-policy?details=audit',
      mode: 'operator',
      newerHref: '/operations-policy?details=audit&cursor=cursor-1',
      nextHref: '/operations-policy?details=audit&cursor=cursor-3',
      pageNumber: 3,
      rows: [],
    });
    const rendered = normalizedTextContent(section);
    expect(rendered).toContain('Page 3');
    expect(rendered).toContain('First page');
    expect(rendered).toContain('Newer records');
    expect(rendered).toContain('Older records');
    expect(rendered).toContain('Operator · All recorded history · Page 3 · Older available');
  });
});
