import Link from 'next/link';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
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

const MARKETPLACE_PARTICIPANT_LEDGER_HEADERS = [
  'Booking',
  'Customer / service',
  'Partner',
  'Participant evidence',
  'Status',
  'Distance',
  'Window / alerts',
  'Wallet signal',
  'Participation / response',
  'Customer choice',
] as const;

export function BookingMonitorMarketplaceParticipantLedgerSection({
  getCustomerLabel,
  marketplaceLedgerPills,
  marketplaceLedgerRows,
  marketplaceOperationsCards,
}: BookingMonitorMarketplaceParticipantLedgerSectionProps) {
  const visibleMarketplaceOperationsCards = marketplaceOperationsCards.filter(
    (card) => card.tone === 'pill-info' || card.tone === 'pill-warn',
  );

  return (
    <>
      <div className="participant-list admin-mt-12">
        {marketplaceLedgerPills.map((pill) => (
          <span className={`pill ${pill.tone}`} key={pill.label}>
            {pill.label}
          </span>
        ))}
        {marketplaceLedgerPills.length === 0 && <span className="pill">Participant evidence</span>}
      </div>
      <div className="ops-task-grid admin-mt-14">
        {visibleMarketplaceOperationsCards.map((card) => (
          <Link className="ops-task-card" href={card.href} key={card.title}>
            <span className={`signal ${card.tone}`}>{card.title}</span>
            <strong className="ops-task-card-value">{card.value}</strong>
            <p>{card.detail}</p>
          </Link>
        ))}
        {marketplaceOperationsCards.length > 0 && visibleMarketplaceOperationsCards.length === 0 && (
          <div className="ops-task-card">
            <span className="signal pill-success">Clear</span>
            <strong className="ops-task-card-value">0</strong>
            <p>No marketplace participant action is needed for the current filters.</p>
          </div>
        )}
      </div>
      {marketplaceLedgerRows.length === 0 ? (
        <div className="empty-state admin-mt-14">
          No participant records match the current booking filters.
        </div>
      ) : (
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={null}
            headers={MARKETPLACE_PARTICIPANT_LEDGER_HEADERS}
            rowCount={marketplaceLedgerRows.length}
          >
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
                  <span className={`pill ${row.evidenceTone}`} title={row.evidenceDetail}>
                    {row.evidenceLabel}
                  </span>
                </td>
                <td>
                  <span className={`pill ${row.statusTone}`}>{row.statusLabel}</span>
                  <div className="muted">{row.participant.providerStatusAtJoin ?? 'Partner state not saved'}</div>
                </td>
                <td>
                  <strong>{row.distanceLabel}</strong>
                  <div>
                    <span className={`pill ${row.distancePolicyTone}`} title={row.distancePolicyHelper}>
                      {row.distancePolicyLabel}
                    </span>
                  </div>
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
                  <span className={`pill ${row.choiceTone}`} title={row.choiceReason}>
                    {row.choiceLabel}
                  </span>
                  <div className="participant-list admin-mt-6">
                    <span className={`pill ${row.chatHandoffTone}`} title={row.choiceNextStep}>
                      {row.chatHandoffLabel}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {marketplaceLedgerRows.length > 40 && (
              <tr>
                <td colSpan={MARKETPLACE_PARTICIPANT_LEDGER_HEADERS.length}>
                  Showing first 40 participant records. Narrow the booking filters to inspect the rest.
                </td>
              </tr>
            )}
          </AdminDataTable>
        </AdminTableScroll>
      )}
    </>
  );
}
