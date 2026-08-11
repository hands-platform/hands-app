import { ScrollText } from 'lucide-react';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { formatRelativeTime } from '../../lib/admin-format';
import type { OperatorNoteRow } from './operations-handoff-operator-notes';

type OperationsHandoffOperatorNotesSectionProps = {
  readonly notes: readonly OperatorNoteRow[];
};

export function OperationsHandoffOperatorNotesSection({ notes }: OperationsHandoffOperatorNotesSectionProps) {
  return (
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary" href="/audit-log">
          <ScrollText aria-hidden="true" size={16} />
          Open audit log
        </AdminFormControlLink>
      }
      description="Read-only Customer, Partner, booking, finance, alert, and operations notes written by admins."
      title="Operator notes archive"
    >
      <div className="stack">
        {notes.slice(0, 8).map((note) => (
          <AdminActionCard
            actionLabel="Open related record"
            detail={note.note}
            href={note.href}
            key={note.id}
            leading={<StatusBadge tone="info">{note.area}</StatusBadge>}
            signalClassName="signal-info"
            signalLabel={note.actor}
            title={`${note.area} note`}
            variant="ops-signal"
          >
            <AdminFilterChipGroup>
              <StatusBadge tone="neutral">Created {relativeTime(note.createdAt)}</StatusBadge>
              <StatusBadge tone="neutral">Last changed {relativeTime(note.createdAt)}</StatusBadge>
            </AdminFilterChipGroup>
          </AdminActionCard>
        ))}
        {notes.length === 0 ? (
          <AdminEmptyState framed message="No operator note has been written yet." />
        ) : null}
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
