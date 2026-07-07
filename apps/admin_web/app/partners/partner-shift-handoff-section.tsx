import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import {
  AdminActionCard,
  AdminNotePanel,
  AdminSection,
  AdminTaskGrid,
} from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import {
  AdminSignal,
  StatusBadge,
  StatusBadgeFromPillClass,
  type AdminSignalTone,
} from '../../components/status-badge';
import type { PartnerCommandLane } from './partner-command-center';
import {
  partnerShiftCardClass,
  partnerShiftPillClass,
  type PartnerShiftHandoff,
} from './partner-shift-handoff';

export type PartnerShiftHandoffSectionModel = PartnerShiftHandoff;

type PartnerShiftHandoffSectionProps = {
  readonly handoff: PartnerShiftHandoffSectionModel;
};

export function PartnerShiftHandoffSection({ handoff }: PartnerShiftHandoffSectionProps) {
  return (
    <AdminSection
      actions={<AdminSignal tone={partnerCommandSignalTone(handoff.tone)}>{handoff.label}</AdminSignal>}
      className="admin-mb-16 partner-shift-handoff-card"
      description="The first operator read for this partner queue. It turns KYC, wallet debt, dispatch readiness, location freshness, push readiness, and payout setup into a practical work order."
      title="Partner shift handoff"
    >
      <AdminNotePanel className="admin-mt-14">
        <div className="ops-row">
          <div>
            <StatusBadge tone="info">Next best partner move</StatusBadge>
            <strong>{handoff.headline}</strong>
            <p className="muted">{handoff.detail}</p>
          </div>
          <AdminTextLink href={handoff.primaryAction.href}>
            {handoff.primaryAction.label}
          </AdminTextLink>
        </div>
      </AdminNotePanel>
      <AdminTraceSummary
        className="admin-mt-14"
        itemClassName="ops-task-breakdown-item"
        metrics={handoff.stats.map((stat) => ({
          className: `ops-task-breakdown-${partnerDashboardTone(stat.tone)}`,
          detail: stat.detail,
          href: stat.href,
          label: stat.label,
          value: stat.value,
        }))}
      />
      <AdminTaskGrid className="admin-mt-14">
        {handoff.actions.map((item) => (
          <AdminActionCard
            actionLabel={item.operatorAction}
            className={partnerShiftCardClass(item.tone)}
            detail={item.detail}
            href={item.href}
            key={item.title}
            leading={
              <StatusBadgeFromPillClass pillClass={partnerShiftPillClass(item.tone)}>
                {item.scope}
              </StatusBadgeFromPillClass>
            }
            title={item.title}
            variant="ops-task"
          >
            <AdminFilterChipGroup ariaLabel={`${item.title} samples`} className="admin-mt-10">
              {item.samples.length ? (
                item.samples.map((sample) => (
                  <StatusBadge key={`${item.title}-${sample}`} tone="neutral">
                    {sample}
                  </StatusBadge>
                ))
              ) : (
                <StatusBadge tone="success">No immediate partner sample</StatusBadge>
              )}
            </AdminFilterChipGroup>
          </AdminActionCard>
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}

function partnerDashboardTone(tone: PartnerCommandLane['tone']) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warn') return 'warn';
  if (tone === 'info') return 'info';
  return 'ok';
}

function partnerCommandSignalTone(tone: PartnerCommandLane['tone']): AdminSignalTone {
  if (tone === 'danger' || tone === 'warn') {
    return 'warn';
  }
  if (tone === 'info') {
    return 'info';
  }
  return 'ok';
}
