import { buildAuditExportHref, buildAuditFilters, buildAuditHref, buildAuditWorkspaceApiHref } from './page-content';

describe('audit log page query model', () => {
  it('normalizes unsupported values to safe defaults', () => {
    expect(buildAuditFilters({ range: 'future', sort: 'random', view: 'made_up' })).toMatchObject({
      range: 'today',
      sort: 'newest',
      view: 'ALL',
    });
  });

  it('builds one bounded server workspace request from normalized filters', () => {
    const filters = buildAuditFilters({
      actorType: 'SYSTEM',
      area: 'MONEY',
      q: 'correlation-1',
      range: '7d',
      severity: 'REVIEW',
      sort: 'oldest',
      targetPrefix: 'company_bank_account:',
      view: 'money_policy',
    });
    const url = new URL(buildAuditWorkspaceApiHref(filters), 'http://admin.local');

    expect(url.pathname).toBe('/admin/audit-logs/page');
    expect(url.searchParams.get('take')).toBe('50');
    expect(url.searchParams.get('view')).toBe('MONEY_POLICY');
    expect(url.searchParams.get('range')).toBe('7d');
    expect(url.searchParams.get('sort')).toBe('oldest');
    expect(url.searchParams.get('actorType')).toBe('SYSTEM');
    expect(url.searchParams.get('area')).toBe('MONEY');
    expect(url.searchParams.get('severity')).toBe('REVIEW');
    expect(url.searchParams.get('targetPrefix')).toBe('company_bank_account:');
  });

  it('preserves cursor, evidence and compatibility target filters in shareable URLs', () => {
    const filters = buildAuditFilters({
      bucket: 'Notification',
      cursor: 'cursor-1',
      event: 'event-1',
      range: '30d',
      targetPrefix: 'company_bank_account:',
    });
    const url = new URL(buildAuditHref(filters), 'http://admin.local');

    expect(url.pathname).toBe('/audit-log');
    expect(url.searchParams.get('cursor')).toBe('cursor-1');
    expect(url.searchParams.get('event')).toBe('event-1');
    expect(url.searchParams.get('range')).toBe('30d');
    expect(url.searchParams.get('targetPrefix')).toBe('company_bank_account:');
    expect(url.searchParams.get('bucket')).toBe('Notification');
  });

  it('keeps an Operations / Policy scope on workspace, navigation and export requests', () => {
    const filters = buildAuditFilters({
      bucket: 'Operations/Policy',
      range: 'all',
      sort: 'newest',
      targetPrefix: 'finance_approver_request:request-1',
    });

    for (const href of [
      buildAuditWorkspaceApiHref(filters),
      buildAuditHref(filters),
      buildAuditExportHref(filters, 'csv'),
      buildAuditExportHref(filters, 'json'),
    ]) {
      const url = new URL(href, 'http://admin.local');
      expect(url.searchParams.get('bucket')).toBe('Operations/Policy');
      expect(url.searchParams.get('range')).toBe('all');
      expect(url.searchParams.get('sort')).toBe('newest');
      expect(url.searchParams.get('targetPrefix')).toBe('finance_approver_request:request-1');
    }
  });

  it('rejects unsafe context bucket values', () => {
    expect(buildAuditFilters({ bucket: 'Notification\r\nInjected' })).toMatchObject({ bucket: '' });
  });

  it('keeps legacy query absent instead of searching raw payload text implicitly', () => {
    expect(buildAuditFilters({ query: 'legacy raw text' })).toMatchObject({ q: '' });
  });
});
