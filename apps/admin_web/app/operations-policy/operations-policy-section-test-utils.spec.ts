import { readFileSync } from 'node:fs';

describe('operations policy section test utilities', () => {
  it('does not keep removed pill-class badge atoms in the render allowlist', () => {
    const source = readFileSync('app/operations-policy/operations-policy-section-test-utils.ts', 'utf8');

    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('PillClassBadgeLink');
  });
});
