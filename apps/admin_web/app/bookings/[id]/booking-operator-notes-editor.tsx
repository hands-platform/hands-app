'use client';

import { AdminFormTextarea } from '../../../components/admin-form-controls';

export function BookingOperatorNotesEditor() {
  return (
    <AdminFormTextarea
      label="Operator note"
      name="note"
      placeholder="Add a short operator note."
      rows={3}
      textareaClassName="ops-note-textarea"
    />
  );
}
