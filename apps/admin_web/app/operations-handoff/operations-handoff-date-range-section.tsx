import Link from 'next/link';

import type { AdminDateRange } from '../../lib/date-range';
import { dateRangeLabel } from '../../lib/date-range';

type OperationsHandoffDateRangeSectionProps = {
  readonly range: AdminDateRange;
};

const handoffRangeLinks = [
  ['All dates', '/operations-handoff'],
  ['Today', '/operations-handoff?range=today'],
  ['Last 7 days', '/operations-handoff?range=7d'],
  ['Last 30 days', '/operations-handoff?range=30d'],
] as const;

export function OperationsHandoffDateRangeSection({ range }: OperationsHandoffDateRangeSectionProps) {
  return (
    <section className="card admin-mt-16 admin-mb-16">
      <div className="toolbar">
        <div>
          <h2>Handoff date range</h2>
          <p className="muted">
            Live booking counters stay current. Operator notes and the unified activity stream are filtered by
            the selected record window.
          </p>
        </div>
        <span className="pill pill-info">{dateRangeLabel(range)}</span>
      </div>
      <div className="actions">
        {handoffRangeLinks.map(([label, href]) => (
          <Link className="text-link" href={href} key={href}>
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
