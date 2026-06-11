import { formatMoney } from '../../lib/admin-format';
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

export function ServiceBookingFinanceTraceSection({
  rows,
  summary,
}: ServiceBookingFinanceTraceSectionProps) {
  return (
    <section className="card admin-card-scroll admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Recent booking finance trace</h2>
          <p className="muted">
            Links service pricing to booking payment, partner earning, tax log, platform fee log, and wallet
            movement. Use this after changing a price policy to confirm real bookings are producing the
            expected finance records.
          </p>
        </div>
        <span className="pill pill-info">{rows.length} trace row(s)</span>
      </div>
      <div className="service-trace-summary">
        <div>
          <span>Payment total</span>
          <strong>{formatMoney(summary.paymentAmount, summary.currency)}</strong>
        </div>
        <div>
          <span>Partner net</span>
          <strong>{formatMoney(summary.providerNetAmount, summary.currency)}</strong>
        </div>
        <div>
          <span>Platform fee</span>
          <strong>{formatMoney(summary.platformFeeAmount, summary.currency)}</strong>
        </div>
        <div>
          <span>Withholding</span>
          <strong>{formatMoney(summary.withholdingAmount, summary.currency)}</strong>
        </div>
        <div>
          <span>Wallet movement</span>
          <strong>{formatMoney(summary.walletAmount, summary.currency)}</strong>
        </div>
        <div>
          <span>Missing trace</span>
          <strong>{summary.missingTraceCount} row(s)</strong>
        </div>
      </div>
      {rows.length ? (
        <table className="table service-trace">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Service price</th>
              <th>Payment</th>
              <th>Earning</th>
              <th>Tax / fee logs</th>
              <th>Wallet movement</th>
              <th>Trace status</th>
            </tr>
          </thead>
          <tbody>
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
                    <a className="text-link" href={`/bookings/${row.booking.id}`}>
                      Open booking
                    </a>
                  ) : null}
                </td>
                <td>
                  <strong>{formatMoney(row.bookingService.price, row.currency)}</strong>
                  <p className="muted">Qty {row.bookingService.quantity}</p>
                </td>
                <td>
                  {row.booking?.payment ? (
                    <div className="service-matrix-cell">
                      <strong>{formatMoney(row.booking.payment.amount, row.booking.payment.currency)}</strong>
                      <small>
                        {row.booking.payment.method} / {row.booking.payment.status}
                      </small>
                    </div>
                  ) : (
                    <span className="pill pill-warn">No payment</span>
                  )}
                </td>
                <td>
                  {row.booking?.earning ? (
                    <div className="service-matrix-cell">
                      <strong>{formatMoney(row.booking.earning.netAmount, row.booking.earning.currency)}</strong>
                      <small>
                        Gross {formatMoney(row.booking.earning.grossAmount, row.booking.earning.currency)}
                      </small>
                      <small>
                        Fee {formatMoney(row.booking.earning.platformFee, row.booking.earning.currency)}
                      </small>
                      <small>
                        Tax {formatMoney(row.booking.earning.withholdingAmount, row.booking.earning.currency)}
                      </small>
                    </div>
                  ) : (
                    <span className="pill pill-warn">No earning</span>
                  )}
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <small>{row.taxLogCount} tax log(s)</small>
                    <small>{row.platformFeeLogCount} fee log(s)</small>
                    <small>Tax held {formatMoney(row.taxWithheldAmount, row.currency)}</small>
                    <small>Platform fee {formatMoney(row.platformFeeAmount, row.currency)}</small>
                  </div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <strong>{formatMoney(row.walletAmount, row.currency)}</strong>
                    <small>{row.walletEntryCount} wallet row(s)</small>
                  </div>
                </td>
                <td>
                  <span className={`pill ${row.traceTone}`}>{row.traceStatus}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No recent booking service rows were found for the current service catalog.</p>
      )}
    </section>
  );
}
