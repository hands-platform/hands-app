import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

export function OperationsPolicyAuthorityBaselineSection() {
  return (
    <AdminSection
      className="admin-mb-16"
      description="These rules are not CRM preferences. They are the operating authority for Vietnam booking, marketplace, and finance actions until a later product decision changes them."
      statusLabel="Command center rules"
      statusTone="success"
      title="MVP authority baseline"
    >
      <AdminTaskGrid className="admin-mt-14">
        <AdminTaskCard
          actionLabel="Customers may browse globally; booking requires a confirmed Vietnam service address."
          className="ops-task-done"
          leading={<StatusBadge tone="success">Confirmed address</StatusBadge>}
          title="Confirmed service address required"
        >
          <p>
            Every booking must keep an immutable service address snapshot before distance matching,
            marketplace participation, payment evidence, and dispute review.
          </p>
        </AdminTaskCard>
        <AdminTaskCard
          actionLabel="Operators review evidence, but the platform does not automatically assign the partner."
          className="ops-task-done"
          leading={<StatusBadge tone="success">No auto assignment</StatusBadge>}
          title="First-pick priority with fallback choice"
        >
          <p>
            The first-pick Partner can match first under API rules. If first-pick does not win, the customer
            chooses from eligible participating Partners.
          </p>
        </AdminTaskCard>
        <AdminTaskCard
          actionLabel="The radius is admin-editable and defaults to 10km for Vietnam operations."
          className="ops-task-done"
          leading={<StatusBadge tone="info">10km marketplace</StatusBadge>}
          title="Booking-address radius"
        >
          <p>
            Marketplace participation and alerts are based on the booking address, not the customer&apos;s
            browsing location or current country.
          </p>
        </AdminTaskCard>
        <AdminTaskCard
          actionLabel="Direct first-pick response and already-matched service flow stay separate from this gate."
          className="ops-task-done"
          leading={<StatusBadge tone="warning">Negative wallet gate</StatusBadge>}
          title="View demand, block finalization"
        >
          <p>
            A Partner with a negative wallet may see marketplace requests, but final acceptance, service
            start, and payout release wait until the unpaid platform fee is settled or cleared by finance.
          </p>
        </AdminTaskCard>
      </AdminTaskGrid>
    </AdminSection>
  );
}
