import Link from 'next/link';
import { CalendarClock, FileClock } from 'lucide-react';

import { AdminSection } from '../../components/admin-surface';

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
          <span className={blockedCount ? 'pill pill-danger' : 'pill pill-success'}>
            {blockedCount} blocked
          </span>
          <span className={warningCount ? 'pill pill-warn' : 'pill pill-success'}>
            {warningCount} warning
          </span>
        </div>
      }
      title="Customer booking exposure guard"
    >
      <div className="service-trace-summary">
        <div>
          <span>Active duration options</span>
          <strong>{activeServiceCount}</strong>
        </div>
        <div>
          <span>Rules configured</span>
          <strong>{payoutRuleCount}</strong>
        </div>
        <div>
          <span>Trace gaps</span>
          <strong>{traceGapCount}</strong>
        </div>
        <div>
          <span>Projected policy checks</span>
          <strong>{policyCheckCount}</strong>
        </div>
      </div>
      <div className="actions admin-mt-12">
        <Link className="button button-secondary" href="/bookings?view=pricing">
          <CalendarClock aria-hidden="true" size={16} />
          Open pricing-check bookings
        </Link>
        <a className="button button-secondary" href="/audit-log?bucket=Service%2FPricing">
          <FileClock aria-hidden="true" size={16} />
          Review service pricing audit
        </a>
      </div>
    </AdminSection>
  );
}
