import Link from 'next/link';

type CloseoutChecklistItem = {
  title: string;
  status: string;
  detail: string;
  operatorRule: string;
  href: string;
  className: string;
  pillClass: string;
};

type ConnectedRecordLink = {
  label: string;
  value: string;
  detail: string;
  href: string;
  tone: string;
};

type BookingCloseoutSectionsProps = {
  bookingCloseoutChecklist: CloseoutChecklistItem[];
  connectedRecordLinks: ConnectedRecordLink[];
};

export function BookingCloseoutSections({
  bookingCloseoutChecklist,
  connectedRecordLinks,
}: BookingCloseoutSectionsProps) {
  return (
    <>
      <section className="card" id="booking-closeout-checklist" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Booking closeout checklist</h2>
            <p className="muted">
              Final operator checklist before payment capture, refund/release, cash fee settlement, no-show,
              cancellation, or completed-work closeout. It uses factual records only.
            </p>
          </div>
          <div className="actions">
            <Link className="text-link" href="/bookings?view=manual-decision">
              Manual decision queue
            </Link>
            <Link className="text-link" href="/finance-closeout">
              Finance closeout
            </Link>
          </div>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 12 }}>
          {bookingCloseoutChecklist.map((item) => (
            <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
              <div>
                <span className={`pill ${item.pillClass}`}>{item.status}</span>
                <h3>{item.title}</h3>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.operatorRule}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" id="connected-operations-records" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Connected operations records</h2>
            <p className="muted">
              Jump from this booking to the linked customer, partner, chat archive, notification trace,
              payment, refund, and settlement records.
            </p>
          </div>
          <span className="pill pill-info">{connectedRecordLinks.length} links</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {connectedRecordLinks.map((record) => (
            <div key={record.label}>
              <span>{record.label}</span>
              <strong>{record.value}</strong>
              <small>{record.detail}</small>
              <Link className={`pill ${record.tone}`} href={record.href}>
                Open
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
