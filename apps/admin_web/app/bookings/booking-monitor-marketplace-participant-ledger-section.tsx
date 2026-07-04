import Link from 'next/link';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { PillClassBadge } from '../../components/status-badge';
import type { AdminBooking } from '../../lib/admin-api';
import { adminAvatarStatusFromSignals, type AdminAvatarStatus } from '../../lib/admin-avatar-status';
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

const MARKETPLACE_PARTICIPANT_MATCHING_STATUSES = new Set(['CREATED', 'OPEN_MATCHING']);
const MARKETPLACE_PARTICIPANT_WORKING_STATUSES = new Set([
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

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
          <PillClassBadge pillClass={pill.tone} key={pill.label}>
            {pill.label}
          </PillClassBadge>
        ))}
        {marketplaceLedgerPills.length === 0 && (
          <PillClassBadge pillClass="pill-neutral">Participant evidence</PillClassBadge>
        )}
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
        <AdminEmptyState
          className="admin-mt-14"
          framed
          message="No participant records match the current booking filters."
          title={null}
        />
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
                  <AdminPersonCell
                    avatarClassName="vuexy-booking-avatar is-partner"
                    avatarStatus={marketplaceParticipantAvatarStatus(row)}
                    className="vuexy-booking-person"
                    copyClassName="vuexy-booking-person-copy"
                    helper={row.participant.providerProfile?.user?.phone ?? 'No phone'}
                    href={marketplaceParticipantPartnerHref(row.participant)}
                    label={row.partnerLabel}
                    linkClassName="vuexy-booking-person-link"
                  />
                  <PillClassBadge pillClass="pill-neutral">{row.roleLabel}</PillClassBadge>
                </td>
                <td>
                  <PillClassBadge pillClass={row.evidenceTone} title={row.evidenceDetail}>
                    {row.evidenceLabel}
                  </PillClassBadge>
                </td>
                <td>
                  <PillClassBadge pillClass={row.statusTone}>{row.statusLabel}</PillClassBadge>
                  <div className="muted">{row.participant.providerStatusAtJoin ?? 'Partner state not saved'}</div>
                </td>
                <td>
                  <strong>{row.distanceLabel}</strong>
                  <div>
                    <PillClassBadge pillClass={row.distancePolicyTone} title={row.distancePolicyHelper}>
                      {row.distancePolicyLabel}
                    </PillClassBadge>
                  </div>
                </td>
                <td>
                  <div>{row.windowLabel}</div>
                  <PillClassBadge pillClass={row.alertTone}>{row.alertLabel}</PillClassBadge>
                </td>
                <td>
                  <PillClassBadge pillClass={row.walletTone}>{row.walletLabel}</PillClassBadge>
                </td>
                <td>
                  <div>{row.joinedLabel}</div>
                  <div className="muted">{row.respondedLabel}</div>
                </td>
                <td>
                  <PillClassBadge pillClass={row.choiceTone} title={row.choiceReason}>
                    {row.choiceLabel}
                  </PillClassBadge>
                  <div className="participant-list admin-mt-6">
                    <PillClassBadge pillClass={row.chatHandoffTone} title={row.choiceNextStep}>
                      {row.chatHandoffLabel}
                    </PillClassBadge>
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

function marketplaceParticipantAvatarStatus(
  row: MarketplaceParticipantLedgerRow<AdminBooking, BookingParticipant>,
): AdminAvatarStatus {
  const provider = row.participant.providerProfile;
  const participantPartnerId = provider?.id ?? row.participant.providerProfileId ?? null;
  const selectedPartnerId = row.booking.selectedProvider?.id ?? row.booking.selectedProviderId ?? null;
  const providerStatus = row.participant.providerStatusAtJoin ?? provider?.status;

  return adminAvatarStatusFromSignals({
    fallbackOnline: Boolean(providerStatus?.startsWith('ONLINE')),
    matching:
      MARKETPLACE_PARTICIPANT_MATCHING_STATUSES.has(row.booking.status) &&
      ['JOINED', 'ACCEPTED'].includes(row.participant.status),
    working:
      row.participant.status === 'SELECTED' ||
      (MARKETPLACE_PARTICIPANT_WORKING_STATUSES.has(row.booking.status) &&
        Boolean(participantPartnerId) &&
        participantPartnerId === selectedPartnerId),
  });
}

function marketplaceParticipantPartnerHref(participant: BookingParticipant) {
  const partnerId = participant.providerProfile?.id ?? participant.providerProfileId;

  return partnerId ? `/partners/${partnerId}` : null;
}
