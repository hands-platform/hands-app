import { hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffOperatorNotesSection } from './operations-handoff-operator-notes-section';

describe('OperationsHandoffOperatorNotesSection', () => {
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

    expect(rendered).toContain('Latest operator notes');
    expect(rendered).toContain('Owner lane');
    expect(rendered).toContain('Partner operations handoff reviewed.');
    expect(rendered).toContain('Partner document reviewed');
    expect(rendered).toContain('Ops Lead');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/audit-log', '/partners/partner-1']));
  });

  it('renders the empty state when there are no notes', () => {
    const rendered = textContent(OperationsHandoffOperatorNotesSection({ notes: [] }));

    expect(rendered).toContain('No operator note has been written yet.');
  });
});
