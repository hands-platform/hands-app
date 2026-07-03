import Link from 'next/link';
import { CalendarDays } from 'lucide-react';

import { AdminSection } from '../../components/admin-surface';
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
    <AdminSection
      actions={
        <span className="pill pill-info">{dateRangeLabel(range)}</span>
      }
      className="admin-mt-16 admin-mb-16 operations-handoff-date-range-card"
      description="Live booking counters stay current. Operator notes and the unified activity stream are filtered by the selected record window."
      title="Handoff date range"
    >
      <div className="actions">
        {handoffRangeLinks.map(([label, href]) => (
          <Link className="button button-secondary" href={href} key={href}>
            <CalendarDays aria-hidden="true" size={16} />
            {label}
          </Link>
        ))}
      </div>
    </AdminSection>
  );
}
