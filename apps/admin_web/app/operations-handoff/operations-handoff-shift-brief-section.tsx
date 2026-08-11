import { AdminActionCard, AdminSection, AdminTaskGrid } from '../../components/admin-surface';
import { AdminQueueMeta } from '../../components/admin-overview-card';
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
      description="Historical follow-up order for the selected period."
      title="Period brief"
    >
      <AdminTaskGrid>
        {items.map((item) => (
          <AdminActionCard
            actionLabel={`Review ${item.title}`}
            detail={item.action}
            href={item.href}
            key={item.title}
            signalClassName={toSignalModifierClass(item.className)}
            signalLabel={item.status}
            title={item.title}
            variant="ops-task"
          >
            <AdminQueueMeta impact={item.detail} owner={item.owner} />
          </AdminActionCard>
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}

function toSignalModifierClass(className: string) {
  return className.replace(/^signal\s+/, '');
}
