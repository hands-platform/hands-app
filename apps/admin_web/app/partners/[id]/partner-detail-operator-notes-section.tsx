import { Save } from 'lucide-react';

import { AdminEmptyState } from '../../../components/admin-empty-state';
import {
  AdminFormControlButton,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminOpsNoteForm } from '../../../components/admin-ops-note-form';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminCard } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import { addProviderOpsNote } from '../actions';

const PARTNER_NOTE_PRESET_OPTIONS = [
  { label: 'Manual note only', value: '' },
  { label: 'Partner contacted; waiting for reply.', value: 'Partner contacted; waiting for reply.' },
  {
    label: 'Partner app session and push reachability checked.',
    value: 'Partner app session and push reachability checked.',
  },
  { label: 'Partner location refresh requested.', value: 'Partner location refresh requested.' },
  { label: 'Partner service pricing reviewed.', value: 'Partner service pricing reviewed.' },
  {
    label: 'Partner cash settlement or payout context reviewed.',
    value: 'Partner cash settlement or payout context reviewed.',
  },
  {
    label: 'Partner onboarding document follow-up requested.',
    value: 'Partner onboarding document follow-up requested.',
  },
];

export type PartnerOperatorNoteRow = {
  readonly actorTargetLabel: string;
  readonly createdAt?: string | null;
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
    <AdminCard className="ops-note-panel admin-mb-16" id="partner-operator-notes">
      <AdminSectionHeader
        actions={<StatusBadge tone="info">{totalCount} note(s)</StatusBadge>}
        description="Manual handoff notes for partner operations. Use this for factual contact, onboarding, settlement, service context, and dispatch context that should appear in the audit log."
        title="Partner operator notes"
      />
      <div className="ops-note-history">
        {notes.length ? (
          notes.map((note) => (
            <div className="ops-note-entry" key={note.id}>
              <strong>
                <DateTimeText fallback="Missing" value={note.createdAt} />
              </strong>
              <p>{note.note}</p>
              <small className="muted">{note.actorTargetLabel}</small>
            </div>
          ))
        ) : (
          <AdminEmptyState
            framed
            message="No manual partner operation notes have been saved yet."
            title={null}
          />
        )}
      </div>
      <AdminOpsNoteForm action={addProviderOpsNote}>
        <input type="hidden" name="providerId" value={providerId} />
        <AdminFormSelect
          className="partner-note-preset"
          defaultValue=""
          label="Quick note preset"
          name="preset"
          options={PARTNER_NOTE_PRESET_OPTIONS}
        />
        <AdminFormTextarea
          className="partner-note-textarea"
          label="Partner operation note"
          name="note"
          placeholder="Example: Partner confirmed they will refresh location before receiving new requests."
        />
        <AdminFormControlButton className="partner-note-submit">
          <Save aria-hidden="true" size={16} />
          Save partner operation note
        </AdminFormControlButton>
      </AdminOpsNoteForm>
    </AdminCard>
  );
}
