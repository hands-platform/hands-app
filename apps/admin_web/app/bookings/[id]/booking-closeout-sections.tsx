import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminActionCard, AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import {
  StatusBadge,
  StatusBadgeLink,
  statusBadgeToneFromPillClass,
} from '../../../components/status-badge';

type CloseoutChecklistItem = {
  title: string;
  status: string;
  detail: string;
  detailDateTimeFallback?: string | null;
  detailDateTimePrefix?: string;
  detailDateTimeSuffix?: string;
  detailDateTimeValue?: string | null;
  operatorRule: string;
  href: string;
  className: string;
  pillClass: string;
};

export type ConnectedRecordLink = {
  label: string;
  value: string;
  detail: string;
  href: string;
  tone: string;
};

export type BookingCloseoutSectionsProps = {
  bookingCloseoutChecklist: CloseoutChecklistItem[];
  connectedRecordLinks: ConnectedRecordLink[];
};

export function BookingCloseoutSections({
  bookingCloseoutChecklist,
  connectedRecordLinks,
}: BookingCloseoutSectionsProps) {
  return (
    <>
      <AdminSection
        actions={
          <div className="actions">
            <AdminTextLink href="/bookings?view=manual-decision">
              Manual decision queue
            </AdminTextLink>
            <AdminTextLink href="/finance-closeout">
              Finance closeout
            </AdminTextLink>
          </div>
        }
        className="admin-mb-16 booking-closeout-checklist-card"
        description="Final factual checklist before closeout or finance action."
        id="booking-closeout-checklist"
        title="Booking closeout checklist"
      >
        <div className="ops-task-grid admin-mt-12">
          {bookingCloseoutChecklist.map((item) => (
            <AdminActionCard
              actionLabel={item.operatorRule}
              className={item.className}
              detail={closeoutChecklistDetail(item)}
              href={item.href}
              key={item.title}
              leading={
                <StatusBadge tone={statusBadgeToneFromPillClass(item.pillClass)}>
                  {item.status}
                </StatusBadge>
              }
              title={item.title}
              variant="ops-task"
            />
          ))}
        </div>
      </AdminSection>

      <AdminSection
        actions={<StatusBadge tone="info">{connectedRecordLinks.length} links</StatusBadge>}
        className="admin-mb-16 connected-operations-records-card"
        description="Jump links to records connected to this booking."
        id="connected-operations-records"
        title="Connected operations records"
      >
        <AdminTraceSummary
          className="admin-mt-12"
          metrics={connectedRecordLinks.map((record) => ({
            action: (
              <StatusBadgeLink href={record.href} tone={statusBadgeToneFromPillClass(record.tone)}>
                Open
              </StatusBadgeLink>
            ),
            detail: record.detail,
            label: record.label,
            value: record.value,
          }))}
        />
      </AdminSection>
    </>
  );
}

function closeoutChecklistDetail(item: CloseoutChecklistItem) {
  if (!item.detailDateTimeFallback && !item.detailDateTimeValue) {
    return item.detail;
  }

  return (
    <>
      {item.detail}
      {item.detailDateTimePrefix ?? ' '}
      <DateTimeText fallback={item.detailDateTimeFallback ?? 'Not set'} value={item.detailDateTimeValue} />
      {item.detailDateTimeSuffix}
    </>
  );
}
