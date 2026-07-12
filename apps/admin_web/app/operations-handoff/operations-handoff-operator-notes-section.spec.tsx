import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffOperatorNotesSection } from './operations-handoff-operator-notes-section';

describe('OperationsHandoffOperatorNotesSection', () => {
  it('uses shared Vuexy badge atoms for operator note labels', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-operator-notes-section.tsx', 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{note.area}</span>');
    expect(source).not.toContain('<Link className="ops-signal-card"');
    expect(source).not.toContain('className="ops-signal-card"');
    expect(source).toContain('variant="ops-signal"');
  });

  it('uses the shared AdminFormControlLink atom for audit actions', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-operator-notes-section.tsx', 'utf8');

    expect(source).toContain('AdminFormControlLink');
    expect(source).not.toContain('<Link className="button button-secondary"');
  });

  it('renders the note form, latest notes, and audit links', () => {
    const section = OperationsHandoffOperatorNotesSection({
      notes: [
        {
          actor: 'Ops Lead',
          area: 'Partner',
          createdAt: '2026-06-14T00:00:00.000Z',
          href: '/partners/partner-1',
          id: 'note-1',
          note: 'Partner document reviewed',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Operations history notes');
    expect(rendered).toContain('Owner lane');
    expect(rendered).toContain('Partner operations history reviewed.');
    expect(rendered).toContain('Save history note');
    expect(rendered).toContain('Partner document reviewed');
    expect(rendered).toContain('Ops Lead');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section',
        'ops-section-header admin-section-header',
        'ops-task-card ops-signal-card',
      ]),
    );
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/audit-log', '/partners/partner-1']));
  });

  it('uses shared admin form controls for the note form', () => {
    const section = OperationsHandoffOperatorNotesSection({ notes: [] });
    const classNames = classNamesIn(section);

    expect(classNames).toContain('admin-form-select admin-form-control-labeled');
    expect(classNames).toContain('admin-form-textarea admin-form-control-labeled');
    expect(classNames).toContain('admin-form-control-button button button-primary');
    expect(classNames).not.toContain('calendar-field');
  });

  it('renders the empty state when there are no notes', () => {
    const section = OperationsHandoffOperatorNotesSection({ notes: [] });
    const rendered = textContent(section);

    expect(rendered).toContain('No operator note has been written yet.');
    expect(classNamesIn(section)).toContain('empty-state');
  });
});
