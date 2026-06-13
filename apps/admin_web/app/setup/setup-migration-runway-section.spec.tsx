import { classNamesIn, hrefsIn, textContent } from './setup-section-test-utils';
import { SetupMigrationRunwaySection } from './setup-migration-runway-section';

describe('SetupMigrationRunwaySection', () => {
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
    expect(classNamesIn(section)).toContain('command-copy-row');
    expect(hrefsIn(section)).toContain('#supabase');
  });
});
