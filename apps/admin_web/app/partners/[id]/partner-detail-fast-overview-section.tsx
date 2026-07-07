import type { ReactNode } from 'react';

import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminMetricGrid, AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminDetailGrid, AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadgeLink } from '../../../components/status-badge';
import { marketplaceDisplayText } from '../../../lib/admin-copy';

export type PartnerDetailFastOverviewCard = {
  readonly detail: ReactNode;
  readonly href: string;
  readonly label: string;
  readonly tone: string;
  readonly value: ReactNode;
  readonly valueDateTimeFallback?: string;
  readonly valueDateTimeValue?: string | null;
};

export type PartnerDetailFastOverviewInfoLine = {
  readonly label: string;
  readonly value?: string | null;
  readonly valueNode?: ReactNode;
};

export type PartnerDetailFastOverviewLink = {
  readonly href: string;
  readonly label: string;
};

type PartnerDetailFastOverviewSectionProps = {
  readonly accountControlsHref: string;
  readonly bookingCommandRows: readonly PartnerDetailFastOverviewInfoLine[];
  readonly fullHref: string;
  readonly identityRows: readonly PartnerDetailFastOverviewInfoLine[];
  readonly nextOperatorActionLinks: readonly PartnerDetailFastOverviewLink[];
  readonly nextOperatorActionNotes: readonly string[];
  readonly overviewCards: readonly PartnerDetailFastOverviewCard[];
  readonly partnerName: string;
  readonly payoutReadinessRows: readonly PartnerDetailFastOverviewInfoLine[];
  readonly subtitle: string;
};

export function PartnerDetailFastOverviewSection({
  accountControlsHref,
  bookingCommandRows,
  fullHref,
  identityRows,
  nextOperatorActionLinks,
  nextOperatorActionNotes,
  overviewCards,
  partnerName,
  payoutReadinessRows,
  subtitle,
}: PartnerDetailFastOverviewSectionProps) {
  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink href="/partners">
            Back to partners
          </AdminFormControlLink>
          <AdminTextLink href={fullHref}>
            Open full dossier
          </AdminTextLink>
          <AdminTextLink href={accountControlsHref}>
            Account controls
          </AdminTextLink>
        </>
      }
      description={marketplaceDisplayText(subtitle)}
      title={partnerName}
    >
      <AdminMetricGrid
        className="admin-mb-16"
        metrics={overviewCards.map((card) => ({
          helper: card.detail,
          href: card.href,
          label: card.label,
          value: card.value,
          valueDateTimeFallback: card.valueDateTimeFallback,
          valueDateTimeValue: card.valueDateTimeValue,
        }))}
      />

      <AdminDetailGrid>
        <OverviewDetailCard title="Identity" rows={identityRows} />
        <OverviewDetailCard title="Booking command" rows={bookingCommandRows} />
        <OverviewDetailCard title="Payout readiness" rows={payoutReadinessRows} />

        <AdminSection className="partner-fast-overview-panel" title="Next operator action">
          {nextOperatorActionNotes.map((note) => (
            <p className="muted" key={note}>
              {marketplaceDisplayText(note)}
            </p>
          ))}
          <AdminFilterChipGroup ariaLabel="Next operator action links">
            {nextOperatorActionLinks.map((link) => (
              <StatusBadgeLink href={link.href} key={link.href} tone="info">
                {link.label}
              </StatusBadgeLink>
            ))}
          </AdminFilterChipGroup>
        </AdminSection>
      </AdminDetailGrid>
    </AdminPageTemplate>
  );
}

function OverviewDetailCard({
  rows,
  title,
}: {
  readonly rows: readonly PartnerDetailFastOverviewInfoLine[];
  readonly title: string;
}) {
  return (
    <AdminSection className="partner-fast-overview-panel" title={title}>
      {rows.map((row) => (
        <InfoLine key={row.label} label={row.label} value={row.value} valueNode={row.valueNode} />
      ))}
    </AdminSection>
  );
}

function InfoLine({ label, value, valueNode }: PartnerDetailFastOverviewInfoLine) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {valueNode ?? renderInfoLineValue(value)}
    </p>
  );
}

function renderInfoLineValue(value?: string | null) {
  return value && value.trim() ? marketplaceDisplayText(value) : <AdminInlineFallback>Missing</AdminInlineFallback>;
}
