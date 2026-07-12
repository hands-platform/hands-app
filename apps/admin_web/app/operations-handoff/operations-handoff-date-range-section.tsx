import { CalendarDays } from 'lucide-react';

import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import type { AdminDateRange } from '../../lib/date-range';
import { dateRangeLabel } from '../../lib/date-range';

type OperationsHandoffDateRangeSectionProps = {
  readonly range: AdminDateRange;
};

const handoffRangeLinks = [
  ['All dates', '/operations-handoff?range=all'],
  ['Today', '/operations-handoff?range=today'],
  ['Last 7 days', '/operations-handoff'],
  ['Last 30 days', '/operations-handoff?range=30d'],
] as const;

export function OperationsHandoffDateRangeSection({ range }: OperationsHandoffDateRangeSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadge tone="info">{dateRangeLabel(range)}</StatusBadge>
      }
      className="admin-mt-16 admin-mb-16 operations-handoff-date-range-card"
      description="Review dated booking, chat, finance, alert, and operator-note records for the selected historical window."
      title="Operations history range"
    >
      <div className="actions">
        {handoffRangeLinks.map(([label, href]) => (
          <AdminFormControlLink className="button-secondary" href={href} key={href}>
            <CalendarDays aria-hidden="true" size={16} />
            {label}
          </AdminFormControlLink>
        ))}
      </div>
    </AdminSection>
  );
}
