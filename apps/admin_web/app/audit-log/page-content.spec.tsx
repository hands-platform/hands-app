import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('audit log page content contract', () => {
  const source = readFileSync(join(process.cwd(), 'app/audit-log/page-content.tsx'), 'utf8');

  it('loads one server snapshot and never turns API failure into zero evidence', () => {
    expect(source).toContain('adminGetResult<AdminAuditWorkspaceResponse>');
    expect(source).toContain('Audit data could not be loaded. This is not an empty result.');
    expect(source).toContain('Audit access denied');
    expect(source).not.toContain('adminGet(');
  });

  it('keeps investigation controls compact and server backed', () => {
    expect(source).toContain('AdminFilterPanel');
    expect(source).toContain('AdminFilterSummary');
    expect(source).toContain('Search normalized event, object, actor, correlation, and request fields.');
    expect(source).toContain('<details className="audit-more-filters full-span">');
    expect(source).toContain('Raw payload text is not searched.');
    expect(source).toContain("params.set('take', '50')");
    expect(source).toContain("if (filters.cursor) params.set('cursor', filters.cursor)");
  });

  it('renders trust status and canonical saved views before results', () => {
    expect(source).toContain('AuditTrustStrip');
    expect(source).toContain('AuditSavedViews');
    expect(source).toContain('Review-level events');
    expect(source).toContain('Failed');
    expect(source).toContain('Unacknowledged');
    expect(source).toContain('Data lag');
    expect(source).toContain('aria-label="Saved audit views"');
  });

  it('uses Vietnam time and cursor pagination without an internal vertical table viewport', () => {
    expect(source).toContain("timezone: 'Asia/Ho_Chi_Minh'");
    expect(source).toContain('Today · Vietnam');
    expect(source).toContain('Yesterday · Vietnam');
    expect(source).toContain('Next page');
    expect(source).toContain('Previous page');
    expect(source).toContain('First page');
    expect(source).not.toContain('AdminTablePaginationFooter');
  });

  it('separates raw review signals from current open incident projection', () => {
    expect(source).toContain('Action required incidents');
    expect(source).toContain('workspace.actionableIncidents');
    expect(source).toContain('Review incident');
  });

  it('keeps advanced filters readable on wide desktop layouts', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('.audit-more-filter-grid');
    expect(css).toContain('grid-template-columns: repeat(4, minmax(180px, 1fr));');
    expect(css).toContain('grid-column: 1 / -1;');
  });

  it('opens the separate evidence detail instead of formatting raw payload in the page', () => {
    expect(source).toContain('AuditEvidenceDrawer');
    expect(source).toContain('/admin/audit-logs/events/');
    expect(source).not.toContain('JSON.stringify');
    expect(source).not.toContain('operationalDisplayText');
  });
});
