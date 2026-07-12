import type { AdminAuditLog } from '../../lib/admin-api';
import { partnerDisplayText as operatorDisplayText } from '../../lib/admin-copy';
import { asRecord, humanizeAction, relatedHref, stringValue } from './operations-handoff-activity-stream';

export function buildOperatorNotes(logs: readonly AdminAuditLog[]) {
  return logs
    .filter((log) => log.action.endsWith('.ops_note.add') || log.action === 'operations.handoff_note.add')
    .map((log) => {
      const metadata = asRecord(log.metadata);
      const area =
        log.action === 'operations.handoff_note.add'
          ? 'History'
          : log.action.startsWith('booking')
            ? 'Booking'
            : log.action.startsWith('customer')
              ? 'Customer'
              : 'Partner';
      return {
        id: log.id,
        area,
        note: operatorDisplayText(
          stringValue(metadata.note) ?? stringValue(metadata.preset) ?? humanizeAction(log.action),
        ),
        href: relatedHref(log),
        actor: log.actor?.fullName ?? log.actor?.phone ?? 'System',
        createdAt: log.createdAt,
      };
    });
}

export type OperatorNoteRow = ReturnType<typeof buildOperatorNotes>[number];
