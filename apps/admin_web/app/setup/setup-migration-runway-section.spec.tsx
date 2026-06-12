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
    expect(rendered).toContain('docs\\architecture\\operator-registration-plan.md');
    expect(hrefsIn(section)).toContain('#supabase');
  });
});

function textContent(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
