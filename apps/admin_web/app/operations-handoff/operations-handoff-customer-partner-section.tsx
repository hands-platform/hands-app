import { Briefcase, Users } from 'lucide-react';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminActionCard, AdminDetailGrid, AdminSection } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import {
  OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE,
  OperationsHandoffPaginationFooter,
  operationsHandoffServerPageWindow,
  type OperationsHandoffPagination,
} from './operations-handoff-pagination';
import type { CustomerSignalRow, PartnerSignalRow } from './operations-handoff-signals';

type OperationsHandoffCustomerPartnerSectionProps = {
  readonly customerPagination?: OperationsHandoffPagination;
  readonly customers: readonly CustomerSignalRow[];
  readonly partnerPagination?: OperationsHandoffPagination;
  readonly partners: readonly PartnerSignalRow[];
};

export function OperationsHandoffCustomerPartnerSection({
  customerPagination,
  customers,
  partnerPagination,
  partners,
}: OperationsHandoffCustomerPartnerSectionProps) {
  const visibleCustomers = customerPagination
    ? customers.slice(0, OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE)
    : customers.slice(0, 8);
  const partnerRows = partners.filter((partner) => partner.attention);
  const visiblePartners = partnerPagination
    ? partnerRows.slice(0, OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE)
    : partnerRows.slice(0, 8);
  const customerPage = customerPagination
    ? operationsHandoffServerPageWindow(visibleCustomers.length, customerPagination)
    : null;
  const partnerPage = partnerPagination
    ? operationsHandoffServerPageWindow(visiblePartners.length, partnerPagination)
    : null;

  if (visibleCustomers.length === 0 && visiblePartners.length === 0) {
    return null;
  }

  return (
    <AdminDetailGrid ariaLabel="Customer and Partner history" className="admin-mb-16">
      {visibleCustomers.length > 0 ? (
        <AdminSection
          actions={
            <AdminFormControlLink className="button-secondary" href="/customers">
              <Users aria-hidden="true" size={16} />
              Customer list
            </AdminFormControlLink>
          }
          description="Recent customers with booking, payment, address, and chat evidence."
          id="operations-handoff-customer-history"
          title="Customer history"
        >
          <div className="stack">
            {visibleCustomers.map((customer) => (
              <AdminActionCard
                actionLabel={customer.lastWorkLabel}
                href={`/customers/${customer.id}`}
                key={customer.id}
                leading={<StatusBadge tone="success">{customer.completedCount} completed</StatusBadge>}
                variant="ops-signal"
              >
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar"
                  avatarStatus={customer.avatarStatus}
                  className="vuexy-booking-person"
                  helper={customer.detail}
                  label={customer.name}
                />
              </AdminActionCard>
            ))}
          </div>
          {customerPagination && customerPage ? (
            <OperationsHandoffPaginationFooter
              from={customerPage.from}
              pagination={customerPagination}
              to={customerPage.to}
              totalPages={customerPage.totalPages}
            />
          ) : null}
        </AdminSection>
      ) : null}

      {visiblePartners.length > 0 ? (
        <AdminSection
          actions={
            <AdminFormControlLink className="button-secondary" href="/partners">
              <Briefcase aria-hidden="true" size={16} />
              Partner list
            </AdminFormControlLink>
          }
          description="Partners that need location, identity, bank, or wallet follow-up."
          id="operations-handoff-partner-history"
          title="Partner history"
        >
          <div className="stack">
            {visiblePartners.map((partner) => (
              <AdminActionCard
                actionLabel={partner.action}
                href={`/partners/${partner.id}`}
                key={partner.id}
                leading={
                  <StatusBadgeFromPillClass pillClass={partner.className}>{partner.status}</StatusBadgeFromPillClass>
                }
                variant="ops-signal"
              >
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar is-partner"
                  avatarStatus={partner.avatarStatus}
                  className="vuexy-booking-person"
                  helper={partner.detail}
                  label={partner.name}
                />
              </AdminActionCard>
            ))}
          </div>
          {partnerPagination && partnerPage ? (
            <OperationsHandoffPaginationFooter
              from={partnerPage.from}
              pagination={partnerPagination}
              to={partnerPage.to}
              totalPages={partnerPage.totalPages}
            />
          ) : null}
        </AdminSection>
      ) : null}
    </AdminDetailGrid>
  );
}
