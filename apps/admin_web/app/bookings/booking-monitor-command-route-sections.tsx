import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import { shortId } from '../../lib/admin-format';
import type { BookingCommandRouteCard } from '../../lib/booking-command-route-cards';
import type { BookingPrimaryCommandSummaryItem } from '../../lib/booking-primary-command-summary';

type BookingMonitorCommandRouteSectionsProps = {
  readonly autoRefresh: boolean;
  readonly commandSummaryCards: readonly BookingCommandRouteCard[];
  readonly hasMounted: boolean;
  readonly isPending: boolean;
  readonly lastRefreshLabel: string;
  readonly primaryCommandQueue: readonly BookingPrimaryCommandSummaryItem[];
};

const COMMAND_SUMMARY_TABLE_HEADERS = ['Lane', 'Value', 'Owner', 'Action'] as const;

const PRIMARY_COMMAND_QUEUE_TABLE_HEADERS = [
  'Status',
  'Bookings',
  'Primary Action',
  'Sample Bookings',
] as const;

export function BookingMonitorCommandRouteSections({
  autoRefresh,
  commandSummaryCards,
  hasMounted,
  isPending,
  lastRefreshLabel,
  primaryCommandQueue,
}: BookingMonitorCommandRouteSectionsProps) {
  const visibleCommandSummaryCards = commandSummaryCards.filter(isVisibleCommandSummaryCard);
  const visiblePrimaryCommandQueue = primaryCommandQueue.filter(isVisiblePrimaryCommandQueueItem);
  const visiblePrimaryCommandCount = visiblePrimaryCommandQueue.reduce(
    (total, item) => total + item.count,
    0,
  );

  return (
    <AdminSection
      actions={
        <StatusBadge tone="info">
          {autoRefresh ? 'Auto refresh on' : 'Auto refresh paused'} /{' '}
          {isPending ? 'refreshing' : `last ${hasMounted ? lastRefreshLabel : 'pending'}`}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Live queue health and operator lanes before table review."
      title="Booking operations command summary"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table admin-mt-14"
          emptyMessage="No command summary lanes need review."
          headers={COMMAND_SUMMARY_TABLE_HEADERS}
          rowCount={visibleCommandSummaryCards.length}
        >
          {visibleCommandSummaryCards.map((item) => (
            <tr key={item.label}>
              <td>
                <AdminTextLink href={item.href}>
                  {item.label}
                </AdminTextLink>
                <div className="muted">{item.detail}</div>
              </td>
              <td>
                <strong>{item.value}</strong>
              </td>
              <td>
                <StatusBadge tone="neutral">{item.owner}</StatusBadge>
              </td>
              <td>
                <span className="muted">{item.action}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminSectionHeader
        description="Open the lane that needs action; detailed evidence stays in booking detail."
        status={<StatusBadge tone="info">{visiblePrimaryCommandCount} booking(s)</StatusBadge>}
        title="Primary command queue"
      />
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table admin-mt-12"
          emptyMessage="No primary command lanes need action."
          headers={PRIMARY_COMMAND_QUEUE_TABLE_HEADERS}
          rowCount={visiblePrimaryCommandQueue.length}
        >
          {visiblePrimaryCommandQueue.map((item) => (
            <tr key={`${item.status}-${item.primaryAction}`}>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(item.tone)}>{item.status}</StatusBadge>
              </td>
              <td>
                <AdminTextLink href={item.href}>
                  {item.count} booking(s)
                </AdminTextLink>
              </td>
              <td>
                <strong>{item.primaryAction}</strong>
                <div className="muted">{item.detail}</div>
              </td>
              <td>
                <div className="participant-list">
                  {item.sampleBookingIds.map((bookingId) => (
                    <StatusBadge tone="neutral" key={bookingId}>
                      {shortId(bookingId)}
                    </StatusBadge>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

function isVisibleCommandSummaryCard(item: BookingCommandRouteCard): boolean {
  if (item.label === 'Current lane') {
    return true;
  }

  return !['0', 'Clear', 'Ready', 'Stable'].includes(item.value);
}

function isVisiblePrimaryCommandQueueItem(item: BookingPrimaryCommandSummaryItem): boolean {
  return item.tone === 'pill-danger' || item.tone === 'pill-info' || item.tone === 'pill-warn';
}
