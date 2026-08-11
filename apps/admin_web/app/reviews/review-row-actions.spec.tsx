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

  it('keeps review edit drawer visible close controls on shared Vuexy button atoms', () => {
    const source = readFileSync(join(process.cwd(), 'app/reviews/review-row-actions.tsx'), 'utf8');

    expect(source).toContain('AdminFormControlButton');
    expect(source).not.toContain('<button\n            aria-label="Close review editor"');
  });

  it('keeps review edit drawer backdrop on the shared Vuexy drawer backdrop atom', () => {
    const source = readFileSync(join(process.cwd(), 'app/reviews/review-row-actions.tsx'), 'utf8');

    expect(source).toContain('AdminDrawerBackdropButton');
    expect(source).not.toContain('<button\n        aria-label="Close review editor"');
  });

  it('keeps review edit drawer shell on the shared Vuexy drawer surface atom', () => {
    const source = readFileSync(join(process.cwd(), 'app/reviews/review-row-actions.tsx'), 'utf8');

    expect(source).toContain('AdminDrawerSurface');
    expect(source).not.toContain('<aside\n        aria-labelledby={titleId}');
    expect(source).toContain('useAdminModalFocus(drawerRef, onClose)');
    expect(source).toContain('surfaceRef={drawerRef}');
  });
});
