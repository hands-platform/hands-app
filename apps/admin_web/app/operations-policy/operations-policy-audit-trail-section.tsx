import { ExternalLink } from 'lucide-react';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTableSection } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import { formatRelativeTime } from '../../lib/admin-format';
import type { PolicyAuditRow } from './policy-audit-rows';

type OperationsPolicyAuditTrailSectionProps = {
  readonly firstHref?: string | null;
  readonly mode?: 'operator' | 'automated_smoke' | 'legacy_unknown';
  readonly newerHref?: string | null;
  readonly nextHref?: string | null;
  readonly pageNumber?: number;
  readonly rows: readonly PolicyAuditRow[];
};

const POLICY_AUDIT_TRAIL_HEADERS = [
  'When',
  'Policy & actor',
  'Before → After',
  'Evidence',
] as const;

export function OperationsPolicyAuditTrailSection({
  firstHref,
  mode = 'operator',
  newerHref,
  nextHref,
  pageNumber = 1,
  rows,
}: OperationsPolicyAuditTrailSectionProps) {
  return (
    <AdminTableSection
      actions={
        <div className="operations-policy-audit-sources">
          <AdminFormControlLink
            aria-current={mode === 'operator' ? 'page' : undefined}
            className={mode === 'operator' ? 'button-secondary is-active' : 'button-secondary'}
            href="/operations-policy?details=audit"
          >
            Operator changes
          </AdminFormControlLink>
          <AdminFormControlLink
            aria-current={mode === 'automated_smoke' ? 'page' : undefined}
            className={mode === 'automated_smoke' ? 'button-secondary is-active' : 'button-secondary'}
            href="/operations-policy?details=audit&audit=automated_smoke"
          >
            Automated smoke
          </AdminFormControlLink>
          <AdminFormControlLink
            aria-current={mode === 'legacy_unknown' ? 'page' : undefined}
            className={mode === 'legacy_unknown' ? 'button-secondary is-active' : 'button-secondary'}
            href="/operations-policy?details=audit&audit=legacy_unknown"
          >
            Legacy / unknown
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary operations-policy-full-audit-link" href="/audit-log?bucket=Operations%2FPolicy&range=all&sort=newest">
            <ExternalLink size={16} aria-hidden="true" />
            Open full audit
          </AdminFormControlLink>
        </div>
      }
      bodyClassName="admin-table-section-body"
      className="operations-policy-audit-section admin-mb-16"
      description={
        mode === 'operator'
          ? 'Authenticated policy saves are recorded here. Automated smoke changes and restorations are available in a separate filter.'
          : mode === 'automated_smoke'
            ? 'Shows server-verified smoke changes, including the run and whether the row restored a prior value.'
            : 'Shows historical rows without trusted source metadata. These rows are not classified as operator changes.'
      }
      scrollable
      title="Recent policy audit trail"
    >
      {rows.length ? (
        <AdminTableScroll ariaLabel="Policy audit records">
          <AdminDataTable
            className="operations-policy-audit-table"
            emptyMessage={null}
            headers={POLICY_AUDIT_TRAIL_HEADERS}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>
                    {formatRelativeTime(row.createdAt, { justNow: 'Just now', includeFuture: true })}
                  </strong>
                  <p className="muted">
                    <DateTimeText value={row.createdAt} />
                  </p>
                </td>
                <td>
                  <strong>{displayOperationalWording(row.label)}</strong>
                  <p className="muted">{displayOperationalWording(row.policyContext)}</p>
                  <div className="operations-policy-audit-actor">
                    <strong>{row.actorName}</strong>
                    <StatusBadge tone={row.source === 'operator' ? 'info' : 'warning'}>
                      {row.source === 'operator'
                        ? 'Operator'
                        : row.source === 'legacy_unknown'
                          ? 'Legacy / unknown'
                          : row.restoration ? 'Smoke restore' : 'Smoke change'}
                    </StatusBadge>
                    <span className="muted">
                      {row.environment === 'unknown' ? 'Environment not recorded' : row.environment}
                      {row.runId ? ` · ${row.runId.slice(0, 8)}` : ''}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="operations-policy-audit-change">
                    <strong>{row.previousValue}</strong>
                    <span aria-hidden="true">→</span>
                    <strong>{row.value}</strong>
                    {row.restoration ? <small>Restored prior value</small> : null}
                  </div>
                </td>
                <td className="operations-policy-audit-evidence">
                  <p className="admin-m-0">{displayOperationalWording(row.reason)}</p>
                  <small>{displayOperationalWording(row.effect)}</small>
                  <AdminFormControlLink
                    aria-label={`Open evidence for ${row.label} at ${row.createdAt}`}
                    className="button-secondary"
                    href={policyAuditEvidenceHref(row.id)}
                  >
                    Open evidence
                  </AdminFormControlLink>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      ) : (
        <div className="operations-policy-audit-empty">
          <AdminEmptyState
            framed
            message={auditEmptyMessage(mode)}
            title={auditEmptyTitle(mode)}
          />
          {mode === 'operator' ? (
            <AdminFormControlLink className="button-secondary" href="/operations-policy">
              Open Policies
            </AdminFormControlLink>
          ) : null}
        </div>
      )}
      <nav aria-label="Policy audit pagination" className="operations-policy-audit-pagination">
          <span>
            {auditSourceLabel(mode)} · All recorded history · Page {pageNumber} · {nextHref ? 'Older available' : 'End of history'}
          </span>
          <div>
            {firstHref ? <AdminFormControlLink className="button-secondary" href={firstHref}>First page</AdminFormControlLink> : null}
            {newerHref ? <AdminFormControlLink className="button-secondary" href={newerHref}>Newer records</AdminFormControlLink> : null}
            {nextHref ? <AdminFormControlLink className="button-secondary" href={nextHref}>Older records</AdminFormControlLink> : null}
          </div>
      </nav>
    </AdminTableSection>
  );
}

function policyAuditEvidenceHref(eventId: string) {
  const params = new URLSearchParams({
    bucket: 'Operations/Policy',
    event: eventId,
    range: 'all',
    sort: 'newest',
  });
  return `/audit-log?${params.toString()}`;
}

function auditEmptyTitle(mode: NonNullable<OperationsPolicyAuditTrailSectionProps['mode']>) {
  if (mode === 'automated_smoke') return 'No server-verified automated smoke policy change is available.';
  if (mode === 'legacy_unknown') return 'No legacy or unclassified policy audit record is available.';
  return 'No operator policy change has been audited yet.';
}

function auditEmptyMessage(mode: NonNullable<OperationsPolicyAuditTrailSectionProps['mode']>) {
  return `${auditSourceLabel(mode)} source · All recorded history. Use Open full audit for scoped evidence search and export.`;
}

function auditSourceLabel(mode: NonNullable<OperationsPolicyAuditTrailSectionProps['mode']>) {
  if (mode === 'automated_smoke') return 'Automated smoke';
  if (mode === 'legacy_unknown') return 'Legacy / unknown';
  return 'Operator';
}
