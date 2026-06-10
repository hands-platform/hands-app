import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable } from '../../components/admin-data-table';

export type CouponTableRow = {
  readonly actions: readonly ActionMenuItem[];
  readonly checkoutHint: string;
  readonly code: string;
  readonly description: string;
  readonly discountLabel: string;
  readonly id: string;
  readonly lowerCode: string;
  readonly opsHint: string;
  readonly statusClassName: string;
  readonly statusLabel: string;
  readonly windowLabel: string;
  readonly windowSignal: string;
};

type CouponsTableSectionProps = {
  readonly liveCount: number;
  readonly pausedCount: number;
  readonly reviewCount: number;
  readonly rows: readonly CouponTableRow[];
  readonly scheduledCount: number;
};

export function CouponsTableSection({
  liveCount,
  pausedCount,
  reviewCount,
  rows,
  scheduledCount,
}: CouponsTableSectionProps) {
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="ops-section-header">
        <div>
          <h2>Checkout Campaigns</h2>
          <p className="muted">Use this board to confirm which codes are safe to expose in the customer booking flow.</p>
        </div>
        <div className="participant-list">
          <span className="pill pill-success">{liveCount} live</span>
          <span className="pill pill-info">{scheduledCount} scheduled</span>
          <span className="pill pill-warn">{reviewCount} review</span>
          <span className="pill">{pausedCount} paused</span>
        </div>
      </div>
      <AdminDataTable
        emptyMessage="No coupons loaded."
        headers={['Code', 'Description', 'Discount', 'Status', 'Window', 'Ops hint', 'Action']}
        rowCount={rows.length}
      >
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <strong>{row.code}</strong>
              <div className="muted">
                Customer can enter {row.lowerCode} or {row.code}
              </div>
            </td>
            <td>{row.description}</td>
            <td>{row.discountLabel}</td>
            <td>
              <span className={row.statusClassName}>{row.statusLabel}</span>
              <div style={{ color: '#6b7280', fontSize: 12 }}>{row.windowSignal}</div>
            </td>
            <td>{row.windowLabel}</td>
            <td>
              <div>{row.opsHint}</div>
              <div className="muted" style={{ marginTop: 6 }}>
                {row.checkoutHint}
              </div>
            </td>
            <td>
              <ActionMenu actions={row.actions} label={`${row.code} coupon actions`} />
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </section>
  );
}
