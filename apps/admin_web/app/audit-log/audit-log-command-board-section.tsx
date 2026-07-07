import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

export type AuditCommandTone = 'warn' | 'info' | 'ok';

export type AuditCommandLogPreview = {
  readonly actionLabel: string;
  readonly id: string;
  readonly relativeTimeLabel: string;
  readonly shortTargetLabel: string;
};

export type AuditCommandBoardItem = {
  readonly detail: string;
  readonly href: string;
  readonly logs: readonly AuditCommandLogPreview[];
  readonly operatorAction: string;
  readonly status: string;
  readonly title: string;
  readonly tone: AuditCommandTone;
};

type AuditLogCommandBoardSectionProps = {
  readonly items: readonly AuditCommandBoardItem[];
};

export function AuditLogCommandBoardSection({ items }: AuditLogCommandBoardSectionProps) {
  const totalLogCount = items.reduce((sum, item) => sum + item.logs.length, 0);
  const hasWarningLogs = items.some((item) => item.logs.length > 0 && item.tone === 'warn');

  return (
    <AdminSection
      bodyClassName="ops-task-grid"
      className="admin-mb-16"
      description="High-impact admin changes grouped by policy, money movement, dispatch state, notifications, and recent operator actions."
      status={
        <StatusBadge tone={hasWarningLogs ? 'warning' : 'success'}>
          {totalLogCount} audit record(s)
        </StatusBadge>
      }
      title="Audit command board"
    >
      {items.map((item) => (
        <AdminActionCard
          actionLabel={item.operatorAction}
          detail={item.detail}
          href={item.href}
          key={item.title}
          signalClassName={auditToneClass(item.tone)}
          signalLabel={auditToneLabel(item.tone)}
          title={item.title}
          variant="ops-task"
        >
          <AdminFilterChipGroup ariaLabel={`${item.title} audit status`}>
            <StatusBadge tone="neutral">{item.status}</StatusBadge>
            <StatusBadge tone="neutral">{item.logs.length} event(s)</StatusBadge>
          </AdminFilterChipGroup>
          {item.logs.length > 0 ? (
            <div className="stack">
              {item.logs.slice(0, 3).map((log) => (
                <span className="muted" key={`${item.title}-${log.id}`}>
                  {log.actionLabel} / {log.shortTargetLabel} / {log.relativeTimeLabel}
                </span>
              ))}
            </div>
          ) : null}
        </AdminActionCard>
      ))}
    </AdminSection>
  );
}

function auditToneClass(tone: AuditCommandTone) {
  if (tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'ok') {
    return 'signal-ok';
  }
  return 'signal-info';
}

function auditToneLabel(tone: AuditCommandTone) {
  if (tone === 'warn') {
    return 'Review';
  }
  if (tone === 'ok') {
    return 'Clear';
  }
  return 'Monitor';
}
