import {
  buildOperationsPolicyAuditHref,
  buildOperationsPolicyDecisionHref,
  buildOperationsPolicyDetailsHref,
  buildOperationsPolicyLoadPlan,
  buildOperationsPolicyMatchingHref,
} from './operations-policy-page-model';

describe('operations policy page model', () => {
  it('loads only settings for the default policy workspace', () => {
    const plan = buildOperationsPolicyLoadPlan({});

    expect(plan).toMatchObject({
      bookingGateAuditHref: null,
      bookingsHref: null,
      detailsMode: 'summary',
      matchingPreviewHref: null,
      policyAuditHref: null,
      policyWriteAuditHealthHref: null,
      providersHref: null,
      settingsHref: '/admin/operational-policy',
      shouldRenderPolicyOverview: true,
    });
  });

  it('checks operator audit health only when a policy editor is requested', () => {
    const plan = buildOperationsPolicyLoadPlan({ edit: 'matching.provider_response_window_minutes' });

    expect(plan.policyWriteAuditHealthHref).toBe('/admin/operational-policy/audit?source=operator&take=1');
    expect(buildOperationsPolicyLoadPlan({}).policyWriteAuditHealthHref).toBeNull();
  });

  it('normalizes the empty details=all chooser to Policies', () => {
    const plan = buildOperationsPolicyLoadPlan({ details: 'all' });

    expect(plan.detailsMode).toBe('summary');
    expect(plan.shouldRenderAdvancedIndex).toBe(false);
    expect(plan.settingsHref).toBe('/admin/operational-policy');
    expect(buildOperationsPolicyDetailsHref('all')).toBe('/operations-policy');
  });

  it('loads settings only for matching and high-impact policy editors', () => {
    const matching = buildOperationsPolicyLoadPlan({ details: 'matching' });
    const decisions = buildOperationsPolicyLoadPlan({ details: 'decisions' });

    for (const plan of [matching, decisions]) {
      expect(plan.settingsHref).toBe('/admin/operational-policy');
      expect(plan.bookingsHref).toBeNull();
      expect(plan.providersHref).toBeNull();
      expect(plan.policyAuditHref).toBeNull();
      expect(plan.bookingGateAuditHref).toBeNull();
      expect(plan.shouldRenderPolicyOverview).toBe(true);
    }
  });

  it('loads bounded history and only the evidence each matching workspace needs', () => {
    for (const matching of ['supply', 'simulation'] as const) {
      const plan = buildOperationsPolicyLoadPlan({ details: 'matching', matching });
      expect(new URL(plan.bookingsHref!, 'http://admin.local').searchParams.get('take')).toBe('20');
      expect(plan.matchingPreviewHref).toBe(
        matching === 'simulation' ? '/admin/operations-policy/matching-preview' : null,
      );
      if (matching === 'supply') {
        expect(new URL(plan.providersHref!, 'http://admin.local').searchParams.get('take')).toBe('30');
      } else {
        expect(plan.providersHref).toBeNull();
      }
      expect(plan.policyAuditHref).toBeNull();
      expect(plan.bookingGateAuditHref).toBeNull();
    }
  });

  it('loads the server-filtered audit without an unnecessary settings request', () => {
    const audit = buildOperationsPolicyLoadPlan({ details: 'audit' });
    expect(audit.settingsHref).toBeNull();
    expect(audit.policyAuditHref).toBe('/admin/operational-policy/audit?source=operator&take=8');
    for (const plan of [audit, buildOperationsPolicyLoadPlan({ details: 'decisions', decision: 'evidence' })]) {
      expect(plan.bookingsHref).toBeNull();
      expect(plan.providersHref).toBeNull();
      expect(plan.policyAuditHref).toContain('/admin/operational-policy/audit');
      expect(plan.bookingGateAuditHref).toBeNull();
      expect(plan.shouldRenderAuditReview).toBe(true);
    }
  });

  it('keeps a bounded cursor history for Older, Newer and deep audit pages', () => {
    const cursor1 = auditCursor('audit-1', 'automated_smoke');
    const cursor2 = auditCursor('audit-2', 'automated_smoke');
    const cursor3 = auditCursor('audit-3', 'automated_smoke');
    const deepPage = buildOperationsPolicyLoadPlan({
      audit: 'automated_smoke',
      auditHistory: [cursor1, cursor2],
      cursor: cursor3,
      details: 'audit',
    });

    expect(deepPage).toMatchObject({
      auditCursor: cursor3,
      auditCursorHistory: [cursor1, cursor2],
      auditSource: 'automated_smoke',
      policyAuditHref: `/admin/operational-policy/audit?source=automated_smoke&take=8&cursor=${cursor3}`,
    });
    expect(buildOperationsPolicyAuditHref('automated_smoke', cursor3, [cursor1, cursor2]))
      .toBe(`/operations-policy?details=audit&audit=automated_smoke&cursor=${cursor3}&auditHistory=${cursor1}&auditHistory=${cursor2}`);
  });

  it('drops unsafe audit cursors and resets history with a source change link', () => {
    const plan = buildOperationsPolicyLoadPlan({
      auditHistory: ['cursor-1'],
      cursor: 'cursor?unsafe=true',
      details: 'audit',
    });

    expect(plan.auditCursor).toBeNull();
    expect(plan.auditCursorHistory).toEqual([]);
    expect(buildOperationsPolicyAuditHref('legacy_unknown')).toBe('/operations-policy?details=audit&audit=legacy_unknown');
  });

  it('keeps the requested diagnostic route and renders an explicit permission denial', () => {
    const plan = buildOperationsPolicyLoadPlan(
      { details: 'matching', matching: 'simulation' },
      { allowFullDiagnostics: false },
    );

    expect(plan.detailsMode).toBe('matching');
    expect(plan.settingsHref).toBeNull();
    expect(plan.bookingsHref).toBeNull();
    expect(plan.providersHref).toBeNull();
    expect(plan.matchingPreviewHref).toBeNull();
    expect(plan.shouldRenderPermissionDenied).toBe(true);
    expect(plan.shouldRenderPolicyOverview).toBe(false);
  });

  it('builds compatible top-level and legacy editor links', () => {
    expect(buildOperationsPolicyDetailsHref('summary')).toBe('/operations-policy');
    expect(buildOperationsPolicyDetailsHref('matching')).toBe('/operations-policy?details=matching');
    expect(buildOperationsPolicyDetailsHref('decisions')).toBe('/operations-policy?details=decisions');
    expect(buildOperationsPolicyDetailsHref('audit')).toBe('/operations-policy?details=audit');
    expect(buildOperationsPolicyDecisionHref('editor')).toBe('/operations-policy?details=decisions');
    expect(buildOperationsPolicyDecisionHref('evidence')).toBe('/operations-policy?details=decisions&decision=evidence');
    expect(buildOperationsPolicyMatchingHref('policy')).toBe('/operations-policy?details=matching');
    expect(buildOperationsPolicyMatchingHref('supply')).toBe('/operations-policy?details=matching&matching=supply');
    expect(buildOperationsPolicyMatchingHref('simulation')).toBe('/operations-policy?details=matching&matching=simulation');
  });
});

function auditCursor(id: string, source: string) {
  return Buffer.from(JSON.stringify({ id, source }), 'utf8').toString('base64url');
}
