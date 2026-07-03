import Link from 'next/link';

import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminKpiCard, AdminSection } from '../../../components/admin-surface';
import { marketplaceDisplayText } from '../../../lib/admin-copy';

export type PartnerDetailFastOverviewCard = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly tone: string;
  readonly value: string;
};

export type PartnerDetailFastOverviewInfoLine = {
  readonly label: string;
  readonly value?: string | null;
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
          <Link className="button button-secondary" href="/partners">
            Back to partners
          </Link>
          <Link className="text-link" href={fullHref}>
            Open full dossier
          </Link>
          <Link className="text-link" href={accountControlsHref}>
            Account controls
          </Link>
        </>
      }
      description={marketplaceDisplayText(subtitle)}
      title={partnerName}
    >
      <section className="grid admin-mb-16">
        {overviewCards.map((card) => (
          <AdminKpiCard helper={card.detail} href={card.href} key={card.label} label={card.label} value={card.value} />
        ))}
      </section>

      <section className="detail-grid">
        <OverviewDetailCard title="Identity" rows={identityRows} />
        <OverviewDetailCard title="Booking command" rows={bookingCommandRows} />
        <OverviewDetailCard title="Payout readiness" rows={payoutReadinessRows} />

        <AdminSection className="partner-fast-overview-panel" title="Next operator action">
          {nextOperatorActionNotes.map((note) => (
            <p className="muted" key={note}>
              {marketplaceDisplayText(note)}
            </p>
          ))}
          <div className="participant-list">
            {nextOperatorActionLinks.map((link) => (
              <Link className="pill pill-info" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </AdminSection>
      </section>
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
        <InfoLine key={row.label} label={row.label} value={row.value} />
      ))}
    </AdminSection>
  );
}

function InfoLine({ label, value }: PartnerDetailFastOverviewInfoLine) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {value && value.trim() ? marketplaceDisplayText(value) : 'Missing'}
    </p>
  );
}
