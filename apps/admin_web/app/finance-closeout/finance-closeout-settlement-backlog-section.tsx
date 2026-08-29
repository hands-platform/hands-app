import type { AdminBookingSettlementGap } from '../../lib/admin-api';
import { formatDateTime, formatRelativeAge } from '../../lib/admin-format';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableSubstack,
} from '../../components/admin-data-table';
import { AdminTableSection } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { AdminFormControlStack } from '../../components/admin-form-controls';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import {
  FinanceCloseoutSettlementSelectionAction,
  FinanceCloseoutSettlementSelectionCheckbox,
  FinanceCloseoutSettlementSelectionForm,
} from './finance-closeout-settlement-selection-controls';

type SettlementBacklogPagination = {
  readonly from: number;
  readonly page: number;
  readonly pageSize: number;
  readonly to: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

type FinanceCloseoutSettlementBacklogSectionProps = {
  readonly hrefForPage: (page: number) => string;
  readonly hrefForRepair: (bookingId: string) => string;
  readonly pagination: SettlementBacklogPagination;
  readonly reviewFormState: {
    readonly q: string;
    readonly range: string;
    readonly settlementAge: string;
    readonly settlementPage: number;
    readonly settlementPaymentMethod: string;
    readonly settlementPeriod: string;
    readonly settlementTrack: string;
  };
  readonly rows: readonly AdminBookingSettlementGap[];
};

export function FinanceCloseoutSettlementBacklogSection({
  hrefForPage,
  hrefForRepair,
  pagination,
  reviewFormState,
  rows,
}: FinanceCloseoutSettlementBacklogSectionProps) {
  return (
    <FinanceCloseoutSettlementSelectionForm formState={reviewFormState}>
      <AdminTableSection
        actions={
          <AdminFormControlStack>
            <FinanceCloseoutSettlementSelectionAction />
            <AdminTextLink href="/finance-tax/booking-settlement-audit">
              Open settlement records
            </AdminTextLink>
          </AdminFormControlStack>
        }
        bodyClassName="admin-table-section-body"
        description="Completed bookings without a settlement snapshot, ordered oldest first. Select up to 10 visible rows for a read-only eligibility comparison, or open one governed repair flow."
        id="settlement-repair-backlog"
        scrollable
        title="Settlement backlog"
      >
        <AdminDataTable
          className="finance-closeout-settlement-table"
          emptyMessage="No settlement gaps match this queue."
          headers={[
            'Select',
            'Booking / parties',
            'Gap age',
            'Payment',
            'Repair track / earning',
            'Next action',
          ]}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <FinanceCloseoutSettlementSelectionCheckbox bookingId={row.id} />
              </td>
              <td>
                <AdminTableSubstack>
                  <AdminTextLink
                    href={`/bookings/${encodeURIComponent(row.id)}`}
                    title={row.id}
                  >
                    {shortBookingId(row.id)}
                  </AdminTextLink>
                  <span className="muted">Completed / snapshot missing</span>
                  <span>Customer · {customerLabel(row)}</span>
                  <span>Partner · {partnerLabel(row)}</span>
                </AdminTableSubstack>
              </td>
              <td>
                <AdminTableSubstack>
                  <StatusBadge tone={ageBucketTone(row.ageBucket)}>
                    {ageBucketLabel(row.ageBucket)}
                  </StatusBadge>
                  <strong>{formatRelativeAge(row.gapAt)}</strong>
                  <span className="muted">{formatDateTime(row.gapAt)}</span>
                </AdminTableSubstack>
              </td>
              <td>
                {row.payment ? (
                  <AdminTableSubstack>
                    <StatusBadge tone={paymentStatusTone(row.payment.status)}>
                      {row.payment.status}
                    </StatusBadge>
                    <MoneyText amount={row.payment.amount} currency={row.payment.currency} />
                    <span className="muted">{row.payment.method}</span>
                  </AdminTableSubstack>
                ) : (
                  <StatusBadge tone="danger">No payment</StatusBadge>
                )}
              </td>
              <td>
                <AdminTableSubstack>
                  <StatusBadge tone={repairTrackTone(row.repairTrack)}>
                    {repairTrackLabel(row.repairTrack)}
                  </StatusBadge>
                  {row.earning ? (
                    <span className="muted">Earning {row.earning.status}</span>
                  ) : (
                    <span className="muted">No earning</span>
                  )}
                </AdminTableSubstack>
              </td>
              <td className="finance-closeout-settlement-action">
                <AdminTextLink href={hrefForRepair(row.id)}>Preview repair</AdminTextLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
        <AdminTablePaginationFooter
          activePage={pagination.page}
          ariaLabel="Settlement backlog pagination"
          from={pagination.from}
          hrefForPage={hrefForPage}
          itemLabel="bookings"
          to={pagination.to}
          totalPages={pagination.totalPages}
          totalRows={pagination.totalRows}
        />
        <div aria-label="Settlement comparison action at table end" className="finance-closeout-selection-footer">
          <FinanceCloseoutSettlementSelectionAction statusId="settlement-comparison-selection-status-footer" />
        </div>
      </AdminTableSection>
    </FinanceCloseoutSettlementSelectionForm>
  );
}

function shortBookingId(bookingId: string) {
  return bookingId.length > 16 ? `…${bookingId.slice(-15)}` : bookingId;
}

function customerLabel(row: AdminBookingSettlementGap) {
  return (
    row.customerProfile?.user?.fullName ||
    row.customerProfile?.user?.phone ||
    row.customerProfile?.id ||
    'Unknown'
  );
}

function partnerLabel(row: AdminBookingSettlementGap) {
  return (
    row.selectedProvider?.displayName ||
    row.selectedProvider?.user?.fullName ||
    row.selectedProvider?.user?.phone ||
    'Not assigned'
  );
}

function ageBucketLabel(bucket: AdminBookingSettlementGap['ageBucket']) {
  switch (bucket) {
    case 'RECENT':
      return 'Under 24h';
    case '24_TO_72_HOURS':
      return '24–72h';
    case '3_TO_7_DAYS':
      return '3–7d';
    case '7_DAYS_PLUS':
      return '7d+';
  }
}

function ageBucketTone(bucket: AdminBookingSettlementGap['ageBucket']): StatusBadgeTone {
  if (bucket === 'RECENT') return 'info';
  if (bucket === '24_TO_72_HOURS') return 'warning';
  return 'danger';
}

function paymentStatusTone(status: string): StatusBadgeTone {
  if (status === 'CAPTURED' || status === 'PAID') return 'success';
  if (status === 'FAILED' || status === 'REFUNDED') return 'danger';
  return 'warning';
}

function repairTrackLabel(track: AdminBookingSettlementGap['repairTrack']) {
  switch (track) {
    case 'canonical':
      return 'Canonical';
    case 'historical-ready':
      return 'Historical policy review';
    case 'evidence-blocked':
      return 'Evidence blocked';
    case 'manual-review':
      return 'Manual review';
  }
}

function repairTrackTone(track: AdminBookingSettlementGap['repairTrack']): StatusBadgeTone {
  if (track === 'historical-ready') return 'warning';
  if (track === 'evidence-blocked') return 'danger';
  if (track === 'manual-review') return 'warning';
  return 'info';
}
