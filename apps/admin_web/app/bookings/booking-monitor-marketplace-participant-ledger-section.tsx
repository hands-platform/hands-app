import Link from 'next/link';
import { AdminTableScroll } from '../../components/admin-data-table';
import type { AdminBooking } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { MarketplaceOperationsCard } from '../../lib/marketplace-operations-cards';
import type {
  MarketplaceParticipantLedgerPill,
  MarketplaceParticipantLedgerRow,
} from '../../lib/marketplace-participant-ledger';
import { bookingServiceOptionLabel } from './booking-service-labels';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

type BookingMonitorMarketplaceParticipantLedgerSectionProps = {
  readonly getCustomerLabel: (booking: AdminBooking) => string;
  readonly marketplaceLedgerPills: readonly MarketplaceParticipantLedgerPill[];
  readonly marketplaceLedgerRows: readonly MarketplaceParticipantLedgerRow<AdminBooking, BookingParticipant>[];
  readonly marketplaceOperationsCards: readonly MarketplaceOperationsCard[];
};

export function BookingMonitorMarketplaceParticipantLedgerSection({
  getCustomerLabel,
  marketplaceLedgerPills,
  marketplaceLedgerRows,
  marketplaceOperationsCards,
}: BookingMonitorMarketplaceParticipantLedgerSectionProps) {
  return (
    <>
      <div className="participant-list admin-mt-12">
        <span className="pill pill-info">Participant rows only</span>
        <span className="pill pill-warn">Blocked wallet joins are not participant records</span>
        <span className="pill">Partners may view marketplace requests before join gate</span>
        <span className="pill">Customer-selected final Partner only</span>
        <span className="pill">No automatic final assignment</span>
        {marketplaceLedgerPills.map((pill) => (
          <span className={`pill ${pill.tone}`} key={pill.label}>
            {pill.label}
          </span>
        ))}
        <span className="pill">Customer final choice</span>
        <span className="pill">Participant evidence</span>
        <span className="pill">Marketplace participation gate</span>
      </div>
      <div className="ops-task-grid admin-mt-14">
        {marketplaceOperationsCards.map((card) => (
          <Link className="ops-task-card" href={card.href} key={card.title}>
            <span className={`signal ${card.tone}`}>{card.title}</span>
            <h3>{card.value}</h3>
            <p>{card.detail}</p>
          </Link>
        ))}
      </div>
      {marketplaceLedgerRows.length === 0 ? (
        <div className="empty-state admin-mt-14">
          No participant records match the current booking filters.
        </div>
      ) : (
        <AdminTableScroll>
          <table className="table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Customer / service</th>
                <th>Partner</th>
                <th>Participant evidence</th>
                <th>Status</th>
                <th>Distance</th>
                <th>Window / alerts</th>
                <th>Wallet signal</th>
                <th>Participation / response</th>
                <th>Customer choice</th>
              </tr>
            </thead>
            <tbody>
              {marketplaceLedgerRows.slice(0, 40).map((row) => (
                <tr key={`${row.booking.id}-${row.participant.id}`}>
                  <td>
                    <strong>
                      <Link className="text-link" href={`/bookings/${row.booking.id}`}>
                        {shortId(row.booking.id)}
                      </Link>
                    </strong>
                    <div className="muted">{row.booking.status}</div>
                  </td>
                  <td>
                    <strong>{getCustomerLabel(row.booking)}</strong>
                    <div className="muted">{bookingServiceOptionLabel(row.booking)}</div>
                  </td>
                  <td>
                    <strong>{row.partnerLabel}</strong>
                    <div className="muted">{row.participant.providerProfile?.user?.phone ?? 'No phone'}</div>
                    <span className="pill">{row.roleLabel}</span>
                  </td>
                  <td>
                    <span className={`pill ${row.evidenceTone}`}>{row.evidenceLabel}</span>
                    <div className="muted">{row.evidenceDetail}</div>
                  </td>
                  <td>
                    <span className={`pill ${row.statusTone}`}>{row.statusLabel}</span>
                    <div className="muted">{row.participant.providerStatusAtJoin ?? 'Partner state not saved'}</div>
                  </td>
                  <td>
                    <strong>{row.distanceLabel}</strong>
                    <div>
                      <span className={`pill ${row.distancePolicyTone}`}>{row.distancePolicyLabel}</span>
                    </div>
                    <div className="muted">{row.distancePolicyHelper}</div>
                  </td>
                  <td>
                    <div>{row.windowLabel}</div>
                    <span className={`pill ${row.alertTone}`}>{row.alertLabel}</span>
                  </td>
                  <td>
                    <span className={`pill ${row.walletTone}`}>{row.walletLabel}</span>
                  </td>
                  <td>
                    <div>{row.joinedLabel}</div>
                    <div className="muted">{row.respondedLabel}</div>
                  </td>
                  <td>
                    <span className={`pill ${row.choiceTone}`}>{row.choiceLabel}</span>
                    <div className="participant-list admin-mt-6">
                      <span className={`pill ${row.chatHandoffTone}`}>{row.chatHandoffLabel}</span>
                    </div>
                    <div className="muted">{row.choiceReason}</div>
                    <small>{row.choiceNextStep}</small>
                  </td>
                </tr>
              ))}
              {marketplaceLedgerRows.length > 40 && (
                <tr>
                  <td colSpan={10}>
                    Showing first 40 participant records. Narrow the booking filters to inspect the rest.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTableScroll>
      )}
    </>
  );
}
