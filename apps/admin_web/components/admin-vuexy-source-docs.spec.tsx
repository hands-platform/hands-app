import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(__dirname, '../../..');
const architectureDoc = readFileSync(
  resolve(repoRoot, 'docs/architecture/admin-vuexy-design-system.md'),
  'utf8',
);
const comparisonDoc = readFileSync(
  resolve(repoRoot, 'docs/codex/vuexy-figma-template-comparison.md'),
  'utf8',
);
const figmaReadme = readFileSync(resolve(repoRoot, 'design/figma/README.md'), 'utf8');
const gitignore = readFileSync(resolve(repoRoot, '.gitignore'), 'utf8');

const figmaSourcePath =
  'C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/design-files/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig';
const repoFigmaMirrorPath = resolve(repoRoot, 'design/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig');
const vuexyTemplatePath =
  'C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/nextjs-version/typescript-version/full-version';
const vuexyTemplateAnchors = [
  'src/@core/components/mui/TextField.tsx',
  'src/views/pages/auth/LoginV2.tsx',
  'src/views/apps/calendar/SidebarLeft.tsx',
  'src/views/apps/calendar/AddEventSidebar.tsx',
  'src/views/apps/calendar/Calendar.tsx',
] as const;

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

  it('documents why the large Figma binary is not committed as a repo-local mirror', () => {
    expect(existsSync(repoFigmaMirrorPath)).toBe(false);
    expect(gitignore).toContain('design/figma/*.fig');
    expect(figmaReadme).toContain('large binary asset');
    expect(comparisonDoc).toContain('design/figma/README.md');
    expect(comparisonDoc).toContain('about 167 MB');
    expect(comparisonDoc).toContain('Do not commit copied `.fig` files');
  });

  it('documents the verified Figma package metadata and the local Vuexy implementation anchors', () => {
    const meta = readFigmaMeta();

    expect(meta.file_name).toBe('vuexy-figma-admin-dashboard-ui-kit');
    expect(comparisonDoc).toContain('vuexy-figma-admin-dashboard-ui-kit');

    for (const anchor of vuexyTemplateAnchors) {
      expect(existsSync(`${vuexyTemplatePath}/${anchor}`)).toBe(true);
      expect(architectureDoc).toContain(anchor);
      expect(comparisonDoc).toContain(anchor);
    }
  });
});

function readFigmaMeta(): { readonly file_name?: string } {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'hands-vuexy-figma-'));

  try {
    const metaJson = execFileSync('tar', ['-xOf', figmaSourcePath, 'meta.json'], {
      cwd: tempDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(metaJson) as { readonly file_name?: string };
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}
