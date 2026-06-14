import Link from 'next/link';
import type { CustomerSignalRow, PartnerSignalRow } from './operations-handoff-signals';

type OperationsHandoffCustomerPartnerSectionProps = {
  readonly customers: readonly CustomerSignalRow[];
  readonly partners: readonly PartnerSignalRow[];
};

export function OperationsHandoffCustomerPartnerSection({
  customers,
  partners,
}: OperationsHandoffCustomerPartnerSectionProps) {
  return (
    <section className="detail-grid admin-mb-16">
      <div className="card">
        <div className="toolbar">
          <div>
            <h2>Customer handoff</h2>
            <p className="muted">Recent customers with booking, payment, address, and chat evidence.</p>
          </div>
          <Link className="text-link" href="/customers">
            Customer list
          </Link>
        </div>
        <div className="stack">
          {customers.slice(0, 8).map((customer) => (
            <Link className="ops-signal-card" href={`/customers/${customer.id}`} key={customer.id}>
              <span className="pill pill-success">{customer.completedCount} completed</span>
              <strong>{customer.name}</strong>
              <p>{customer.detail}</p>
              <small>{customer.lastWorkLabel}</small>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div>
            <h2>Partner handoff</h2>
            <p className="muted">Partner state from app, wallet, identity, location, and work facts.</p>
          </div>
          <Link className="text-link" href="/partners">
            Partner list
          </Link>
        </div>
        <div className="stack">
          {partners.slice(0, 8).map((partner) => (
            <Link className="ops-signal-card" href={`/partners/${partner.id}`} key={partner.id}>
              <span className={partner.className}>{partner.status}</span>
              <strong>{partner.name}</strong>
              <p>{partner.detail}</p>
              <small>{partner.action}</small>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
