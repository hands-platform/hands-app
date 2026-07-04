import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('audit log page content', () => {
  it('uses the shared StatusBadge atom for audit record status chips', () => {
    const source = readFileSync(join(process.cwd(), 'app/audit-log/page-content.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-success">Newest first</span>');
    expect(source).not.toContain('<span className="pill pill-info">Action grouped</span>');
    expect(source).not.toContain('<span className="pill pill-warn">Metadata preview</span>');
  });
});
