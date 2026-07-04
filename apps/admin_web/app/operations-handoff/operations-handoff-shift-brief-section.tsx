import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { buildShiftBriefItems } from './operations-handoff-shift-brief';

type OperationsHandoffShiftBriefSectionProps = {
  readonly activeBookingCount: number;
  readonly cashDebtPartnerCount: number;
  readonly customerSignalCount: number;
  readonly failedNotificationCount: number;
  readonly matchingBookingCount: number;
  readonly partnerIssueCount: number;
};

export function OperationsHandoffShiftBriefSection({
  activeBookingCount,
  cashDebtPartnerCount,
  customerSignalCount,
  failedNotificationCount,
  matchingBookingCount,
  partnerIssueCount,
}: OperationsHandoffShiftBriefSectionProps) {
  const items = buildShiftBriefItems({
    matchingBookings: matchingBookingCount,
    activeBookings: activeBookingCount,
    cashDebtPartners: cashDebtPartnerCount,
    failedNotificationCount,
    partnerIssueCount,
    customerSignalCount,
  });

  return (
    <AdminSection
      actions={<StatusBadge tone="info">Factual queue</StatusBadge>}
      description="Recommended opening order for the next operator."
      title="Shift brief"
    >
      <div className="ops-task-grid">
        {items.map((item) => (
          <AdminActionCard
            actionLabel={item.action}
            detail={item.detail}
            href={item.href}
            key={item.title}
            signalClassName={toSignalModifierClass(item.className)}
            signalLabel={item.owner}
            title={item.title}
            variant="ops-task"
          />
        ))}
      </div>
    </AdminSection>
  );
}

function toSignalModifierClass(className: string) {
  return className.replace(/^signal\s+/, '');
}
