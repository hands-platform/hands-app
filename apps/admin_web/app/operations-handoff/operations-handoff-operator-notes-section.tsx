import { Save, ScrollText } from 'lucide-react';
import { AdminEmptyState } from '../../components/admin-empty-state';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGridFields,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminOpsNoteForm } from '../../components/admin-ops-note-form';
import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
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
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary" href="/audit-log">
          <ScrollText aria-hidden="true" size={16} />
          Open audit log
        </AdminFormControlLink>
      }
      description="Dated Customer, Partner, booking, finance, alert, and operations notes written by admins."
      title="Operations history notes"
    >
      <AdminOpsNoteForm action={addOperationsHandoffNote} className="admin-mb-14">
        <AdminFormGridFields className="compact-form">
          <AdminFormSelect
            defaultValue="Operations history"
            label="Owner lane"
            labelVisibility="visible"
            name="owner"
            options={[
              { label: 'Operations history', value: 'Operations history' },
              { label: 'Dispatch', value: 'Dispatch' },
              { label: 'Support', value: 'Support' },
              { label: 'Partner Ops', value: 'Partner Ops' },
              { label: 'Finance', value: 'Finance' },
              { label: 'Alerts', value: 'Alerts' },
            ]}
          />
          <AdminFormSelect
            defaultValue=""
            label="Preset"
            labelVisibility="visible"
            name="preset"
            options={[
              { label: 'No preset', value: '' },
              {
                label: 'Review matching, chat, and cash settlement history.',
                value: 'Operations history review: matching, chat, and cash settlement lanes checked.',
              },
              {
                label: 'Customer support history reviewed.',
                value: 'Customer support history: recent customer contacts and chat archives reviewed.',
              },
              {
                label: 'Partner operations history reviewed.',
                value: 'Partner operations history: KYC, wallet, location, and app session facts reviewed.',
              },
              {
                label: 'Finance history reviewed.',
                value: 'Finance history: cash debt, payout evidence, and completed closeout rows reviewed.',
              },
            ]}
          />
        </AdminFormGridFields>
        <AdminFormTextarea
          label="History note"
          labelVisibility="visible"
          name="note"
          placeholder="Write a factual operations history note for future review."
        />
        <AdminFormControlButton className="button-primary" type="submit">
          <Save aria-hidden="true" size={16} />
          Save history note
        </AdminFormControlButton>
      </AdminOpsNoteForm>
      <div className="stack">
        {notes.slice(0, 8).map((note) => (
          <AdminActionCard
            actionLabel={`${note.actor} / ${relativeTime(note.createdAt)}`}
            href={note.href}
            key={note.id}
            leading={<StatusBadge tone="info">{note.area}</StatusBadge>}
            value={note.note}
            variant="ops-signal"
          />
        ))}
        {notes.length === 0 ? <AdminEmptyState framed message="No operator note has been written yet." /> : null}
      </div>
    </AdminSection>
  );
}

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
