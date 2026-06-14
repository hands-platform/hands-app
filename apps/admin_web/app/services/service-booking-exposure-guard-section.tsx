import Link from 'next/link';

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
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Customer booking exposure guard</h2>
          <p className="muted">
            Customer and Partner apps only expose service options backed by an active payout rule. Use this
            guard before opening a new service type or changing Partner prices.
          </p>
        </div>
        <div className="actions">
          <span className={blockedCount ? 'pill pill-danger' : 'pill pill-success'}>
            {blockedCount} blocked
          </span>
          <span className={warningCount ? 'pill pill-warn' : 'pill pill-success'}>
            {warningCount} warning
          </span>
        </div>
      </div>
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
        <Link className="text-link" href="/bookings?view=pricing">
          Open pricing-check bookings
        </Link>
        <a className="text-link" href="/audit-log?bucket=Service%2FPricing">
          Review service pricing audit
        </a>
      </div>
    </section>
  );
}
