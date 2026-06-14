import Link from 'next/link';
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
    <div className="card">
      <div className="toolbar">
        <div>
          <h2>Shift brief</h2>
          <p className="muted">Recommended opening order for the next operator.</p>
        </div>
        <span className="pill pill-info">Factual queue</span>
      </div>
      <div className="ops-task-grid">
        {items.map((item) => (
          <Link className="ops-task-card" href={item.href} key={item.title}>
            <span className={item.className}>{item.owner}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <small>{item.action}</small>
          </Link>
        ))}
      </div>
    </div>
  );
}
