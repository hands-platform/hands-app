import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

type PartnerOpsTone = 'done' | 'pending' | 'blocked';

export type PartnerBookingGateDecisionGate = {
  readonly action: string;
  readonly detail: string;
  readonly label: string;
  readonly ok: boolean;
};

export type PartnerBookingGateDecisionView = {
  readonly backupRadiusLabel: string;
  readonly bookableServices: string;
  readonly canDirectFirstPick: boolean;
  readonly canJoinMarketplace: boolean;
  readonly cashDebtLabel: string;
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
  pillClassForTone,
}: PartnerDetailBookingGateDecisionSectionProps) {
  return (
    <div className={`card ${cardClassForTone(decision.tone)} admin-mb-16`}>
      <div className="ops-section-header">
        <div>
          <h2>Marketplace booking gate decision</h2>
          <p className="muted">
            Operator-facing decision for whether this partner can join marketplace bookings or continue
            marketplace/payout operations right now.
          </p>
        </div>
        <span className={`pill ${pillClassForTone(decision.tone)}`}>{decision.status}</span>
      </div>
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
          <small>Negative wallet blocks marketplace alerts and participation</small>
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
        <span className="pill pill-info">First response window: {decision.responseWindowLabel}</span>
        <span className="pill pill-info">Marketplace radius: {decision.backupRadiusLabel}</span>
        <span className="pill pill-info">
          Marketplace location: {decision.locationFreshnessLabel} fresh
        </span>
        <Link className="text-link" href="/operations-policy">
          Edit matching policy
        </Link>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<PartnerBookingGateDecisionEmptyState message="No marketplace booking gate rows." />}
          headers={bookingGateDecisionHeaders}
          rowCount={decision.gates.length}
        >
          {decision.gates.map((gate) => (
            <tr key={gate.label}>
              <td>
                <strong>{gate.label}</strong>
              </td>
              <td>
                <span className={`pill ${gate.ok ? 'pill-success' : 'pill-danger'}`}>
                  {gate.ok ? 'OK' : 'BLOCK'}
                </span>
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
    </div>
  );
}

const bookingGateDecisionHeaders = ['Gate', 'Status', 'Detail', 'Action'] as const;

function PartnerBookingGateDecisionEmptyState({ message }: { readonly message: string }) {
  return (
    <>
      <strong>No records found</strong>
      <p className="muted">{message}</p>
    </>
  );
}
