import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './setup-section-test-utils';
import { SetupMigrationRunwaySection } from './setup-migration-runway-section';

describe('SetupMigrationRunwaySection', () => {
  it('uses the shared Vuexy stage item link atom for migration stage anchors', () => {
    const source = readFileSync(new URL('./setup-migration-runway-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminStageList');
    expect(source).toContain('AdminStageItemLink');
    expect(source).not.toContain('<div className="setup-stage-list">');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('<a className="setup-stage-item"');
  });

  it('renders migration stages and operator handoff files', () => {
    const section = SetupMigrationRunwaySection({
      groupStatuses: [
        {
          id: 'supabase',
          title: 'Supabase core database',
          phase: 'Staging foundation',
          status: 'Ready',
        },
      ],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Migration runway');
    expect(rendered).toContain('Stage 1');
    expect(rendered).toContain('Staging foundation');
    expect(rendered).toContain('Supabase core database');
    expect(rendered).toContain('Operator handoff files');
    expect(rendered).toContain('C:\\dev\\massage-on-demand-vn');
    expect(rendered).toContain('docs\\architecture\\operator-registration-plan.md');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section',
        'ops-section-header admin-section-header',
      ]),
    );
    expect(classNamesIn(section)).toContain('command-copy-row');
    expect(hrefsIn(section)).toContain('#supabase');
  });
});
