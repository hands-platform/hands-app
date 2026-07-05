import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';
import { partnerOpsStatusBadgeTone, type PartnerOpsTone } from './partner-detail-tone';

export type PartnerBookingGateDecisionGate = {
  readonly action: string;
  readonly detail: string;
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
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} ${cardClassForTone(decision.tone)} admin-mb-16`}
      description="Operator-facing decision for whether this partner can join marketplace bookings or continue marketplace/payout operations right now."
      id="partner-booking-gate-decision"
      resultLabel={decision.status}
      resultTone={partnerOpsStatusBadgeTone(decision.tone)}
      title="Marketplace booking gate decision"
    >
      <div className="service-trace-summary admin-mt-12">
        <div>
          <span>Decision</span>
          <strong>{decision.canJoinMarketplace ? 'Join clear' : 'Join held'}</strong>
          <small>{decision.primaryReason}</small>
        </div>
        <div>
          <span>Direct first-pick</span>
          <strong>{decision.canDirectFirstPick ? 'Not wallet-blocked' : 'Needs repair'}</strong>
          <small>{decision.directFirstPickReason}</small>
        </div>
        <div>
          <span>Cash debt</span>
          <strong>{decision.cashDebtLabel}</strong>
          <small>Negative wallet is a settlement warning before final acceptance and service start</small>
        </div>
        <div>
          <span>Location</span>
          <strong>{decision.locationAge}</strong>
          <small>Must be fresh within {decision.locationFreshnessLabel}</small>
        </div>
        <div>
          <span>Services</span>
          <strong>{decision.bookableServices}</strong>
          <small>Bookable price options</small>
        </div>
      </div>
      <div className="participant-list admin-mt-12">
        <StatusBadge tone="info">First response window: {decision.responseWindowLabel}</StatusBadge>
        <StatusBadge tone="info">Marketplace radius: {decision.backupRadiusLabel}</StatusBadge>
        <StatusBadge tone="info">Marketplace location: {decision.locationFreshnessLabel} fresh</StatusBadge>
        <Link className="text-link" href="/operations-policy">
          Edit matching policy
        </Link>
      </div>
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
                <StatusBadge tone={statusBadgeToneFromPillClass(bookingGatePillClass(gate))}>
                  {bookingGateStatusLabel(gate)}
                </StatusBadge>
              </td>
              <td>
                <p className="muted">{gate.detail}</p>
              </td>
              <td>
                <span className="muted">{gate.action}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={decision.gates.length} />
    </AdminFilterPanel>
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
