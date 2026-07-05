import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../..');
const architectureDoc = readFileSync(
  resolve(repoRoot, 'docs/architecture/admin-vuexy-design-system.md'),
  'utf8',
);
const comparisonDoc = readFileSync(
  resolve(repoRoot, 'docs/codex/vuexy-figma-template-comparison.md'),
  'utf8',
);

const figmaSourcePath =
  'C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/design-files/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig';
const vuexyTemplatePath =
  'C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/nextjs-version/typescript-version/full-version';

describe('Admin Vuexy source documentation', () => {
  it('documents the exact local Figma file and Vuexy template paths used for Admin design work', () => {
    expect(existsSync(figmaSourcePath)).toBe(true);
    expect(existsSync(vuexyTemplatePath)).toBe(true);
    expect(architectureDoc).toContain(figmaSourcePath);
    expect(architectureDoc).toContain(vuexyTemplatePath);
    expect(comparisonDoc).toContain(figmaSourcePath);
    expect(comparisonDoc).toContain(vuexyTemplatePath);
  });

  it('documents the local Figma package format so future design work uses the right source path', () => {
    const figmaHeader = readFileSync(figmaSourcePath).subarray(0, 256);

    expect(figmaHeader.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(figmaHeader.toString('utf8')).toContain('canvas.fig');
    expect(figmaHeader.toString('utf8')).toContain('fig-kiwi');
    expect(comparisonDoc).toContain('ZIP package');
    expect(comparisonDoc).toContain('fig-kiwi');
    expect(comparisonDoc).toContain('thumbnail.png');
  });
});
