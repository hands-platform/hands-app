import { readFileSync } from 'node:fs';

import { classNamesIn, textContent } from './setup-section-test-utils';
import { SetupProgressControlSection } from './setup-progress-control-section';

describe('SetupProgressControlSection', () => {
  it('uses the shared AdminSignal atom for setup action chips', () => {
    const source = readFileSync(new URL('./setup-progress-control-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminSignal');
    expect(source).toContain('AdminDetailGrid');
    expect(source).not.toContain('<span className="signal signal-info">');
    expect(source).not.toContain('<span className="signal signal-ok">');
    expect(source).not.toContain('<section className="detail-grid admin-mb-16"');
  });

  it('renders the progress sequence and verified baseline commands', () => {
    const section = SetupProgressControlSection({
      sequence: [
        {
          phase: 'Phase 1',
          title: 'Stabilize core',
          detail: 'Keep the current production path stable.',
          status: 'In progress',
        },
      ],
      verifiedBaseline: ['npm.cmd run typecheck', 'npm.cmd run test'],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(section.type.name).toBe('AdminDetailGrid');
    expect(rendered).toContain('Master progress control');
    expect(rendered).toContain('Roadmap locked');
    expect(rendered).toContain('Stabilize core');
    expect(rendered).toContain('Verified baseline');
    expect(rendered).toContain('2 checks');
    expect(rendered).toContain('npm.cmd run typecheck');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section',
        'ops-section-header admin-section-header',
      ]),
    );
    expect(classNamesIn(section)).toContain('command-copy-row');
    expect(rendered).toContain('docs\\architecture\\master-progress-roadmap.md');
  });
});
