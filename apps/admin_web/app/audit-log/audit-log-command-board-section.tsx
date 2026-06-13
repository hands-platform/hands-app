import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';

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
    <section className="card admin-mb-16">
      <AdminSectionHeader
        description="High-impact admin changes grouped by policy, money movement, dispatch state, notifications, and recent operator actions."
        status={
          <span className={`pill ${hasWarningLogs ? 'pill-warn' : 'pill-success'}`}>
            {totalLogCount} audit record(s)
          </span>
        }
        title="Audit command board"
      />
      <div className="ops-task-grid">
        {items.map((item) => (
          <Link className="ops-task-card" href={item.href} key={item.title}>
            <span className={`signal ${auditToneClass(item.tone)}`}>{auditToneLabel(item.tone)}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <div className="participant-list">
              <span className="pill">{item.status}</span>
              <span className="pill">{item.logs.length} event(s)</span>
            </div>
            {item.logs.length > 0 ? (
              <div className="stack">
                {item.logs.slice(0, 3).map((log) => (
                  <span className="muted" key={`${item.title}-${log.id}`}>
                    {log.actionLabel} / {log.shortTargetLabel} / {log.relativeTimeLabel}
                  </span>
                ))}
              </div>
            ) : null}
            <small>{item.operatorAction}</small>
          </Link>
        ))}
      </div>
    </section>
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
