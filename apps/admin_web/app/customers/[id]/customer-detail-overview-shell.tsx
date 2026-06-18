import Link from 'next/link';
import { BellRing, Bookmark, MapPin, MessageSquareText, Smartphone, Wallet } from 'lucide-react';
import { AdminAvatarStatusDot } from '../../../components/admin-person-cell';
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

export type CustomerDetailOverviewAction = {
  readonly href: string;
  readonly label: string;
};

export type CustomerDetailOverviewNavItem = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly value: string;
};

type CustomerDetailOverviewShellProps = {
  readonly actions: readonly CustomerDetailOverviewAction[];
  readonly avatarStatus: AdminAvatarStatus;
  readonly facts: readonly CustomerDetailOverviewFact[];
  readonly highlights: readonly CustomerDetailOverviewHighlight[];
  readonly name: string;
  readonly navigation: readonly CustomerDetailOverviewNavItem[];
  readonly statusBadges: readonly string[];
  readonly subtitle: string;
};

export function CustomerDetailOverviewShell({
  actions,
  avatarStatus,
  facts,
  highlights,
  name,
  navigation,
  statusBadges,
  subtitle,
}: CustomerDetailOverviewShellProps) {
  return (
    <aside className="customer-detail-sidebar">
      <section className="card customer-detail-overview-card">
        <div className="customer-detail-identity">
          <span className="admin-person-avatar-shell">
            <span className="customer-detail-avatar" aria-hidden="true">
              {readInitials(name)}
            </span>
            <AdminAvatarStatusDot status={avatarStatus} />
          </span>
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

        <div className="customer-detail-action-list">
          {actions.map((action, index) => (
            <Link className={index === 0 ? 'customer-detail-action-primary' : 'customer-detail-action-link'} href={action.href} key={action.href}>
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="card customer-detail-overview-card">
        <div className="ops-section-header">
          <div>
            <h2>Customer record navigation</h2>
            <p className="muted">
              Same detail flow, but grouped like Vuexy user view: overview first, then records and
              operating evidence.
            </p>
          </div>
          <span className="pill pill-neutral">{navigation.length} sections</span>
        </div>
        <div className="customer-detail-nav-list">
          {navigation.map((item) => (
            <a href={item.href} key={item.label}>
              <span className="customer-detail-nav-icon" aria-hidden="true">
                {iconForSection(item.label)}
              </span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </div>
              <em>{item.value}</em>
            </a>
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

function iconForSection(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes('booking')) {
    return <Bookmark size={15} />;
  }
  if (normalized.includes('wallet') || normalized.includes('payment')) {
    return <Wallet size={15} />;
  }
  if (normalized.includes('chat')) {
    return <MessageSquareText size={15} />;
  }
  if (normalized.includes('address')) {
    return <MapPin size={15} />;
  }
  if (normalized.includes('activity') || normalized.includes('session')) {
    return <Smartphone size={15} />;
  }

  return <BellRing size={15} />;
}
