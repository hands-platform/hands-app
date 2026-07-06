import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminTableSection } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import type { ServiceBookingTraceRow } from '../../lib/service-booking-trace-rows';

type ServiceBookingFinanceTraceSummary = {
  readonly currency: string;
  readonly missingTraceCount: number;
  readonly paymentAmount: number;
  readonly platformFeeAmount: number;
  readonly providerNetAmount: number;
  readonly walletAmount: number;
  readonly withholdingAmount: number;
};

type ServiceBookingFinanceTraceSectionProps = {
  readonly rows: readonly ServiceBookingTraceRow[];
  readonly summary: ServiceBookingFinanceTraceSummary;
};

const SERVICE_BOOKING_FINANCE_TRACE_HEADERS = [
  'Booking',
  'Service price',
  'Payment',
  'Earning',
  'Tax / fee logs',
  'Wallet movement',
  'Trace status',
] as const;

export function ServiceBookingFinanceTraceSection({
  rows,
  summary,
}: ServiceBookingFinanceTraceSectionProps) {
  return (
    <AdminTableSection
      className="admin-mb-16"
      description="Links service pricing to booking payment, Partner earning, tax log, platform fee log, and wallet movement. Use this after changing a price policy to confirm real bookings are producing the expected finance records."
      scrollable
      statusLabel={`${rows.length} trace row(s)`}
      statusTone="info"
      title="Recent booking finance trace"
    >
      <AdminTraceSummary
        metrics={[
          {
            label: 'Payment total',
            value: <MoneyText amount={summary.paymentAmount} currency={summary.currency} />,
          },
          {
            label: 'Partner net',
            value: <MoneyText amount={summary.providerNetAmount} currency={summary.currency} />,
          },
          {
            label: 'Platform fee',
            value: <MoneyText amount={summary.platformFeeAmount} currency={summary.currency} />,
          },
          {
            label: 'Withholding',
            value: <MoneyText amount={summary.withholdingAmount} currency={summary.currency} />,
          },
          {
            label: 'Wallet movement',
            value: <MoneyText amount={summary.walletAmount} currency={summary.currency} />,
          },
          { label: 'Missing trace', value: `${summary.missingTraceCount} row(s)` },
        ]}
      />
      {rows.length ? (
        <AdminTableScroll>
          <AdminDataTable
            className="service-trace"
            emptyMessage={null}
            headers={SERVICE_BOOKING_FINANCE_TRACE_HEADERS}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={`${row.service.id}-${row.bookingService.id}`}>
                <td>
                  <strong>{row.service.name}</strong>
                  <p className="muted">
                    {row.service.durationMin} min /{' '}
                    {row.booking?.id.slice(0, 8) ?? row.bookingService.bookingId.slice(0, 8)}
                  </p>
                  <p className="muted">{row.booking?.status ?? 'UNKNOWN'}</p>
                  {row.booking ? (
                    <AdminTextLink href={`/bookings/${row.booking.id}`}>
                      Open booking
                    </AdminTextLink>
                  ) : null}
                </td>
                <td>
                  <strong>
                    <MoneyText amount={row.bookingService.price} currency={row.currency} />
                  </strong>
                  <p className="muted">Qty {row.bookingService.quantity}</p>
                </td>
                <td>
                  {row.booking?.payment ? (
                    <div className="service-matrix-cell">
                      <strong>
                        <MoneyText
                          amount={row.booking.payment.amount}
                          currency={row.booking.payment.currency}
                        />
                      </strong>
                      <small>
                        {row.booking.payment.method} / {row.booking.payment.status}
                      </small>
                    </div>
                  ) : (
                    <StatusBadge tone="warning">No payment</StatusBadge>
                  )}
                </td>
                <td>
                  {row.booking?.earning ? (
                    <div className="service-matrix-cell">
                      <strong>
                        <MoneyText
                          amount={row.booking.earning.netAmount}
                          currency={row.booking.earning.currency}
                        />
                      </strong>
                      <small>
                        Gross{' '}
                        <MoneyText
                          amount={row.booking.earning.grossAmount}
                          currency={row.booking.earning.currency}
                        />
                      </small>
                      <small>
                        Fee{' '}
                        <MoneyText
                          amount={row.booking.earning.platformFee}
                          currency={row.booking.earning.currency}
                        />
                      </small>
                      <small>
                        Tax{' '}
                        <MoneyText
                          amount={row.booking.earning.withholdingAmount}
                          currency={row.booking.earning.currency}
                        />
                      </small>
                    </div>
                  ) : (
                    <StatusBadge tone="warning">No earning</StatusBadge>
                  )}
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <small>{row.taxLogCount} tax log(s)</small>
                    <small>{row.platformFeeLogCount} fee log(s)</small>
                    <small>
                      Tax held <MoneyText amount={row.taxWithheldAmount} currency={row.currency} />
                    </small>
                    <small>
                      Platform fee <MoneyText amount={row.platformFeeAmount} currency={row.currency} />
                    </small>
                  </div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <strong>
                      <MoneyText amount={row.walletAmount} currency={row.currency} />
                    </strong>
                    <small>{row.walletEntryCount} wallet row(s)</small>
                  </div>
                </td>
                <td>
                  <StatusBadge tone={statusBadgeToneFromPillClass(row.traceTone)}>
                    {row.traceStatus}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      ) : (
        <AdminEmptyState
          message="No recent booking service rows were found for the current service catalog."
          title={null}
        />
      )}
    </AdminTableSection>
  );
}
