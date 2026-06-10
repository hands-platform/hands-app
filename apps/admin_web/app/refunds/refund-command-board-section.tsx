import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';

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
    <section className="card" style={{ marginBottom: 16 }}>
      <AdminSectionHeader
        description="Keep customer refunds, payment ledger state, booking closeout, and customer messaging in one operational view before closing a shift."
        status={
          <span className={`pill ${hasOpenOperatorWork ? 'pill-warn' : 'pill-success'}`}>
            {totalRefundCount} refund record(s)
          </span>
        }
        title="Refund command board"
      />
      <div className="ops-task-grid">
        {items.map((item) => (
          <Link className="ops-task-card" href={item.href} key={item.title}>
            <span className={`signal ${refundToneClass(item.tone)}`}>{refundToneLabel(item.tone)}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <div className="participant-list">
              <span className="pill">{item.status}</span>
              <span className="pill">{item.refunds.length} case(s)</span>
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
            <small>{item.operatorAction}</small>
          </Link>
        ))}
      </div>
    </section>
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
