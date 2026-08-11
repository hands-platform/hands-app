import { CalendarDays } from 'lucide-react';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import type { AdminDateRange } from '../../lib/date-range';
import { dateRangeLabel } from '../../lib/date-range';

type OperationsHandoffDateRangeSectionProps = {
  readonly detailsMode?: 'all' | 'summary';
  readonly range: AdminDateRange;
};

const handoffRangeLinks = [
  ['all', 'All dates'],
  ['today', 'Today'],
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
] as const;

export function OperationsHandoffDateRangeSection({
  detailsMode = 'summary',
  range,
}: OperationsHandoffDateRangeSectionProps) {
  return (
    <AdminFilterPanel
      className="admin-mt-16 admin-mb-16 operations-handoff-date-range-card"
      description="Review dated booking, chat, finance, alert, and operator-note records for the selected historical window."
      resultLabel={dateRangeLabel(range)}
      title="Operations history range"
    >
      <div className="actions">
        {handoffRangeLinks.map(([rangeValue, label]) => {
          const selected = range === rangeValue;

          return (
            <AdminFormControlLink
              aria-current={selected ? 'page' : undefined}
              className={selected ? 'button-primary' : 'button-secondary'}
              href={operationsHandoffRangeHref(rangeValue, detailsMode)}
              key={rangeValue}
            >
              <CalendarDays aria-hidden="true" size={16} />
              {label}
            </AdminFormControlLink>
          );
        })}
      </div>
    </AdminFilterPanel>
  );
}

function operationsHandoffRangeHref(
  range: AdminDateRange,
  detailsMode: NonNullable<OperationsHandoffDateRangeSectionProps['detailsMode']>,
) {
  const query = new URLSearchParams();

  if (detailsMode === 'all') {
    query.set('details', 'all');
  }

  if (range !== '7d') {
    query.set('range', range);
  } else if (detailsMode === 'all') {
    query.set('range', range);
  }

  const search = query.toString();
  return search ? `/operations-handoff?${search}` : '/operations-handoff';
}
