import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { DateTimeText } from '../../../components/date-time-text';
import { AdminProfileOverviewCard } from '../../../components/admin-overview-card';
import { AdminAvatar } from '../../../components/admin-person-cell';
import { AdminCard } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';
import { adminCountLabel } from '../../../lib/admin-copy';

export type CustomerDetailOverviewFact = {
  readonly helper: ReactNode;
  readonly label: string;
  readonly value: ReactNode;
  readonly valueDateTimeFallback?: string;
  readonly valueDateTimeValue?: string | null;
};

export type CustomerDetailContactRow = {
  readonly id: string;
  readonly label: ReactNode;
  readonly value: ReactNode;
};

export type CustomerDetailPartnerAvatar = {
  readonly helper: ReactNode;
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

type CustomerDetailOverviewShellProps = {
  readonly contactRows?: readonly CustomerDetailContactRow[];
  readonly avatarStatus: AdminAvatarStatus;
  readonly facts: readonly CustomerDetailOverviewFact[];
  readonly name: string;
  readonly statusBadges: readonly string[];
  readonly subtitle: string;
};

type CustomerDetailBehaviorContextProps = {
  readonly partnerRails?: readonly CustomerDetailPartnerRail[];
};

export function CustomerDetailOverviewShell({
  avatarStatus,
  contactRows,
  facts,
  name,
  statusBadges,
  subtitle,
}: CustomerDetailOverviewShellProps) {
  const visibleContactRows = contactRows?.slice(0, 2) ?? [];
  const retainedContactRows = contactRows?.slice(2) ?? [];

  return (
    <AdminProfileOverviewCard className="customer-detail-overview-card">
      <div className="customer-detail-overview-main">
        <div className="customer-detail-identity">
          <AdminAvatar
            className="vuexy-booking-avatar customer-detail-avatar"
            initials={readInitials(name)}
            status={avatarStatus}
          />
          <div className="customer-detail-identity-copy">
            <span>Profile and contact</span>
            <h3>{name}</h3>
            <p>{subtitle}</p>
          </div>
        </div>

        {statusBadges.length > 0 ? (
          <AdminFilterChipGroup className="customer-detail-badges">
            {statusBadges.map((badge) => (
              <StatusBadge tone="info" key={badge}>
                {badge}
              </StatusBadge>
            ))}
          </AdminFilterChipGroup>
        ) : null}
      </div>

      <div className="customer-detail-fact-list">
        {facts.map((fact) => (
          <div key={fact.label}>
            <span>{fact.label}</span>
            <strong>{customerDetailOverviewFactValue(fact)}</strong>
            <small>{fact.helper}</small>
          </div>
        ))}
      </div>

      {contactRows ? (
        <div className="customer-detail-contact-list">
          <div className="customer-detail-contact-list-header">
            <div>
              <span>Saved addresses</span>
              <small>Primary and latest service addresses</small>
            </div>
            <strong>{contactRows.length}</strong>
          </div>
          {contactRows.length > 0 ? (
            <>
              <div className="customer-detail-contact-list-rows">
                {visibleContactRows.map((row) => (
                  <div key={row.id}>
                    <strong>{row.label}</strong>
                    <span>{row.value}</span>
                  </div>
                ))}
              </div>
              {retainedContactRows.length > 0 ? (
                <details className="customer-address-disclosure">
                  <summary>View {adminCountLabel(retainedContactRows.length, 'more address record')}</summary>
                  <div className="customer-detail-contact-list-rows">
                    {retainedContactRows.map((row) => (
                      <div key={row.id}>
                        <strong>{row.label}</strong>
                        <span>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <AdminEmptyState framed message="No saved address yet." title={null} />
          )}
        </div>
      ) : null}
    </AdminProfileOverviewCard>
  );
}

export function CustomerDetailBehaviorContext({ partnerRails = [] }: CustomerDetailBehaviorContextProps) {
  return (
    <>
      {partnerRails.length > 0 ? (
        <div className="customer-detail-partner-rail-grid">
          {partnerRails.map((rail) => {
            const totalCount = rail.totalCount ?? rail.partners.length;
            const countLabel =
              totalCount > rail.partners.length
                ? `${rail.partners.length}/${totalCount}`
                : String(totalCount);

            return (
              <AdminCard className="customer-detail-partner-rail" key={rail.title}>
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
                            <Link className="vuexy-booking-person-link" href={partner.href} prefetch={false}>
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
              </AdminCard>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

function customerDetailOverviewFactValue(fact: CustomerDetailOverviewFact) {
  if (fact.valueDateTimeValue !== undefined) {
    return (
      <DateTimeText
        fallback={fact.valueDateTimeFallback ?? String(fact.value)}
        value={fact.valueDateTimeValue}
      />
    );
  }

  return fact.value;
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
