import Link from 'next/link';

import { AdminSection } from '../../../components/admin-surface';

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
      <AdminSection
        actions={
          <div className="actions">
            <Link className="text-link" href="/bookings?view=manual-decision">
              Manual decision queue
            </Link>
            <Link className="text-link" href="/finance-closeout">
              Finance closeout
            </Link>
          </div>
        }
        className="admin-mb-16 booking-closeout-checklist-card"
        description="Final factual checklist before closeout or finance action."
        id="booking-closeout-checklist"
        title="Booking closeout checklist"
      >
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
      </AdminSection>

      <AdminSection
        actions={<span className="pill pill-info">{connectedRecordLinks.length} links</span>}
        className="admin-mb-16 connected-operations-records-card"
        description="Jump links to records connected to this booking."
        id="connected-operations-records"
        title="Connected operations records"
      >
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
      </AdminSection>
    </>
  );
}
