import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ReviewRowActions Vuexy action menu usage', () => {
  it('keeps review row action menus on the shared client dropdown atom', () => {
    const source = readFileSync(join(process.cwd(), 'app/reviews/review-row-actions.tsx'), 'utf8');

    expect(source).toContain('ClientActionDropdown');
    expect(source).not.toContain('admin-action-dropdown vuexy-review-action-dropdown');
    expect(source).not.toContain('admin-action-trigger vuexy-review-action-trigger');
    expect(source).not.toContain('admin-action-menu vuexy-review-action-menu');
  });
});
