import { CalendarClock, FileClock } from 'lucide-react';

import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

type ServiceBookingExposureGuardSectionProps = {
  readonly activeServiceCount: number;
  readonly blockedCount: number;
  readonly payoutRuleCount: number;
  readonly policyCheckCount: number;
  readonly traceGapCount: number;
  readonly warningCount: number;
};

export function ServiceBookingExposureGuardSection({
  activeServiceCount,
  blockedCount,
  payoutRuleCount,
  policyCheckCount,
  traceGapCount,
  warningCount,
}: ServiceBookingExposureGuardSectionProps) {
  return (
    <AdminSection
      className="admin-mb-16"
      description="Customer and Partner apps only expose service options backed by an active payout rule. Use this guard before opening a new service type or changing Partner prices."
      status={
        <div className="actions">
          <StatusBadge tone={blockedCount ? 'danger' : 'success'}>
            {blockedCount} blocked
          </StatusBadge>
          <StatusBadge tone={warningCount ? 'warning' : 'success'}>
            {warningCount} warning
          </StatusBadge>
        </div>
      }
      title="Customer booking exposure guard"
    >
      <AdminTraceSummary
        metrics={[
          { label: 'Active duration options', value: activeServiceCount },
          { label: 'Rules configured', value: payoutRuleCount },
          { label: 'Trace gaps', value: traceGapCount },
          { label: 'Projected policy checks', value: policyCheckCount },
        ]}
      />
      <div className="actions admin-mt-12">
        <AdminFormControlLink className="button-secondary" href="/bookings?view=pricing">
          <CalendarClock aria-hidden="true" size={16} />
          Open pricing-check bookings
        </AdminFormControlLink>
        <AdminFormControlLink className="button-secondary" href="/audit-log?bucket=Service%2FPricing">
          <FileClock aria-hidden="true" size={16} />
          Review service pricing audit
        </AdminFormControlLink>
      </div>
    </AdminSection>
  );
}
