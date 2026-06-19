'use client';

export function BookingOperatorNotesEditor() {
  return (
    <textarea
      aria-label="Operator note"
      className="ops-note-textarea"
      name="note"
      placeholder="Example: Called Partner, confirmed arrival in 15 minutes."
      rows={5}
    />
  );
}
