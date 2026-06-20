import Link from 'next/link';
import {
  AdminAvatarStatusDot,
  AdminPersonCell,
  adminPersonInitials,
} from '../../../components/admin-person-cell';
import type {
  BookingUnifiedDetail,
  BookingUnifiedDetailCard,
  BookingUnifiedDetailPerson,
  BookingUnifiedDetailRow,
} from './booking-unified-detail';

export type BookingUnifiedDetailSectionProps = {
  readonly unifiedDetail: BookingUnifiedDetail;
};

export function BookingUnifiedDetailSection({ unifiedDetail }: BookingUnifiedDetailSectionProps) {
  return (
    <>
      <section className="card admin-mb-16 booking-unified-summary-card" id="booking-unified-detail">
        <div className="ops-section-header">
          <div>
            <h2>Unified booking detail</h2>
            <p className="muted">
              One booking record for realtime, in-progress, completed, and post-match cancellation updates.
            </p>
          </div>
          <span className={`pill ${unifiedDetail.statusTone}`}>{unifiedDetail.statusLabel}</span>
        </div>

        <div className="service-trace-summary admin-mt-12">
          {unifiedDetail.summaryCards.map((card) => (
            <BookingUnifiedSummaryCard card={card} key={card.label} />
          ))}
        </div>
      </section>

      <BookingUnifiedRows
        helper="Customer profile, service address, live location, and service request."
        id="booking-customer-detail"
        rows={unifiedDetail.customerRows}
        title="Customer detail"
      />

      <BookingUnifiedRows
        helper="Requested, matched, participating Partner, and location checkpoints."
        id="booking-matched-partner-detail"
        rows={unifiedDetail.matchedPartnerRows}
        title="Matched Partner detail"
      />

      <BookingUnifiedRows
        helper="Closeout, charge, payout, fee, tax, and wallet ledger."
        id="booking-finance-system-detail"
        rows={unifiedDetail.financeRows}
        title="Finance and system detail"
      />
    </>
  );
}

function BookingUnifiedSummaryCard({ card }: { readonly card: BookingUnifiedDetailCard }) {
  const content = (
    <>
      <span>{card.label}</span>
      <strong>{card.value}</strong>
      <small>{card.helper}</small>
    </>
  );

  if (card.href) {
    return (
      <Link href={card.href} title={`Open ${card.label}`}>
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
}

function BookingUnifiedRows({
  helper,
  id,
  rows,
  title,
}: {
  readonly helper: string;
  readonly id: string;
  readonly rows: readonly BookingUnifiedDetailRow[];
  readonly title: string;
}) {
  return (
    <section className="card admin-mb-16 booking-unified-detail-card" id={id}>
      <div className="ops-section-header">
        <div>
          <h3>{title}</h3>
          <p className="muted">{helper}</p>
        </div>
        <span className="pill pill-neutral">{countLabel(rows.length, 'field')}</span>
      </div>
      <div className="booking-unified-detail-grid admin-mt-12">
        {rows.map((row) => (
          <BookingUnifiedInfoCard key={row.label} row={row} />
        ))}
      </div>
    </section>
  );
}

function BookingUnifiedInfoCard({ row }: { readonly row: BookingUnifiedDetailRow }) {
  const detail = row.person && row.detail === row.person.helper ? null : row.detail;

  return (
    <div className={`booking-unified-info-card${row.people?.length ? ' is-wide' : ''}`}>
      <span className="booking-unified-info-label">{row.label}</span>
      {row.person ? <BookingUnifiedPerson person={row.person} /> : <BookingUnifiedValue row={row} />}
      {detail ? <p className="muted">{detail}</p> : null}
      {row.people?.length ? <BookingUnifiedPeople people={row.people} /> : null}
      {row.href && !row.person ? (
        <Link className="text-link booking-unified-open-link" href={row.href}>
          Open record
        </Link>
      ) : null}
    </div>
  );
}

function BookingUnifiedValue({ row }: { readonly row: BookingUnifiedDetailRow }) {
  if (row.href) {
    return (
      <Link className="booking-unified-value-link" href={row.href}>
        {row.value}
      </Link>
    );
  }

  return <strong className="booking-unified-value">{row.value}</strong>;
}

function BookingUnifiedPerson({ person }: { readonly person: BookingUnifiedDetailPerson }) {
  const avatarClassName = person.href?.startsWith('/customers')
    ? 'vuexy-booking-avatar'
    : 'vuexy-booking-avatar is-partner';

  return (
    <AdminPersonCell
      avatarClassName={avatarClassName}
      avatarStatus={person.status}
      avatarStatusLabel={person.statusLabel}
      className="vuexy-booking-person booking-unified-person"
      copyClassName="vuexy-booking-person-copy"
      helper={person.helper}
      href={person.href}
      label={person.label}
      linkClassName="vuexy-booking-person-link"
    />
  );
}

function BookingUnifiedPeople({ people }: { readonly people: readonly BookingUnifiedDetailPerson[] }) {
  return (
    <div className="booking-unified-participant-strip">
      <div className="vuexy-booking-avatar-group" aria-label="Participating Partners">
        {people.slice(0, 5).map((person) => (
          <BookingUnifiedPersonAvatar key={person.id} person={person} />
        ))}
        {people.length > 5 ? (
          <span className="vuexy-booking-avatar-group-item is-overflow">+{people.length - 5}</span>
        ) : null}
      </div>
      <div className="booking-unified-participant-list">
        {people.map((person) => (
          <div className="booking-unified-participant-row" key={`${person.id}-row`}>
            {person.href ? (
              <Link className="booking-unified-participant-link" href={person.href}>
                {person.label}
              </Link>
            ) : (
              <strong>{person.label}</strong>
            )}
            {person.helper ? <small className="muted">{person.helper}</small> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingUnifiedPersonAvatar({ person }: { readonly person: BookingUnifiedDetailPerson }) {
  const content = (
    <>
      {adminPersonInitials(person.label)}
      {person.status ? <AdminAvatarStatusDot label={person.statusLabel} status={person.status} /> : null}
    </>
  );

  if (person.href) {
    return (
      <Link className="vuexy-booking-avatar-group-item" href={person.href} title={person.label}>
        {content}
      </Link>
    );
  }

  return (
    <span className="vuexy-booking-avatar-group-item" title={person.label}>
      {content}
    </span>
  );
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }

  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}
