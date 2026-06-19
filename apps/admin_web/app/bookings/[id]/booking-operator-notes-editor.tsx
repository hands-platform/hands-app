'use client';

export function BookingOperatorNotesEditor() {
  return (
    <textarea
      aria-label="Operator note"
      className="ops-note-textarea"
      name="note"
      placeholder="Add a short operator note."
      rows={3}
    />
  );
}
