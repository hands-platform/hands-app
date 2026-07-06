import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminPersonCell } from '../../../components/admin-person-cell';
import { AdminNoteCard, AdminNotePanel, AdminSection, AdminTaskCard } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';

type SummaryCard = {
  label: string;
  value: string;
  helper: string;
};

type PillBadge = {
  label: string;
  tone: string;
  detail?: string;
};

type OpsTaskCard = {
  title: string;
  status: string;
  detail: string;
  action: string;
  className: string;
  pillClass: string;
};

type SummaryCardGridProps = {
  cards: SummaryCard[];
};

type PillBadgeListProps = {
  badges: PillBadge[];
  showDetailTitle?: boolean;
};

type OpsTaskCardGridProps = {
  cards: OpsTaskCard[];
};

type StageSnapshot = {
  stage: string;
  pillClass: string;
  metrics: SummaryCard[];
  noteClassName: string;
  headline: string;
  detail: string;
  badges: PillBadge[];
  actionHref: string;
  actionLabel: string;
};

type CustomerWaitPanel = {
  signalTone: string;
  signalStatus: string;
  headline: string;
  detail: string;
  badges: PillBadge[];
  nextActionHref: string;
  nextActionLabel: string;
  cards: OpsTaskCard[];
};

type PolicySnapshot = {
  metrics: SummaryCard[];
  decisionTone: string;
  decisionStatus: string;
  decisionTitle: string;
  decisionDetail: string;
  decisionCards: Array<{
    key: string;
    label: string;
    value: string;
    helper: string;
    status: string;
    className: string;
    pillClass: string;
  }>;
};

type AddressRadiusContract = {
  tone: string;
  status: string;
  metrics: SummaryCard[];
  cards: OpsTaskCard[];
};

type MarketplaceSupply = {
  candidateCommand: {
    tone: string;
    status: string;
    title: string;
    detail: string;
    href: string;
    action: string;
  };
  topCandidates: Array<{
    id: string;
    name: string;
    distance: string;
    locationAge: string;
  }>;
  excludedGroups: Array<{
    label: string;
    count: number;
    detail: string;
    samples: string[];
    href: string;
  }>;
  eligibleCount: number;
  metrics: SummaryCard[];
  decisionTone: string;
  decisionStatus: string;
  decisionTitle: string;
  decisionDetail: string;
  rows: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    locationAge: string;
    detail: string;
    eligible: boolean;
    distance: string;
  }>;
};

export function BookingStageSnapshotSection({ stageSnapshot }: BookingStageSnapshotSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadge tone={statusBadgeToneFromPillClass(stageSnapshot.pillClass)}>
          {stageSnapshot.stage}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Current stage, blocking signal, and next operator action for this booking."
      id="alerts"
      title="Booking stage snapshot"
    >
      <SummaryCardGrid cards={stageSnapshot.metrics} />
      <AdminNotePanel className={`${stageSnapshot.noteClassName} admin-mt-14`}>
        <div className="ops-row">
          <div>
            <strong>{stageSnapshot.headline}</strong>
            <p className="muted">{stageSnapshot.detail}</p>
            <PillBadgeList badges={stageSnapshot.badges} />
          </div>
          <AdminTextLink href={stageSnapshot.actionHref}>
            {stageSnapshot.actionLabel}
          </AdminTextLink>
        </div>
      </AdminNotePanel>
    </AdminSection>
  );
}

export type BookingStageSnapshotSectionProps = {
  stageSnapshot: StageSnapshot;
};

export function BookingCustomerWaitPanelSection({
  customerWaitPanel,
}: BookingCustomerWaitPanelSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadge tone={statusBadgeToneFromPillClass(customerWaitPanel.signalTone)}>
          {customerWaitPanel.signalStatus}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Customer waiting signal, matching evidence, and the next action while assignment is unresolved."
      id="audit"
      title="Customer wait and matching decision"
    >
      <AdminNotePanel className="admin-mt-14">
        <div className="ops-row">
          <div>
            <strong>{customerWaitPanel.headline}</strong>
            <p className="muted">{customerWaitPanel.detail}</p>
            <PillBadgeList badges={customerWaitPanel.badges} showDetailTitle />
          </div>
          <AdminTextLink href={customerWaitPanel.nextActionHref}>
            {customerWaitPanel.nextActionLabel}
          </AdminTextLink>
        </div>
      </AdminNotePanel>
      <OpsTaskCardGrid cards={customerWaitPanel.cards} />
    </AdminSection>
  );
}

export type BookingCustomerWaitPanelSectionProps = {
  customerWaitPanel: CustomerWaitPanel;
};

export function BookingAppliedPolicySection({ policySnapshot }: BookingAppliedPolicySectionProps) {
  return (
    <AdminSection
      actions={
        <AdminTextLink href="/operations-policy">
          Open policy
        </AdminTextLink>
      }
      className="admin-mb-16"
      description="The live admin policy that operators should use when handling this booking. Existing bookings keep their saved timeout, while Partner visibility and participation checks use the latest policy."
      id="applied-operations-policy"
      title="Applied operations policy"
    >
      <SummaryCardGrid cards={policySnapshot.metrics} />
      <AdminNotePanel className="admin-mt-14">
        <div className="ops-row">
          <div>
            <StatusBadge tone={statusBadgeToneFromPillClass(policySnapshot.decisionTone)}>
              {policySnapshot.decisionStatus}
            </StatusBadge>
            <strong>{policySnapshot.decisionTitle}</strong>
            <p className="muted">{policySnapshot.decisionDetail}</p>
          </div>
          <AdminTextLink href="/operations-policy">
            Review decision
          </AdminTextLink>
        </div>
      </AdminNotePanel>
      <div className="ops-task-grid admin-mt-14">
        {policySnapshot.decisionCards.map((decision) => (
          <AdminTaskCard
            className={decision.className}
            detail={decision.value}
            key={decision.key}
            leading={
              <StatusBadge tone={statusBadgeToneFromPillClass(decision.pillClass)}>
                {decision.status}
              </StatusBadge>
            }
            title={decision.label}
          >
            <small title={decision.helper}>{compactPolicyDecisionHelper(decision.helper)}</small>
          </AdminTaskCard>
        ))}
      </div>
    </AdminSection>
  );
}

function compactPolicyDecisionHelper(helper: string): string {
  if (helper === 'Saved on booking open and aligned with current policy.') {
    return 'Saved policy aligned.';
  }
  if (helper.startsWith('Saved on booking open. Current policy is ')) {
    return 'Saved policy differs from live.';
  }
  if (helper.length > 64) {
    return 'Review policy detail.';
  }

  return helper;
}

export type BookingAppliedPolicySectionProps = {
  policySnapshot: PolicySnapshot;
};

export function BookingAddressRadiusContractSection({
  addressRadiusContract,
}: BookingAddressRadiusContractSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadge tone={statusBadgeToneFromPillClass(addressRadiusContract.tone)}>
          {addressRadiusContract.status}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="The immutable booking address snapshot is the source of truth for 10km marketplace eligibility."
      id="address-radius-contract"
      title="Booking address radius contract"
    >
      <SummaryCardGrid cards={addressRadiusContract.metrics} />
      <OpsTaskCardGrid cards={addressRadiusContract.cards} />
    </AdminSection>
  );
}

export type BookingAddressRadiusContractSectionProps = {
  addressRadiusContract: AddressRadiusContract;
};

export function BookingDispatchCandidateDecisionMatrixSection({
  marketplaceSupply,
}: BookingDispatchCandidateDecisionMatrixSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadge tone={statusBadgeToneFromPillClass(marketplaceSupply.candidateCommand.tone)}>
          {marketplaceSupply.candidateCommand.status}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Usable Partner supply and operational blockers for this booking pin."
      title="Booking-address supply check"
    >
      <AdminNotePanel className="admin-mt-14">
        <div className="ops-row">
          <div>
            <strong>{marketplaceSupply.candidateCommand.title}</strong>
            <p className="muted">{marketplaceSupply.candidateCommand.detail}</p>
          </div>
          <AdminTextLink href={marketplaceSupply.candidateCommand.href}>
            {marketplaceSupply.candidateCommand.action}
          </AdminTextLink>
        </div>
      </AdminNotePanel>
      <div className="grid admin-mt-14">
        <AdminNoteCard className="booking-supply-panel">
          <h3>Top usable Partners</h3>
          <p className="muted">
            Closest eligible Partners under the booking pin, radius, online, verification, and location freshness
            gates.
          </p>
          <div className="setup-stage-list admin-mt-12">
            {marketplaceSupply.topCandidates.map((row) => (
              <div className="setup-stage-item" key={`candidate-${row.id}`}>
                <span>GO</span>
                <div>
                  <AdminPersonCell
                    avatarClassName="vuexy-booking-avatar is-partner"
                    avatarStatus="online"
                    className="vuexy-booking-person"
                    helper={`${row.distance} / ${row.locationAge}`}
                    href={`/partners/${row.id}`}
                    label={row.name}
                    linkClassName="table-link"
                  />
                </div>
              </div>
            ))}
            {marketplaceSupply.topCandidates.length === 0 ? (
              <div className="setup-stage-item">
                <span>NONE</span>
                <div>
                  <AdminEmptyState
                    message="Use the exclusion groups to decide whether to refresh location, widen policy, or contact Partners."
                    title="No usable marketplace participant"
                  />
                </div>
                <AdminTextLink href="/partners?review=marketplace-ready">
                  Open marketplace queue
                </AdminTextLink>
              </div>
            ) : null}
          </div>
        </AdminNoteCard>
        <AdminNoteCard className="booking-supply-panel">
          <h3>Operational supply blockers</h3>
          <p className="muted">
            Non-wallet supply repair groups for this booking pin. Wallet debt repair is handled outside the
            booking candidate list.
          </p>
          <div className="setup-stage-list admin-mt-12">
            {marketplaceSupply.excludedGroups.map((group) => (
              <div className="setup-stage-item" key={group.label}>
                <span>{group.count ? 'FIX' : 'OK'}</span>
                <div>
                  <strong>{group.label}</strong>
                  <p className="muted">{group.detail}</p>
                  {group.samples.length ? <p className="muted">Sample: {group.samples.join(', ')}</p> : null}
                </div>
                <AdminTextLink href={group.href}>
                  {group.count}
                </AdminTextLink>
              </div>
            ))}
          </div>
        </AdminNoteCard>
      </div>
    </AdminSection>
  );
}

export type BookingDispatchCandidateDecisionMatrixSectionProps = {
  marketplaceSupply: MarketplaceSupply;
};

export function BookingMarketplaceSupplySection({ marketplaceSupply }: BookingMarketplaceSupplySectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadge tone={marketplaceSupply.eligibleCount ? 'success' : 'warning'}>
          {marketplaceSupply.eligibleCount} eligible
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Full Partner supply rows for the booking pin, with eligibility and exclusion evidence."
      id="marketplace-supply"
      title="Marketplace Partner supply for this booking"
    >
      <SummaryCardGrid cards={marketplaceSupply.metrics} />
      <AdminNotePanel className="admin-mt-14">
        <div className="ops-row">
          <div>
            <StatusBadge tone={statusBadgeToneFromPillClass(marketplaceSupply.decisionTone)}>
              {marketplaceSupply.decisionStatus}
            </StatusBadge>
            <strong>{marketplaceSupply.decisionTitle}</strong>
            <p className="muted">{marketplaceSupply.decisionDetail}</p>
          </div>
          <AdminTextLink href="/partners">
            Open Partners
          </AdminTextLink>
        </div>
      </AdminNotePanel>
      <div className="stack admin-mt-14">
        {marketplaceSupply.rows.map((row) => (
          <div className="ops-row" key={row.id}>
            <div>
              <AdminPersonCell
                avatarClassName="vuexy-booking-avatar is-partner"
                avatarStatus={marketplaceSupplyRowAvatarStatus(row.status)}
                className="vuexy-booking-person"
                helper={`${row.role} / ${row.status} / ${row.locationAge}`}
                href={`/partners/${row.id}`}
                label={row.name}
                linkClassName="table-link"
              />
              <p className="muted">{row.detail}</p>
            </div>
            <div>
              <StatusBadge tone={row.eligible ? 'success' : 'warning'}>
                {row.eligible ? 'Can participate' : 'Excluded'}
              </StatusBadge>
              <div className="muted">{row.distance}</div>
            </div>
          </div>
        ))}
        {marketplaceSupply.rows.length === 0 ? (
          <p className="muted">
            No displayable Partner supply can be evaluated until the booking has a customer pin or an
            eligible non-wallet-blocked Partner.
          </p>
        ) : null}
      </div>
    </AdminSection>
  );
}

export type BookingMarketplaceSupplySectionProps = {
  marketplaceSupply: MarketplaceSupply;
};

function marketplaceSupplyRowAvatarStatus(status: string): AdminAvatarStatus {
  if (status === 'ONLINE_BUSY') {
    return 'working';
  }
  if (status === 'ONLINE_AVAILABLE' || status === 'ONLINE_AVAILABLE_SOON') {
    return 'online';
  }
  return 'offline';
}

function SummaryCardGrid({ cards }: SummaryCardGridProps) {
  return (
    <AdminTraceSummary
      className="admin-mt-12"
      metrics={cards.map((item) => ({
        detail: <span title={item.helper}>{compactSummaryCardHelper(item.helper)}</span>,
        label: item.label,
        value: item.value,
      }))}
    />
  );
}

function compactSummaryCardHelper(helper: string): string {
  if (helper === 'Saved on booking open and aligned with current policy.') {
    return 'Saved policy aligned.';
  }
  if (helper.endsWith(' Saved on booking open and aligned with current policy.')) {
    return helper.replace('Saved on booking open and aligned with current policy.', 'Saved policy aligned.');
  }

  return helper;
}

function PillBadgeList({
  badges,
  showDetailTitle = false,
}: PillBadgeListProps) {
  return (
    <div className="participant-list admin-mt-8">
      {badges.map((badge) => (
        <StatusBadge
          key={badge.label}
          tone={statusBadgeToneFromPillClass(badge.tone)}
          title={showDetailTitle ? badge.detail : undefined}
        >
          {badge.label}
        </StatusBadge>
      ))}
    </div>
  );
}

function OpsTaskCardGrid({ cards }: OpsTaskCardGridProps) {
  return (
    <div className="ops-task-grid admin-mt-14">
      {cards.map((card) => (
        <AdminTaskCard
          className={card.className}
          detail={card.detail}
          key={card.title}
          leading={<StatusBadge tone={statusBadgeToneFromPillClass(card.pillClass)}>{card.status}</StatusBadge>}
          title={card.title}
        >
          <small>{card.action}</small>
        </AdminTaskCard>
      ))}
    </div>
  );
}
