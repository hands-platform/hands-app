import Link from 'next/link';
import { formatRelativeTime } from '../../lib/admin-format';
import { addOperationsHandoffNote } from './actions';
import type { OperatorNoteRow } from './operations-handoff-operator-notes';

type OperationsHandoffOperatorNotesSectionProps = {
  readonly notes: readonly OperatorNoteRow[];
};

export function OperationsHandoffOperatorNotesSection({
  notes,
}: OperationsHandoffOperatorNotesSectionProps) {
  return (
    <div className="card">
      <div className="toolbar">
        <div>
          <h2>Latest operator notes</h2>
          <p className="muted">Shift, Customer, Partner, and booking notes written by admins.</p>
        </div>
        <Link className="text-link" href="/audit-log">
          Open audit log
        </Link>
      </div>
      <form action={addOperationsHandoffNote} className="ops-note-form admin-mb-14">
        <div className="form-grid compact-form">
          <label>
            Owner lane
            <select name="owner" defaultValue="Shift handoff">
              <option value="Shift handoff">Shift handoff</option>
              <option value="Dispatch">Dispatch</option>
              <option value="Support">Support</option>
              <option value="Partner Ops">Partner Ops</option>
              <option value="Finance">Finance</option>
              <option value="Alerts">Alerts</option>
            </select>
          </label>
          <label>
            Preset
            <select name="preset" defaultValue="">
              <option value="">No preset</option>
              <option value="Next operator should review live matching, chat, and cash settlement lanes first.">
                Review live matching, chat, and cash settlement first.
              </option>
              <option value="Customer support handoff: recent customer contacts and chat archives reviewed.">
                Customer support handoff reviewed.
              </option>
              <option value="Partner operations handoff: KYC, wallet, location, and app session facts reviewed.">
                Partner operations handoff reviewed.
              </option>
              <option value="Finance handoff: cash debt, payout evidence, and completed closeout rows reviewed.">
                Finance handoff reviewed.
              </option>
            </select>
          </label>
        </div>
        <label>
          Shift note
          <textarea
            name="note"
            placeholder="Write the factual shift handoff note for the next operator."
          />
        </label>
        <button type="submit">Save handoff note</button>
      </form>
      <div className="stack">
        {notes.slice(0, 8).map((note) => (
          <Link className="ops-signal-card" href={note.href} key={note.id}>
            <span className="pill pill-info">{note.area}</span>
            <strong>{note.note}</strong>
            <small>
              {note.actor} / {relativeTime(note.createdAt)}
            </small>
          </Link>
        ))}
        {notes.length === 0 ? <p className="muted">No operator note has been written yet.</p> : null}
      </div>
    </div>
  );
}

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
