import { ExternalLink, FileSearch } from 'lucide-react';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import type { AdminAuditEventView } from '../../lib/admin-api';
import { formatRelativeTime } from '../../lib/admin-format';

export function AuditLogTableSection({
  evidenceHref,
  items,
}: {
  readonly evidenceHref: (eventId: string) => string;
  readonly items: readonly AdminAuditEventView[];
}) {
  return (
    <AdminTableScroll ariaLabel="Audit investigation results" className="audit-investigation-table-scroll">
      <AdminDataTable
        className="audit-investigation-table"
        emptyMessage="No events match these filters. Change a filter or date range to continue the investigation."
        headers={['Time & actor', 'Event / outcome', 'Object', 'Change summary', 'Open']}
        rowCount={items.length}
      >
        {items.map((event) => (
          <tr key={event.id}>
            <td className="audit-time-actor-cell">
              <DateTimeText value={event.occurredAt} />
              <span className="audit-relative-time">{formatRelativeTime(event.occurredAt)} · ICT</span>
              <strong>{event.actor.labelSnapshot}</strong>
              <span>{actorTypeLabel(event.actor.type)} · {shortId(event.actor.key ?? event.id)}</span>
              {event.actor.attribution === 'LEGACY_INFERRED' ? (
                <span className="audit-legacy-attribution">Legacy attribution uncertain</span>
              ) : null}
            </td>
            <td className="audit-event-cell">
              <strong>{event.eventLabel}</strong>
              <span className="audit-event-type">{event.eventType}</span>
              <div className="audit-row-badges">
                <StatusBadge tone={outcomeTone(event.outcome)}>{event.outcome}</StatusBadge>
                <StatusBadge tone={severityTone(event.severity)}>{event.severity}</StatusBadge>
                <StatusBadge tone="neutral">{event.area}</StatusBadge>
              </div>
            </td>
            <td className="audit-object-cell">
              <strong>{event.object.labelSnapshot}</strong>
              <span>{event.object.type} · {shortId(event.object.id)}</span>
            </td>
            <td className="audit-change-cell">
              <strong>{event.changeSummary}</strong>
              {event.reason?.code ? <span>Reason · {event.reason.code}</span> : null}
              {event.context.correlationId ? (
                <span>Correlation · {shortId(event.context.correlationId)}</span>
              ) : null}
            </td>
            <td className="audit-open-cell">
              <AdminFormControlLink
                aria-label={`Open evidence for ${event.eventLabel}, ${event.object.labelSnapshot}, ${shortId(event.id)}`}
                className="button-secondary audit-evidence-trigger"
                href={evidenceHref(event.id)}
              >
                <FileSearch aria-hidden="true" size={16} />
                Evidence
              </AdminFormControlLink>
              {event.related ? (
                <AdminFormControlLink className="button-plain audit-related-link" href={event.related.href}>
                  {event.related.label}
                  <ExternalLink aria-hidden="true" size={14} />
                </AdminFormControlLink>
              ) : null}
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTableScroll>
  );
}

function shortId(value: string) {
  return value.length > 15 ? `${value.slice(0, 9)}…${value.slice(-4)}` : value;
}

function actorTypeLabel(type: AdminAuditEventView['actor']['type']) {
  if (type === 'HUMAN') return 'Human';
  if (type === 'SYSTEM') return 'System';
  if (type === 'SERVICE') return 'Service';
  return 'Unknown actor';
}

function severityTone(severity: AdminAuditEventView['severity']) {
  if (severity === 'CRITICAL') return 'danger' as const;
  if (severity === 'REVIEW') return 'warning' as const;
  if (severity === 'NOTICE') return 'info' as const;
  return 'neutral' as const;
}

function outcomeTone(outcome: AdminAuditEventView['outcome']) {
  if (outcome === 'FAILED' || outcome === 'DENIED') return 'danger' as const;
  if (outcome === 'OPENED') return 'warning' as const;
  if (outcome === 'SUCCEEDED' || outcome === 'RESOLVED') return 'success' as const;
  return 'neutral' as const;
}
