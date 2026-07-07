import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';
import { partnerOpsStatusBadgeTone, type PartnerOpsTone } from './partner-detail-tone';

export type PartnerBookingGateDecisionGate = {
  readonly action: string;
  readonly detail: string;
  readonly detailNode?: ReactNode;
  readonly label: string;
  readonly ok: boolean;
  readonly tone?: PartnerOpsTone;
};

export type PartnerBookingGateDecisionView = {
  readonly backupRadiusLabel: string;
  readonly bookableServices: string;
  readonly canDirectFirstPick: boolean;
  readonly canJoinMarketplace: boolean;
  readonly cashDebtLabel: ReactNode;
  readonly directFirstPickReason: string;
  readonly gates: readonly PartnerBookingGateDecisionGate[];
  readonly locationAge: string;
  readonly locationFreshnessLabel: string;
  readonly primaryReason: string;
  readonly responseWindowLabel: string;
  readonly status: string;
  readonly tone: PartnerOpsTone;
};

type PartnerDetailBookingGateDecisionSectionProps = {
  readonly cardClassForTone: (tone: PartnerOpsTone) => string;
  readonly decision: PartnerBookingGateDecisionView;
  readonly pillClassForTone: (tone: PartnerOpsTone) => string;
};

export function PartnerDetailBookingGateDecisionSection({
  cardClassForTone,
  decision,
}: PartnerDetailBookingGateDecisionSectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className={`${cardClassForTone(decision.tone)} admin-mb-16`}
      description="Operator-facing decision for whether this partner can join marketplace bookings or continue marketplace/payout operations right now."
      id="partner-booking-gate-decision"
      resultLabel={decision.status}
      resultTone={partnerOpsStatusBadgeTone(decision.tone)}
      title="Marketplace booking gate decision"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={[
          {
            detail: decision.primaryReason,
            label: 'Decision',
            value: decision.canJoinMarketplace ? 'Join clear' : 'Join held',
          },
          {
            detail: decision.directFirstPickReason,
            label: 'Direct first-pick',
            value: decision.canDirectFirstPick ? 'Not wallet-blocked' : 'Needs repair',
          },
          {
            detail: 'Negative wallet is a settlement warning before final acceptance and service start',
            label: 'Cash debt',
            value: decision.cashDebtLabel,
          },
          {
            detail: <>Must be fresh within {decision.locationFreshnessLabel}</>,
            label: 'Location',
            value: decision.locationAge,
          },
          {
            detail: 'Bookable price options',
            label: 'Services',
            value: decision.bookableServices,
          },
        ]}
      />
      <AdminFilterChipGroup ariaLabel="Marketplace booking gate policy" className="admin-mt-12">
        <StatusBadge tone="info">First response window: {decision.responseWindowLabel}</StatusBadge>
        <StatusBadge tone="info">Marketplace radius: {decision.backupRadiusLabel}</StatusBadge>
        <StatusBadge tone="info">Marketplace location: {decision.locationFreshnessLabel} fresh</StatusBadge>
        <AdminTextLink href="/operations-policy">
          Edit matching policy
        </AdminTextLink>
      </AdminFilterChipGroup>
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<AdminEmptyState message="No marketplace booking gate rows." />}
          headers={bookingGateDecisionHeaders}
          rowCount={decision.gates.length}
        >
          {decision.gates.map((gate) => (
            <tr key={gate.label}>
              <td>
                <strong>{gate.label}</strong>
              </td>
              <td>
                <StatusBadgeFromPillClass pillClass={bookingGatePillClass(gate)}>
                  {bookingGateStatusLabel(gate)}
                </StatusBadgeFromPillClass>
              </td>
              <td>
                <p className="muted">{gate.detailNode ?? gate.detail}</p>
              </td>
              <td>
                <span className="muted">{gate.action}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={decision.gates.length} />
    </PartnerDetailVuexyTablePanel>
  );
}

const bookingGateDecisionHeaders = ['Gate', 'Status', 'Detail', 'Action'] as const;

function bookingGatePillClass(gate: PartnerBookingGateDecisionGate) {
  if (gate.tone === 'pending') {
    return 'pill-warn';
  }
  return gate.ok ? 'pill-success' : 'pill-danger';
}

function bookingGateStatusLabel(gate: PartnerBookingGateDecisionGate) {
  if (gate.tone === 'pending') {
    return 'WARN';
  }
  return gate.ok ? 'OK' : 'BLOCK';
}
