import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ServicePricingAuditRow } from '../../lib/service-pricing-audit-rows';
import { ServicePricingAuditTrailSection } from './service-pricing-audit-trail-section';

describe('ServicePricingAuditTrailSection', () => {
  it('uses shared Vuexy badge atoms for pricing audit labels', () => {
    const source = readFileSync('app/services/service-pricing-audit-trail-section.tsx', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('AdminTableSection');
    expect(source).not.toContain(
      'className="admin-card-scroll admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"',
    );
    expect(source).not.toContain('<a className="button button-secondary"');
    expect(source).not.toContain('<span className="pill pill-warn">{humanizeAuditAction(row.action)}</span>');
    expect(source).not.toContain('<span className="pill pill-info" key={`${row.id}-${field}`}>');
    expect(source).not.toContain('<p className="muted">{formatDateTime(row.createdAt)}</p>');
  });

  it('renders audit rows with humanized action, changed fields, and pricing labels', () => {
    const section = ServicePricingAuditTrailSection({
      rows: [
        pricingAuditRowFixture({
          action: 'service_payout_rule.created',
          changedFields: ['customerPrice', 'providerPayoutAmount'],
          id: 'audit-1',
          serviceLabel: 'Foot Massage / 90 min',
        }),
      ],
    });

    const rendered = JSON.stringify(section);

    expect(section.type.name).toBe('AdminTableSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'admin-table-section-body',
      className: 'admin-mb-16',
      scrollable: true,
      title: 'Recent pricing audit trail',
    });
    expect(rendered).toContain('Recent pricing audit trail');
    expect(rendered).toContain('Service payout rule / Created');
    expect(rendered).toContain('customerPrice');
    expect(rendered).toContain('providerPayoutAmount');
    expect(rendered).toContain('Foot Massage / 90 min');
  });

  it('renders an empty state when there are no recent service pricing audit events', () => {
    const section = ServicePricingAuditTrailSection({ rows: [] });

    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('No recent service pricing audit event has been recorded yet.');
    expect(markup).toContain('class="empty-state');
  });
});

function pricingAuditRowFixture({
  action,
  changedFields,
  id,
  serviceLabel,
}: {
  readonly action: string;
  readonly changedFields: readonly string[];
  readonly id: string;
  readonly serviceLabel: string;
}): ServicePricingAuditRow {
  return {
    action,
    actorName: 'Ops Lead',
    changedFields,
    createdAt: '2026-06-09T10:00:00.000Z',
    id,
    payoutLabel: 'Partner 350.000 VND',
    priceLabel: 'Customer 500.000 VND',
    serviceLabel,
    target: 'service_payout_rule:abcdef1234567890',
    targetShort: 'service_payout_rule:abcdef12',
  };
}
