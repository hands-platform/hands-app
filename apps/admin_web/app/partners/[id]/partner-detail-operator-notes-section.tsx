import { addProviderOpsNote } from '../actions';

export type PartnerOperatorNoteRow = {
  readonly actorTargetLabel: string;
  readonly createdLabel: string;
  readonly id: string;
  readonly note: string;
};

type PartnerDetailOperatorNotesSectionProps = {
  readonly notes: readonly PartnerOperatorNoteRow[];
  readonly providerId: string;
  readonly totalCount: number;
};

export function PartnerDetailOperatorNotesSection({
  notes,
  providerId,
  totalCount,
}: PartnerDetailOperatorNotesSectionProps) {
  return (
    <div className="card ops-note-panel admin-mb-16" id="partner-operator-notes">
      <div className="ops-section-header">
        <div>
          <h2>Partner operator notes</h2>
          <p className="muted">
            Manual handoff notes for partner operations. Use this for factual contact, onboarding,
            settlement, service setup, and dispatch context that should appear in the audit log.
          </p>
        </div>
        <span className="pill pill-info">{totalCount} note(s)</span>
      </div>
      <div className="ops-note-history">
        {notes.length ? (
          notes.map((note) => (
            <div className="ops-note-entry" key={note.id}>
              <strong>{note.createdLabel}</strong>
              <p>{note.note}</p>
              <small className="muted">{note.actorTargetLabel}</small>
            </div>
          ))
        ) : (
          <p className="muted">No manual partner operation notes have been saved yet.</p>
        )}
      </div>
      <form action={addProviderOpsNote} className="ops-note-form">
        <input type="hidden" name="providerId" value={providerId} />
        <label>
          Quick note preset
          <select name="preset" defaultValue="">
            <option value="">Manual note only</option>
            <option value="Partner contacted; waiting for reply.">Partner contacted; waiting for reply.</option>
            <option value="Partner app session and push reachability checked.">
              Partner app session and push reachability checked.
            </option>
            <option value="Partner location refresh requested.">Partner location refresh requested.</option>
            <option value="Partner service pricing reviewed.">Partner service pricing reviewed.</option>
            <option value="Partner cash settlement or payout context reviewed.">
              Partner cash settlement or payout context reviewed.
            </option>
            <option value="Partner onboarding document follow-up requested.">
              Partner onboarding document follow-up requested.
            </option>
          </select>
        </label>
        <textarea
          name="note"
          placeholder="Example: Partner confirmed they will refresh location before receiving new requests."
        />
        <button type="submit">Save partner operation note</button>
      </form>
    </div>
  );
}
