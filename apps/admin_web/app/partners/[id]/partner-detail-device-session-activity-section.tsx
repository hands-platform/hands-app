import { ActionMenu, type ActionMenuItem } from '../../../components/action-menu';

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
  readonly blockReason?: string | null;
  readonly detail: string;
  readonly id: string;
  readonly smallLabel: string;
  readonly statusLabel: string;
  readonly title: string;
};

export type PartnerSessionRow = {
  readonly detail: string;
  readonly id: string;
  readonly sessionNote?: string | null;
  readonly smallLabel: string;
  readonly statusLabel: string;
  readonly title: string;
};

export type PartnerSharedDeviceRow = {
  readonly detail: string;
  readonly id: string;
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
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Device and session activity</h2>
          <p className="muted">
            Review shared devices, session checks, blocked devices, and stale partner app activity.
          </p>
        </div>
        <span className={`pill ${followUpNeeded ? 'pill-danger' : 'pill-success'}`}>
          {followUpNeeded ? 'Follow-up needed' : 'No active follow-up'}
        </span>
      </div>
      <div className="ops-task-grid">
        {securityCards.map((card) => (
          <div className={`ops-task-card ${cardClassForTone(card.tone)}`} key={card.title}>
            <div>
              <span className={`pill ${pillClassForTone(card.tone)}`}>{card.status}</span>
              <h3>{card.title}</h3>
              <p className="muted">{card.detail}</p>
            </div>
            <small>{card.action}</small>
          </div>
        ))}
      </div>
      <div className="detail-grid admin-mt-16">
        <div>
          <h3>Partner app devices</h3>
          {deviceRows.length ? (
            <div className="setup-stage-list">
              {deviceRows.map((device) => (
                <div className="setup-stage-item" key={device.id}>
                  <span>{device.statusLabel}</span>
                  <div>
                    <strong>{device.title}</strong>
                    <p className="muted">{device.detail}</p>
                    {device.blockReason ? (
                      <p className="muted">Block reason: {device.blockReason}</p>
                    ) : null}
                  </div>
                  <small>{device.smallLabel}</small>
                  <ActionMenu actions={device.actions} label={device.actionLabel} />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              No partner app device record yet. It should appear after partner app sign-in.
            </p>
          )}
        </div>
        <div>
          <h3>Recent sessions</h3>
          {sessionRows.length ? (
            <div className="setup-stage-list">
              {sessionRows.map((session) => (
                <div className="setup-stage-item" key={session.id}>
                  <span>{session.statusLabel}</span>
                  <div>
                    <strong>{session.title}</strong>
                    <p className="muted">{session.detail}</p>
                    {session.sessionNote ? (
                      <p className="muted">Session note: {session.sessionNote}</p>
                    ) : null}
                  </div>
                  <small>{session.smallLabel}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No partner session log yet.</p>
          )}
        </div>
      </div>
      {sharedDeviceRows.length ? (
        <div className="setup-stage-list admin-mt-16">
          {sharedDeviceRows.map((match) => (
            <div className="setup-stage-item" key={match.id}>
              <span>SHARED</span>
              <div>
                <strong>{match.title}</strong>
                <p className="muted">{match.detail}</p>
              </div>
              <small>{match.smallLabel}</small>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
