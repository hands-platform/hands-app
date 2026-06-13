import { classNamesIn, textContent } from './setup-section-test-utils';
import { SetupProgressControlSection } from './setup-progress-control-section';

describe('SetupProgressControlSection', () => {
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

    expect(section.type).toBe('section');
    expect(rendered).toContain('Master progress control');
    expect(rendered).toContain('Roadmap locked');
    expect(rendered).toContain('Stabilize core');
    expect(rendered).toContain('Verified baseline');
    expect(rendered).toContain('2 checks');
    expect(rendered).toContain('npm.cmd run typecheck');
    expect(classNamesIn(section)).toContain('command-copy-row');
    expect(rendered).toContain('docs\\architecture\\master-progress-roadmap.md');
  });
});
