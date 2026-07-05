import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('audit log page content', () => {
  const source = readFileSync(join(process.cwd(), 'app/audit-log/page-content.tsx'), 'utf8');

  it('uses the shared StatusBadge atom for audit record status chips', () => {
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-success">Newest first</span>');
    expect(source).not.toContain('<span className="pill pill-info">Action grouped</span>');
    expect(source).not.toContain('<span className="pill pill-warn">Metadata preview</span>');
  });

  it('uses shared directory filter atoms instead of calendar field classes', () => {
    expect(source).toContain('className="admin-directory-filter-search"');
    expect(source).toContain('className="admin-directory-filter-select"');
    expect(source).not.toContain('className="calendar-field"');
  });

  it('uses the shared table pagination footer for audit records', () => {
    expect(source).toContain('AdminTableSection');
    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).toContain('ariaLabel="Audit log pagination"');
    expect(source).not.toContain('className="vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('import { AdminRoundedPagination }');
    expect(source).not.toContain('<AdminRoundedPagination');
  });
});
