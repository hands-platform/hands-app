import Link from 'next/link';
import { Briefcase, Users } from 'lucide-react';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminSection } from '../../components/admin-surface';
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
        <AdminSection
          actions={
            <Link className="button button-secondary" href="/customers">
              <Users aria-hidden="true" size={16} />
              Customer list
            </Link>
          }
          description="Recent customers with booking, payment, address, and chat evidence."
          title="Customer handoff"
        >
          <div className="stack">
            {visibleCustomers.map((customer) => (
              <Link className="ops-signal-card" href={`/customers/${customer.id}`} key={customer.id}>
                <span className="pill pill-success">{customer.completedCount} completed</span>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar"
                  avatarStatus={customer.avatarStatus}
                  className="vuexy-booking-person"
                  helper={customer.detail}
                  label={customer.name}
                />
                <small>{customer.lastWorkLabel}</small>
              </Link>
            ))}
          </div>
        </AdminSection>
      ) : null}

      {visiblePartners.length > 0 ? (
        <AdminSection
          actions={
            <Link className="button button-secondary" href="/partners">
              <Briefcase aria-hidden="true" size={16} />
              Partner list
            </Link>
          }
          description="Partners that need location, identity, bank, or wallet follow-up."
          title="Partner handoff"
        >
          <div className="stack">
            {visiblePartners.map((partner) => (
              <Link className="ops-signal-card" href={`/partners/${partner.id}`} key={partner.id}>
                <span className={partner.className}>{partner.status}</span>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar is-partner"
                  avatarStatus={partner.avatarStatus}
                  className="vuexy-booking-person"
                  helper={partner.detail}
                  label={partner.name}
                />
                <small>{partner.action}</small>
              </Link>
            ))}
          </div>
        </AdminSection>
      ) : null}
    </section>
  );
}
