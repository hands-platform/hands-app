import Link from 'next/link';
import type {
  BookingUnifiedDetail,
  BookingUnifiedDetailCard,
  BookingUnifiedDetailRow,
} from './booking-unified-detail';

export type BookingUnifiedDetailSectionProps = {
  readonly unifiedDetail: BookingUnifiedDetail;
};

export function BookingUnifiedDetailSection({ unifiedDetail }: BookingUnifiedDetailSectionProps) {
  return (
    <section className="card admin-mb-16" id="booking-unified-detail">
      <div className="ops-section-header">
        <div>
          <h2>Unified booking detail</h2>
          <p className="muted">
            One booking record for realtime, in-progress, completed, and post-match cancellation updates.
          </p>
        </div>
        <span className={`pill ${unifiedDetail.statusTone}`}>{unifiedDetail.statusLabel}</span>
      </div>

      <div className="service-trace-summary admin-mt-12">
        {unifiedDetail.summaryCards.map((card) => (
          <BookingUnifiedSummaryCard card={card} key={card.label} />
        ))}
      </div>

      <BookingUnifiedTimeline unifiedDetail={unifiedDetail} />

      <BookingUnifiedRows
        helper="Personal profile, reservation address, service request, and the actual customer location signal are separated."
        rows={unifiedDetail.customerRows}
        title="Customer detail"
      />

      <BookingUnifiedRows
        helper="Actual matched Partner details stay visible regardless of which booking list opened this record."
        rows={unifiedDetail.matchedPartnerRows}
        title="Matched Partner detail"
      />

      <BookingUnifiedRows
        helper="Service closeout, customer charge, Partner payout, HANDS fee, tax, and wallet evidence in one place."
        rows={unifiedDetail.financeRows}
        title="Finance and system detail"
      />
    </section>
  );
}

function BookingUnifiedSummaryCard({ card }: { readonly card: BookingUnifiedDetailCard }) {
  const content = (
    <>
      <span>{card.label}</span>
      <strong>{card.value}</strong>
      <small>{card.helper}</small>
    </>
  );

  if (card.href) {
    return (
      <Link href={card.href} title={`Open ${card.label}`}>
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
}

function BookingUnifiedTimeline({ unifiedDetail }: { readonly unifiedDetail: BookingUnifiedDetail }) {
  return (
    <>
      <div className="ops-section-header admin-mt-16">
        <div>
          <h3>Booking update timeline</h3>
          <p className="muted">Each new booking state is appended here instead of splitting the detail page.</p>
        </div>
        <span className="pill pill-info">{unifiedDetail.timelineItems.length} update(s)</span>
      </div>
      <div className="setup-stage-list admin-mt-12">
        {unifiedDetail.timelineItems.map((item) => (
          <div className="setup-stage-item" key={`${item.lane}-${item.title}-${item.at}`}>
            <span>{item.lane}</span>
            <div>
              <strong>{item.title}</strong>
              <p className="muted">{item.detail}</p>
              <small>{item.at}</small>
            </div>
            <span className={`pill ${item.tone}`}>{item.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function BookingUnifiedRows({
  helper,
  rows,
  title,
}: {
  readonly helper: string;
  readonly rows: readonly BookingUnifiedDetailRow[];
  readonly title: string;
}) {
  return (
    <>
      <div className="ops-section-header admin-mt-16">
        <div>
          <h3>{title}</h3>
          <p className="muted">{helper}</p>
        </div>
      </div>
      <div className="setup-stage-list admin-mt-12">
        {rows.map((row) => (
          <div className="setup-stage-item" key={row.label}>
            <span>{row.label}</span>
            <div>
              <strong>{row.value}</strong>
              {row.detail && <p className="muted">{row.detail}</p>}
            </div>
            {row.href ? (
              <Link className="text-link" href={row.href}>
                Open
              </Link>
            ) : (
              <small>Record</small>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
