import {
  buildOperationsPolicyDetailsHref,
  buildOperationsPolicyLoadPlan,
} from './operations-policy-page-model';

describe('operations policy page model', () => {
  it('loads the compact operations policy sample by default', () => {
    const plan = buildOperationsPolicyLoadPlan({});
    const bookingsUrl = new URL(plan.bookingsHref, 'http://admin.local');
    const policyAuditUrl = new URL(plan.policyAuditHref, 'http://admin.local');
    const bookingGateAuditUrl = new URL(plan.bookingGateAuditHref, 'http://admin.local');

    expect(plan.detailsMode).toBe('summary');
    expect(plan.shouldRenderFullDiagnostics).toBe(false);
    expect(bookingsUrl.pathname).toBe('/admin/bookings');
    expect(bookingsUrl.searchParams.get('take')).toBe('10');
    expect(plan.providersHref).toBeNull();
    expect(policyAuditUrl.searchParams.get('take')).toBe('5');
    expect(bookingGateAuditUrl.searchParams.get('take')).toBe('5');
  });

  it('keeps the previous larger diagnostics window behind details=all', () => {
    const plan = buildOperationsPolicyLoadPlan({ details: 'all' });
    const bookingsUrl = new URL(plan.bookingsHref, 'http://admin.local');
    expect(plan.providersHref).not.toBeNull();
    const providersUrl = new URL(plan.providersHref!, 'http://admin.local');
    const policyAuditUrl = new URL(plan.policyAuditHref, 'http://admin.local');
    const bookingGateAuditUrl = new URL(plan.bookingGateAuditHref, 'http://admin.local');

    expect(plan.detailsMode).toBe('all');
    expect(plan.shouldRenderFullDiagnostics).toBe(true);
    expect(bookingsUrl.searchParams.get('take')).toBe('50');
    expect(providersUrl.searchParams.get('take')).toBe('100');
    expect(policyAuditUrl.searchParams.get('take')).toBe('20');
    expect(bookingGateAuditUrl.searchParams.get('take')).toBe('50');
  });

  it('falls back to the compact sample when full diagnostics are not allowed', () => {
    const plan = buildOperationsPolicyLoadPlan({ details: 'all' }, { allowFullDiagnostics: false });
    const bookingsUrl = new URL(plan.bookingsHref, 'http://admin.local');
    const policyAuditUrl = new URL(plan.policyAuditHref, 'http://admin.local');
    const bookingGateAuditUrl = new URL(plan.bookingGateAuditHref, 'http://admin.local');

    expect(plan.detailsMode).toBe('summary');
    expect(plan.shouldRenderFullDiagnostics).toBe(false);
    expect(bookingsUrl.searchParams.get('take')).toBe('10');
    expect(plan.providersHref).toBeNull();
    expect(policyAuditUrl.searchParams.get('take')).toBe('5');
    expect(bookingGateAuditUrl.searchParams.get('take')).toBe('5');
  });

  it('builds stable summary and full diagnostics links', () => {
    expect(buildOperationsPolicyDetailsHref('all')).toBe('/operations-policy?details=all');
    expect(buildOperationsPolicyDetailsHref('summary')).toBe('/operations-policy');
  });
});
