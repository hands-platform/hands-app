import Link from 'next/link';

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
    <>
      <section className="toolbar">
        <div>
          <p className="muted">
            <Link className="text-link" href="/partners">
              Back to partners
            </Link>
          </p>
          <h1>{partnerName}</h1>
          <p className="muted">{marketplaceDisplayText(subtitle)}</p>
        </div>
        <div className="actions">
          <Link className="text-link" href={fullHref}>
            Open full dossier
          </Link>
          <Link className="text-link" href={accountControlsHref}>
            Account controls
          </Link>
        </div>
      </section>

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
    </>
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
