import { readFileSync } from 'node:fs';

import { PartnerDetailOperatorNotesSection } from './partner-detail-operator-notes-section';

describe('PartnerDetailOperatorNotesSection', () => {
  it('uses the shared Vuexy badge atom for note count', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-operator-notes-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).toContain('service context');
    expect(source).not.toContain('service setup');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<div className="ops-section-header">');
    expect(source).not.toContain('<div className="card ops-note-panel admin-mb-16"');
    expect(source).not.toContain('<span className="pill pill-info">{totalCount} note(s)</span>');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly createdLabel: string;');
    expect(source).not.toContain('<strong>{note.createdLabel}</strong>');
    expect(pageSource).not.toContain('createdLabel: formatDate(log.createdAt)');
  });

  it('renders partner operation notes and the note form', () => {
    const section = PartnerDetailOperatorNotesSection({
      notes: [
        {
          actorTargetLabel: 'Admin Hoa',
          createdAt: '2026-06-20T10:00:00.000Z',
          id: 'note-1',
          note: 'Partner location refresh requested.',
        },
      ],
      providerId: 'partner-1',
      totalCount: 1,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner operator notes');
    expect(rendered).toContain('1 note(s)');
    expect(rendered).toContain('Partner location refresh requested.');
    expect(rendered).toContain('Quick note preset');
    expect(rendered).toContain('Partner operation note');
    expect(rendered).toContain('Save partner operation note');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['card admin-card ops-note-panel admin-mb-16', 'pill pill-info']),
    );
  });

  it('renders empty partner operation notes with the shared Vuexy empty state', () => {
    const section = PartnerDetailOperatorNotesSection({
      notes: [],
      providerId: 'partner-1',
      totalCount: 0,
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No manual partner operation notes have been saved yet.');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['empty-state']));
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
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

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
