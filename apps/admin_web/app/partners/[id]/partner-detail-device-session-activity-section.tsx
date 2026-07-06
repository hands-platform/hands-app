import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { DateTimeText } from '../../../components/date-time-text';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminDetailGrid, AdminTaskCard } from '../../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

type PartnerOpsTone = 'done' | 'pending' | 'blocked';

export type PartnerDeviceSessionSecurityCard = {
  readonly action: string;
  readonly detail: string;
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerOpsTone;
};

export type PartnerDeviceRow = {
  readonly actionLabel: string;
  readonly actions: readonly ActionMenuItem[];
  readonly blockedAt?: string | null;
  readonly blockReason?: string | null;
  readonly detail: string;
  readonly id: string;
  readonly lastSeenAt?: string | null;
  readonly smallLabel: string;
  readonly statusLabel: string;
  readonly title: string;
};

export type PartnerSessionRow = {
  readonly detail: string;
  readonly id: string;
  readonly lastSeenAt?: string | null;
  readonly loggedInAt?: string | null;
  readonly sessionNote?: string | null;
  readonly smallLabel: string;
  readonly statusLabel: string;
  readonly title: string;
};

export type PartnerSharedDeviceRow = {
  readonly detail: string;
  readonly id: string;
  readonly lastSeenAt?: string | null;
  readonly smallLabel: string;
  readonly title: string;
};

type PartnerDetailDeviceSessionActivitySectionProps = {
  readonly cardClassForTone: (tone: PartnerOpsTone) => string;
  readonly deviceRows: readonly PartnerDeviceRow[];
  readonly followUpNeeded: boolean;
  readonly pillClassForTone: (tone: PartnerOpsTone) => string;
  readonly securityCards: readonly PartnerDeviceSessionSecurityCard[];
  readonly sessionRows: readonly PartnerSessionRow[];
  readonly sharedDeviceRows: readonly PartnerSharedDeviceRow[];
};

const deviceActivityHeaders = ['Status', 'Device', 'Activity', 'Action'];
const sessionActivityHeaders = ['Status', 'Session', 'Activity'];
const sharedDeviceHeaders = ['State', 'Match', 'Activity'];

export function PartnerDetailDeviceSessionActivitySection({
  cardClassForTone,
  deviceRows,
  followUpNeeded,
  pillClassForTone,
  securityCards,
  sessionRows,
  sharedDeviceRows,
}: PartnerDetailDeviceSessionActivitySectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="Review shared devices, session checks, blocked devices, and stale partner app activity."
      id="device-session-activity"
      resultLabel={followUpNeeded ? 'Follow-up needed' : 'No active follow-up'}
      resultTone={followUpNeeded ? 'danger' : 'success'}
      title="Device and session activity"
    >
      <div className="ops-task-grid">
        {securityCards.map((card) => (
          <AdminTaskCard
            actionLabel={card.action}
            className={cardClassForTone(card.tone)}
            detail={card.detail}
            key={card.title}
            leading={
              <StatusBadge tone={statusBadgeToneFromPillClass(pillClassForTone(card.tone))}>
                {card.status}
              </StatusBadge>
            }
            title={card.title}
          />
        ))}
      </div>
      <AdminDetailGrid className="admin-mt-16">
        <div>
          <h3>Partner app devices</h3>
          <AdminTableScroll>
            <AdminDataTable
              className={partnerDetailReviewTableClassName}
              emptyMessage={
                <PartnerDeviceSessionEmptyState message="No partner app device record yet. It should appear after partner app sign-in." />
              }
              headers={deviceActivityHeaders}
              rowCount={deviceRows.length}
            >
              {deviceRows.map((device) => (
                <tr key={device.id}>
                  <td>
                    <StatusBadge tone="info">{device.statusLabel}</StatusBadge>
                  </td>
                  <td>
                    <strong>{device.title}</strong>
                    {device.blockReason ? (
                      <p className="muted">Block reason: {device.blockReason}</p>
                    ) : null}
                  </td>
                  <td>
                    <p className="muted">
                      {device.detail}
                      <LastSeenText value={device.lastSeenAt} />
                    </p>
                    <small>
                      {device.blockedAt ? (
                        <DateTimeText fallback={device.smallLabel} value={device.blockedAt} />
                      ) : (
                        device.smallLabel
                      )}
                    </small>
                  </td>
                  <td>
                    <ActionMenu actions={device.actions} label={device.actionLabel} />
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={deviceRows.length} />
        </div>
        <div>
          <h3>Recent sessions</h3>
          <AdminTableScroll>
            <AdminDataTable
              className={partnerDetailReviewTableClassName}
              emptyMessage={<PartnerDeviceSessionEmptyState message="No partner session log yet." />}
              headers={sessionActivityHeaders}
              rowCount={sessionRows.length}
            >
              {sessionRows.map((session) => (
                <tr key={session.id}>
                  <td>
                    <StatusBadge tone="info">{session.statusLabel}</StatusBadge>
                  </td>
                  <td>
                    <strong>{session.title}</strong>
                    {session.sessionNote ? (
                      <p className="muted">Session note: {session.sessionNote}</p>
                    ) : null}
                  </td>
                  <td>
                    <p className="muted">
                      {session.detail}
                      <LastSeenText value={session.lastSeenAt} />
                    </p>
                    <small>
                      {session.loggedInAt ? (
                        <DateTimeText fallback={session.smallLabel} value={session.loggedInAt} />
                      ) : (
                        session.smallLabel
                      )}
                    </small>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={sessionRows.length} />
        </div>
      </AdminDetailGrid>
      {sharedDeviceRows.length ? (
        <div className="admin-mt-16">
          <AdminTableScroll>
            <AdminDataTable
              className={partnerDetailReviewTableClassName}
              emptyMessage={null}
              headers={sharedDeviceHeaders}
              rowCount={sharedDeviceRows.length}
            >
              {sharedDeviceRows.map((match) => (
                <tr key={match.id}>
                  <td>
                    <StatusBadge tone="warning">SHARED</StatusBadge>
                  </td>
                  <td>
                    <strong>{match.title}</strong>
                  </td>
                  <td>
                    <p className="muted">
                      {match.detail}
                      <LastSeenText value={match.lastSeenAt} />
                    </p>
                    <small>{match.smallLabel}</small>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={sharedDeviceRows.length} />
        </div>
      ) : null}
    </PartnerDetailVuexyTablePanel>
  );
}

function PartnerDeviceSessionEmptyState({ message }: { readonly message: string }) {
  return <AdminEmptyState framed message={message} />;
}

function LastSeenText({ value }: { readonly value?: string | null }) {
  return value ? (
    <>
      {' / last seen '}
      <DateTimeText fallback="Missing" value={value} />
    </>
  ) : null;
}
