import { AdminAvatar } from '../../../components/admin-person-cell';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';

export type CustomerDetailOverviewFact = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

export type CustomerDetailOverviewHighlight = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

type CustomerDetailOverviewShellProps = {
  readonly avatarStatus: AdminAvatarStatus;
  readonly facts: readonly CustomerDetailOverviewFact[];
  readonly highlights: readonly CustomerDetailOverviewHighlight[];
  readonly name: string;
  readonly statusBadges: readonly string[];
  readonly subtitle: string;
};

export function CustomerDetailOverviewShell({
  avatarStatus,
  facts,
  highlights,
  name,
  statusBadges,
  subtitle,
}: CustomerDetailOverviewShellProps) {
  return (
    <aside className="customer-detail-sidebar">
      <section className="card customer-detail-overview-card">
        <div className="customer-detail-identity">
          <AdminAvatar className="customer-detail-avatar" initials={readInitials(name)} status={avatarStatus} />
          <div>
            <h2>{name}</h2>
            <p>{subtitle}</p>
          </div>
        </div>

        <div className="participant-list customer-detail-badges">
          {statusBadges.map((badge) => (
            <span className="pill pill-info" key={badge}>
              {badge}
            </span>
          ))}
        </div>

        <div className="customer-detail-highlight-grid">
          {highlights.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>

        <div className="customer-detail-fact-list">
          {facts.map((fact) => (
            <div key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
              <small>{fact.helper}</small>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function readInitials(name: string) {
  const tokens = name
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (tokens.length === 0) {
    return 'CU';
  }

  return tokens.map((token) => token[0]?.toUpperCase() ?? '').join('');
}
