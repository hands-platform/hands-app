import Link from 'next/link';
import { Save, ScrollText } from 'lucide-react';
import { AdminEmptyState } from '../../components/admin-empty-state';
import {
  AdminFormControlButton,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminSection } from '../../components/admin-surface';
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
        <Link className="button button-secondary" href="/audit-log">
          <ScrollText aria-hidden="true" size={16} />
          Open audit log
        </Link>
      }
      description="Shift, Customer, Partner, and booking notes written by admins."
      title="Latest operator notes"
    >
      <form action={addOperationsHandoffNote} className="ops-note-form admin-mb-14">
        <div className="form-grid compact-form">
          <div className="calendar-field">
            <span>Owner lane</span>
            <AdminFormSelect
              defaultValue="Shift handoff"
              label="Owner lane"
              name="owner"
              options={[
                { label: 'Shift handoff', value: 'Shift handoff' },
                { label: 'Dispatch', value: 'Dispatch' },
                { label: 'Support', value: 'Support' },
                { label: 'Partner Ops', value: 'Partner Ops' },
                { label: 'Finance', value: 'Finance' },
                { label: 'Alerts', value: 'Alerts' },
              ]}
            />
          </div>
          <div className="calendar-field">
            <span>Preset</span>
            <AdminFormSelect
              defaultValue=""
              label="Preset"
              name="preset"
              options={[
                { label: 'No preset', value: '' },
                {
                  label: 'Review live matching, chat, and cash settlement first.',
                  value: 'Next operator should review live matching, chat, and cash settlement lanes first.',
                },
                {
                  label: 'Customer support handoff reviewed.',
                  value: 'Customer support handoff: recent customer contacts and chat archives reviewed.',
                },
                {
                  label: 'Partner operations handoff reviewed.',
                  value: 'Partner operations handoff: KYC, wallet, location, and app session facts reviewed.',
                },
                {
                  label: 'Finance handoff reviewed.',
                  value: 'Finance handoff: cash debt, payout evidence, and completed closeout rows reviewed.',
                },
              ]}
            />
          </div>
        </div>
        <div className="calendar-field">
          <span>Shift note</span>
          <AdminFormTextarea
            label="Shift note"
            name="note"
            placeholder="Write the factual shift handoff note for the next operator."
          />
        </div>
        <AdminFormControlButton className="button button-primary" type="submit">
          <Save aria-hidden="true" size={16} />
          Save handoff note
        </AdminFormControlButton>
      </form>
      <div className="stack">
        {notes.slice(0, 8).map((note) => (
          <Link className="ops-signal-card" href={note.href} key={note.id}>
            <StatusBadge tone="info">{note.area}</StatusBadge>
            <strong>{note.note}</strong>
            <small>
              {note.actor} / {relativeTime(note.createdAt)}
            </small>
          </Link>
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
