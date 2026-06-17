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
      <section className="card admin-mb-16" id="booking-closeout-checklist">
        <div className="ops-section-header">
          <div>
            <h2>Booking closeout checklist</h2>
            <p className="muted">
              Final factual checklist before closeout or finance action.
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
        <div className="ops-task-grid admin-mt-12">
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

      <section className="card admin-mb-16" id="connected-operations-records">
        <div className="ops-section-header">
          <div>
            <h2>Connected operations records</h2>
            <p className="muted">
              Jump links to records connected to this booking.
            </p>
          </div>
          <span className="pill pill-info">{connectedRecordLinks.length} links</span>
        </div>
        <div className="service-trace-summary admin-mt-12">
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
