import { readFileSync } from 'node:fs';

describe('Tax Policy client interaction contracts', () => {
  it('associates helper and error messages with their fields and focuses the first invalid field', () => {
    const source = readFileSync(new URL('./tax-policy-action-form.tsx', import.meta.url), 'utf8');

    expect(source).toContain('data-tax-policy-field-message={name}');
    expect(source).toContain("field.setAttribute('aria-describedby', [...describedBy].join(' '))");
    expect(source).toContain("field.setAttribute('aria-invalid', 'true')");
    expect(source).toContain("target.focus({ preventScroll: true })");
  });

  it('restores hash focus after query navigation and same-page hash changes', () => {
    const source = readFileSync(new URL('./tax-policy-hash-focus.tsx', import.meta.url), 'utf8');

    expect(source).toContain('usePathname()');
    expect(source).toContain('useSearchParams()?.toString()');
    expect(source).toContain("window.addEventListener('hashchange', focusTarget)");
    expect(source).toContain('target.scrollIntoView');
    expect(source).toContain('target.focus({ preventScroll: true })');
  });
});
