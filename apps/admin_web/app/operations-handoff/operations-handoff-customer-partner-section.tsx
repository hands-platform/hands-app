import Link from 'next/link';
import { Briefcase, Users } from 'lucide-react';
import type { CustomerSignalRow, PartnerSignalRow } from './operations-handoff-signals';

type OperationsHandoffCustomerPartnerSectionProps = {
  readonly customers: readonly CustomerSignalRow[];
  readonly partners: readonly PartnerSignalRow[];
};

export function OperationsHandoffCustomerPartnerSection({
  customers,
  partners,
}: OperationsHandoffCustomerPartnerSectionProps) {
  const visibleCustomers = customers.slice(0, 8);
  const visiblePartners = partners.filter((partner) => partner.attention).slice(0, 8);

  if (visibleCustomers.length === 0 && visiblePartners.length === 0) {
    return null;
  }

  return (
    <section className="detail-grid admin-mb-16">
      {visibleCustomers.length > 0 ? (
        <div className="card">
          <div className="toolbar">
            <div>
              <h2>Customer handoff</h2>
              <p className="muted">Recent customers with booking, payment, address, and chat evidence.</p>
            </div>
            <Link className="button button-secondary" href="/customers">
              <Users aria-hidden="true" size={16} />
              Customer list
            </Link>
          </div>
          <div className="stack">
            {visibleCustomers.map((customer) => (
              <Link className="ops-signal-card" href={`/customers/${customer.id}`} key={customer.id}>
                <span className="pill pill-success">{customer.completedCount} completed</span>
                <strong>{customer.name}</strong>
                <p>{customer.detail}</p>
                <small>{customer.lastWorkLabel}</small>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {visiblePartners.length > 0 ? (
        <div className="card">
          <div className="toolbar">
            <div>
              <h2>Partner handoff</h2>
              <p className="muted">Partners that need location, identity, bank, or wallet follow-up.</p>
            </div>
            <Link className="button button-secondary" href="/partners">
              <Briefcase aria-hidden="true" size={16} />
              Partner list
            </Link>
          </div>
          <div className="stack">
            {visiblePartners.map((partner) => (
              <Link className="ops-signal-card" href={`/partners/${partner.id}`} key={partner.id}>
                <span className={partner.className}>{partner.status}</span>
                <strong>{partner.name}</strong>
                <p>{partner.detail}</p>
                <small>{partner.action}</small>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
