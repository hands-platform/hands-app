import Link from 'next/link';

import { AdminBoundedTableFooter, AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import type { AdminProvider } from '../../lib/admin-api';
import { adminAvatarStatusFromSignals } from '../../lib/admin-avatar-status';
import type { PartnerDailyActionQueue } from './partner-daily-action-queue';
import { partnerShiftPillClass } from './partner-shift-handoff';

export type PartnerChecklistWorkQueueSectionQueue = PartnerDailyActionQueue;

type PartnerChecklistWorkQueueSectionProps = {
  readonly partnerName: (provider: AdminProvider) => string;
  readonly queue: PartnerChecklistWorkQueueSectionQueue;
};

const PARTNER_CHECKLIST_QUEUE_HEADERS = [
  'Order',
  'Partner',
  'Work lane',
  'Current blocker',
  'Operator move',
  'SLA',
  'Record age',
  'Open',
] as const;

export function PartnerChecklistWorkQueueSection({
  partnerName,
  queue,
}: PartnerChecklistWorkQueueSectionProps) {
  return (
    <AdminTablePanel
      className="vuexy-partner-table-card admin-mb-16"
      description="Compact follow-up list for the current partner filter. It groups acceptance holds, withdrawal setup, location freshness, push readiness, and KYC updates so operators can process records without opening every detail page."
      id="partner-checklist-work-queue"
      resultLabel={`${queue.urgentCount} urgent`}
      resultTone={queue.urgentCount ? 'danger' : 'success'}
      title="Partner checklist work queue"
    >
      <div className="participant-list admin-mb-12">
        <StatusBadge tone={queue.blockedCount ? 'warning' : 'success'}>
          {queue.blockedCount} blocked
        </StatusBadge>
        <StatusBadge tone="info">{queue.dispatchReadyCount} dispatch-ready</StatusBadge>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table vuexy-partner-table service-trace"
          emptyMessage={<PartnerChecklistQueueEmptyState />}
          headers={PARTNER_CHECKLIST_QUEUE_HEADERS}
          rowCount={queue.rows.length}
        >
          {queue.rows.map((row, index) => (
            <tr key={`${row.provider.id}-${row.action.status}`}>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(partnerShiftPillClass(row.tone))}>
                  #{index + 1}
                </StatusBadge>
              </td>
              <td>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar is-partner"
                  avatarStatus={partnerChecklistAvatarStatus(row.provider)}
                  className="vuexy-booking-person"
                  helper={row.provider.user?.phone ?? row.provider.id}
                  href={row.href}
                  label={partnerName(row.provider)}
                  linkClassName="table-link"
                />
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
        </AdminDataTable>
      </AdminTableScroll>
      <AdminBoundedTableFooter className="vuexy-partner-table-footer" rowCount={queue.rows.length} />
    </AdminTablePanel>
  );
}

function partnerChecklistAvatarStatus(provider: AdminProvider) {
  return adminAvatarStatusFromSignals({
    devices: [...(provider.user?.pushDevices ?? []), ...(provider.devices ?? [])],
    fallbackOnline: provider.status === 'ONLINE_AVAILABLE' || provider.status === 'ONLINE_AVAILABLE_SOON',
    sessions: provider.sessions,
    working: provider.status === 'ONLINE_BUSY',
  });
}

function PartnerChecklistQueueEmptyState() {
  return (
    <AdminEmptyState
      message="The current filter has no visible blockers. Keep monitoring dispatch demand and live booking pressure."
      title="No partner work queue items"
    />
  );
}
