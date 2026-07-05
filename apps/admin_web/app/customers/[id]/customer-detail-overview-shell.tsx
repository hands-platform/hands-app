import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminAvatar } from '../../../components/admin-person-cell';
import { AdminCard } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';

export type CustomerDetailOverviewFact = {
  readonly helper: ReactNode;
  readonly label: string;
  readonly value: ReactNode;
};

export type CustomerDetailOverviewHighlight = {
  readonly helper: ReactNode;
  readonly label: string;
  readonly value: ReactNode;
};

export type CustomerDetailPartnerAvatar = {
  readonly helper: string;
  readonly href: string | null;
  readonly id: string;
  readonly label: string;
  readonly status: AdminAvatarStatus;
};

export type CustomerDetailPartnerRail = {
  readonly emptyMessage: string;
  readonly helper: string;
  readonly partners: readonly CustomerDetailPartnerAvatar[];
  readonly title: string;
  readonly totalCount?: number;
};

export type CustomerDetailUsageSummaryItem = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

export type CustomerDetailUsageSummary = {
  readonly helper: string;
  readonly items: readonly CustomerDetailUsageSummaryItem[];
  readonly regionRows: readonly CustomerDetailUsageSummaryItem[];
  readonly title: string;
};

type CustomerDetailOverviewShellProps = {
  readonly avatarStatus: AdminAvatarStatus;
  readonly facts: readonly CustomerDetailOverviewFact[];
  readonly highlights: readonly CustomerDetailOverviewHighlight[];
  readonly name: string;
  readonly partnerRails?: readonly CustomerDetailPartnerRail[];
  readonly statusBadges: readonly string[];
  readonly subtitle: string;
  readonly usageSummary?: CustomerDetailUsageSummary;
};

export function CustomerDetailOverviewShell({
  avatarStatus,
  facts,
  highlights,
  name,
  partnerRails = [],
  statusBadges,
  subtitle,
  usageSummary,
}: CustomerDetailOverviewShellProps) {
  return (
    <AdminCard className="customer-detail-overview-card">
      <div className="customer-detail-overview-main">
        <div className="customer-detail-identity">
          <AdminAvatar
            className="vuexy-booking-avatar customer-detail-avatar"
            initials={readInitials(name)}
            status={avatarStatus}
          />
          <div className="customer-detail-identity-copy">
            <span>Customer profile</span>
            <h2>{name}</h2>
            <p>{subtitle}</p>
          </div>
        </div>

        <div className="participant-list customer-detail-badges">
          {statusBadges.map((badge) => (
            <StatusBadge tone="info" key={badge}>
              {badge}
            </StatusBadge>
          ))}
        </div>
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

      {usageSummary ? (
        <section className="customer-detail-usage-summary">
          <div className="customer-detail-usage-summary-header">
            <div>
              <span>{usageSummary.title}</span>
              <small>{usageSummary.helper}</small>
            </div>
            <strong>{usageSummary.regionRows.length} region(s)</strong>
          </div>
          <div className="customer-detail-usage-summary-grid">
            {usageSummary.items.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.helper}</small>
              </div>
            ))}
          </div>
          <div className="customer-detail-usage-region-list">
            {usageSummary.regionRows.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
                <small>{row.helper}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {partnerRails.length > 0 ? (
        <div className="customer-detail-partner-rail-grid">
          {partnerRails.map((rail) => {
            const totalCount = rail.totalCount ?? rail.partners.length;
            const countLabel =
              totalCount > rail.partners.length ? `${rail.partners.length}/${totalCount}` : String(totalCount);

            return (
              <section className="customer-detail-partner-rail" key={rail.title}>
                <div className="customer-detail-partner-rail-header">
                  <div>
                    <span>{rail.title}</span>
                    <small>{rail.helper}</small>
                  </div>
                  <strong>{countLabel}</strong>
                </div>

                {rail.partners.length > 0 ? (
                  <div className="customer-detail-partner-avatar-list">
                    {rail.partners.map((partner) => (
                      <div className="customer-detail-partner-avatar-item" key={partner.id}>
                        <AdminAvatar
                          className="vuexy-booking-avatar is-partner"
                          initials={readInitials(partner.label)}
                          status={partner.status}
                        />
                        <div className="customer-detail-partner-avatar-copy">
                          {partner.href ? (
                            <Link className="vuexy-booking-person-link" href={partner.href}>
                              {partner.label}
                            </Link>
                          ) : (
                            <strong>{partner.label}</strong>
                          )}
                          <small>{partner.helper}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <AdminEmptyState
                    className="customer-detail-partner-empty"
                    framed
                    message={rail.emptyMessage}
                    title={null}
                  />
                )}
              </section>
            );
          })}
        </div>
      ) : null}
    </AdminCard>
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
