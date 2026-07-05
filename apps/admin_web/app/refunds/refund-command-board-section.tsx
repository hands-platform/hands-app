import { AdminActionCard } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { StatusBadge } from '../../components/status-badge';

export type RefundCommandTone = 'warn' | 'info' | 'ok';

export type RefundCommandPreview = {
  readonly amountLabel: string;
  readonly customerLabel: string;
  readonly id: string;
};

export type RefundCommandItem = {
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly refunds: readonly RefundCommandPreview[];
  readonly status: string;
  readonly title: string;
  readonly tone: RefundCommandTone;
};

type RefundCommandBoardSectionProps = {
  readonly items: readonly RefundCommandItem[];
};

export function RefundCommandBoardSection({ items }: RefundCommandBoardSectionProps) {
  const totalRefundCount = items.reduce((sum, item) => sum + item.refunds.length, 0);
  const hasOpenOperatorWork = items.some((item) => item.refunds.length > 0 && item.tone !== 'ok');

  return (
    <AdminTablePanel
      description="Keep customer refunds, payment ledger state, booking closeout, and customer messaging in one operational view before closing a shift."
      resultLabel={`${totalRefundCount} refund record(s)`}
      resultTone={hasOpenOperatorWork ? 'warning' : 'success'}
      title="Refund command board"
    >
      <div className="ops-task-grid">
        {items.map((item) => (
          <AdminActionCard
            actionLabel={item.operatorAction}
            detail={item.detail}
            href={item.href}
            key={item.title}
            signalClassName={refundToneClass(item.tone)}
            signalLabel={refundToneLabel(item.tone)}
            title={item.title}
            variant="ops-task"
          >
            <div className="participant-list">
              <StatusBadge tone={refundStatusBadgeTone(item.tone)}>{item.status}</StatusBadge>
              <StatusBadge tone="neutral">{item.refunds.length} case(s)</StatusBadge>
            </div>
            {item.refunds.length > 0 ? (
              <div className="stack">
                {item.refunds.slice(0, 3).map((refund) => (
                  <span className="muted" key={`${item.title}-${refund.id}`}>
                    {refund.id} / {refund.customerLabel} / {refund.amountLabel}
                  </span>
                ))}
              </div>
            ) : null}
          </AdminActionCard>
        ))}
      </div>
    </AdminTablePanel>
  );
}

function refundToneClass(tone: RefundCommandTone) {
  if (tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'ok') {
    return 'signal-ok';
  }
  return 'signal-info';
}

function refundToneLabel(tone: RefundCommandTone) {
  if (tone === 'warn') {
    return 'Needs operator';
  }
  if (tone === 'ok') {
    return 'Clear';
  }
  return 'Monitor';
}

function refundStatusBadgeTone(tone: RefundCommandTone) {
  if (tone === 'warn') {
    return 'warning';
  }
  if (tone === 'ok') {
    return 'success';
  }
  return 'info';
}
