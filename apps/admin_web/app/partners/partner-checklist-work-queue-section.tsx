import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';
import type { AdminProvider } from '../../lib/admin-api';
import type { PartnerDailyActionQueue } from './partner-daily-action-queue';
import { partnerShiftPillClass } from './partner-shift-handoff';

export type PartnerChecklistWorkQueueSectionQueue = PartnerDailyActionQueue;

type PartnerChecklistWorkQueueSectionProps = {
  readonly partnerName: (provider: AdminProvider) => string;
  readonly queue: PartnerChecklistWorkQueueSectionQueue;
};

export function PartnerChecklistWorkQueueSection({
  partnerName,
  queue,
}: PartnerChecklistWorkQueueSectionProps) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <AdminSectionHeader
        description="Compact follow-up list for the current partner filter. It groups acceptance holds, payout/tax gates, location freshness, push readiness, and KYC updates so operators can process records without opening every detail page."
        status={
          <div className="participant-list">
            <span className={`pill ${queue.urgentCount ? 'pill-danger' : 'pill-success'}`}>
              {queue.urgentCount} urgent
            </span>
            <span className={`pill ${queue.blockedCount ? 'pill-warn' : 'pill-success'}`}>
              {queue.blockedCount} blocked
            </span>
            <span className="pill pill-info">{queue.dispatchReadyCount} dispatch-ready</span>
          </div>
        }
        title="Partner checklist work queue"
      />
      <div style={{ marginTop: 14, overflowX: 'auto' }}>
        <table className="table service-trace">
          <thead>
            <tr>
              <th>Order</th>
              <th>Partner</th>
              <th>Work lane</th>
              <th>Current blocker</th>
              <th>Operator move</th>
              <th>SLA</th>
              <th>Record age</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {queue.rows.map((row, index) => (
              <tr key={`${row.provider.id}-${row.action.status}`}>
                <td>
                  <span className={`pill ${partnerShiftPillClass(row.tone)}`}>#{index + 1}</span>
                </td>
                <td>
                  <strong>{partnerName(row.provider)}</strong>
                  <p className="muted">{row.provider.user?.phone ?? row.provider.id}</p>
                </td>
                <td>{row.lane}</td>
                <td>
                  <strong>{row.action.status}</strong>
                  <p className="muted">{row.action.detail}</p>
                </td>
                <td>{row.action.operatorAction}</td>
                <td>{row.sla}</td>
                <td>{row.age}</td>
                <td>
                  <Link className="text-link" href={row.href}>
                    Open partner
                  </Link>
                </td>
              </tr>
            ))}
            {queue.rows.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <strong>No partner work queue items</strong>
                  <p className="muted">
                    The current filter has no visible blockers. Keep monitoring dispatch demand and live
                    booking pressure.
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
