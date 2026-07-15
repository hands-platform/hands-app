import {
  buildOperationsPolicyDecisionHref,
  buildOperationsPolicyDetailsHref,
  buildOperationsPolicyLoadPlan,
  buildOperationsPolicyMatchingHref,
} from './operations-policy-page-model';

describe('operations policy page model', () => {
  it('loads the compact operations policy sample by default', () => {
    const plan = buildOperationsPolicyLoadPlan({});
    const bookingsUrl = new URL(plan.bookingsHref, 'http://admin.local');
    const policyAuditUrl = new URL(plan.policyAuditHref, 'http://admin.local');
    const bookingGateAuditUrl = new URL(plan.bookingGateAuditHref, 'http://admin.local');

    expect(plan.detailsMode).toBe('summary');
    expect(plan.shouldRenderFullDiagnostics).toBe(false);
    expect(plan.shouldRenderAdvancedIndex).toBe(false);
    expect(bookingsUrl.pathname).toBe('/admin/bookings');
    expect(bookingsUrl.searchParams.get('take')).toBe('3');
    expect(plan.providersHref).toBeNull();
    expect(policyAuditUrl.searchParams.get('take')).toBe('3');
    expect(bookingGateAuditUrl.searchParams.get('take')).toBe('3');
  });

  it('keeps details=all as a lightweight advanced review index', () => {
    const plan = buildOperationsPolicyLoadPlan({ details: 'all' });
    const bookingsUrl = new URL(plan.bookingsHref, 'http://admin.local');
    const policyAuditUrl = new URL(plan.policyAuditHref, 'http://admin.local');
    const bookingGateAuditUrl = new URL(plan.bookingGateAuditHref, 'http://admin.local');

    expect(plan.detailsMode).toBe('all');
    expect(plan.shouldRenderAdvancedIndex).toBe(true);
    expect(plan.shouldRenderFullDiagnostics).toBe(false);
    expect(bookingsUrl.searchParams.get('take')).toBe('3');
    expect(plan.providersHref).toBeNull();
    expect(policyAuditUrl.searchParams.get('take')).toBe('3');
    expect(bookingGateAuditUrl.searchParams.get('take')).toBe('3');
  });

  it('scopes matching, decision, and audit workspaces to bounded data windows', () => {
    const matching = buildOperationsPolicyLoadPlan({ details: 'matching' });
    const matchingSupply = buildOperationsPolicyLoadPlan({
      details: 'matching',
      matching: 'supply',
    });
    const matchingSimulation = buildOperationsPolicyLoadPlan({
      details: 'matching',
      matching: 'simulation',
    });
    const decisions = buildOperationsPolicyLoadPlan({ details: 'decisions' });
    const decisionEvidence = buildOperationsPolicyLoadPlan({
      details: 'decisions',
      decision: 'evidence',
    });
    const audit = buildOperationsPolicyLoadPlan({ details: 'audit' });

    expect(new URL(matching.bookingsHref, 'http://admin.local').searchParams.get('take')).toBe('3');
    expect(matching.providersHref).toBeNull();
    expect(matching.matchingMode).toBe('policy');
    expect(matching.shouldRenderMatchingReview).toBe(true);
    expect(matching.shouldRenderMatchingSupply).toBe(false);
    expect(matching.shouldRenderMatchingSimulation).toBe(false);

    expect(new URL(matchingSupply.bookingsHref, 'http://admin.local').searchParams.get('take')).toBe('20');
    expect(new URL(matchingSupply.providersHref!, 'http://admin.local').searchParams.get('take')).toBe('30');
    expect(matchingSupply.shouldRenderMatchingSupply).toBe(true);

    expect(new URL(matchingSimulation.bookingsHref, 'http://admin.local').searchParams.get('take')).toBe('20');
    expect(new URL(matchingSimulation.providersHref!, 'http://admin.local').searchParams.get('take')).toBe('30');
    expect(matchingSimulation.shouldRenderMatchingSimulation).toBe(true);

    expect(new URL(decisions.bookingsHref, 'http://admin.local').searchParams.get('take')).toBe('3');
    expect(decisions.providersHref).toBeNull();
    expect(decisions.decisionMode).toBe('editor');
    expect(decisions.shouldRenderDecisionReview).toBe(true);
    expect(decisions.shouldRenderDecisionEvidence).toBe(false);

    expect(new URL(decisionEvidence.bookingsHref, 'http://admin.local').searchParams.get('take')).toBe('15');
    expect(new URL(decisionEvidence.providersHref!, 'http://admin.local').searchParams.get('take')).toBe('20');
    expect(decisionEvidence.decisionMode).toBe('evidence');
    expect(decisionEvidence.shouldRenderDecisionEvidence).toBe(true);

    expect(new URL(audit.bookingsHref, 'http://admin.local').searchParams.get('take')).toBe('10');
    expect(audit.providersHref).toBeNull();
    expect(new URL(audit.policyAuditHref, 'http://admin.local').searchParams.get('take')).toBe('20');
    expect(new URL(audit.bookingGateAuditHref, 'http://admin.local').searchParams.get('take')).toBe('20');
    expect(audit.shouldRenderAuditReview).toBe(true);
  });

  it('falls back to the compact sample when full diagnostics are not allowed', () => {
    const plan = buildOperationsPolicyLoadPlan({ details: 'all' }, { allowFullDiagnostics: false });
    const bookingsUrl = new URL(plan.bookingsHref, 'http://admin.local');
    const policyAuditUrl = new URL(plan.policyAuditHref, 'http://admin.local');
    const bookingGateAuditUrl = new URL(plan.bookingGateAuditHref, 'http://admin.local');

    expect(plan.detailsMode).toBe('summary');
    expect(plan.shouldRenderFullDiagnostics).toBe(false);
    expect(bookingsUrl.searchParams.get('take')).toBe('3');
    expect(plan.providersHref).toBeNull();
    expect(policyAuditUrl.searchParams.get('take')).toBe('3');
    expect(bookingGateAuditUrl.searchParams.get('take')).toBe('3');
  });

  it('builds stable summary and full diagnostics links', () => {
    expect(buildOperationsPolicyDetailsHref('all')).toBe('/operations-policy?details=all');
    expect(buildOperationsPolicyDetailsHref('matching')).toBe('/operations-policy?details=matching');
    expect(buildOperationsPolicyDetailsHref('decisions')).toBe('/operations-policy?details=decisions');
    expect(buildOperationsPolicyDetailsHref('audit')).toBe('/operations-policy?details=audit');
    expect(buildOperationsPolicyDetailsHref('summary')).toBe('/operations-policy');
    expect(buildOperationsPolicyDecisionHref('editor')).toBe('/operations-policy?details=decisions');
    expect(buildOperationsPolicyDecisionHref('evidence')).toBe(
      '/operations-policy?details=decisions&decision=evidence',
    );
    expect(buildOperationsPolicyMatchingHref('policy')).toBe('/operations-policy?details=matching');
    expect(buildOperationsPolicyMatchingHref('supply')).toBe(
      '/operations-policy?details=matching&matching=supply',
    );
    expect(buildOperationsPolicyMatchingHref('simulation')).toBe(
      '/operations-policy?details=matching&matching=simulation',
    );
  });
});
