import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';

type PartnerDispatchForecastTone = 'danger' | 'info' | 'ok' | 'warn';

type PartnerDispatchForecastTotal = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly tone: PartnerDispatchForecastTone;
  readonly value: string;
};

type PartnerDispatchForecastBlocker = {
  readonly count: number;
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly tone: PartnerDispatchForecastTone;
};

type PartnerDispatchForecastSupplyLane = {
  readonly blocked: number;
  readonly city: string;
  readonly locationNeedsRefresh: number;
  readonly online: number;
  readonly ready: number;
  readonly total: number;
};

export type PartnerDispatchForecastSectionForecast = {
  readonly blockers: readonly PartnerDispatchForecastBlocker[];
  readonly supplyLanes: readonly PartnerDispatchForecastSupplyLane[];
  readonly totals: readonly PartnerDispatchForecastTotal[];
};

type PartnerDispatchForecastSectionProps = {
  readonly forecast: PartnerDispatchForecastSectionForecast;
  readonly staleLocationMinutes: number;
};

export function PartnerDispatchForecastSection({
  forecast,
  staleLocationMinutes,
}: PartnerDispatchForecastSectionProps) {
  return (
    <section className="card admin-mb-16">
      <AdminSectionHeader
        actions={
          <Link className="text-link" href="/operations-policy">
            Policy: fresh location {'<='} {staleLocationMinutes}m
          </Link>
        }
        description="Converts the filtered partner list into dispatch capacity, recovery work, and city-level supply records for direct requests and marketplace matching."
        title="Dispatch capacity forecast"
      />
      <div className="grid admin-mt-12">
        {forecast.totals.map((item) => (
          <Link className="card" href={item.href} key={item.label}>
            <p>{item.label}</p>
            <h2>{item.value}</h2>
            <span className={`signal ${partnerDispatchForecastToneClass(item.tone)}`}>
              {partnerDispatchForecastToneLabel(item.tone)}
            </span>
            <p className="muted admin-mt-8">
              {item.detail}
            </p>
          </Link>
        ))}
      </div>
      <div className="grid admin-mt-12">
        <div className="card">
          <h3>Dispatch blockers</h3>
          <div className="setup-stage-list admin-mt-12">
            {forecast.blockers.map((item) => (
              <div className="setup-stage-item" key={item.label}>
                <span>{item.count ? 'FIX' : 'OK'}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.detail}</p>
                </div>
                <Link className="text-link" href={item.href}>
                  {item.count}
                </Link>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>City supply lanes</h3>
          <p className="muted">
            Use this to see which partner onboarding, location refresh, or push registration records need
            operator attention.
          </p>
          <div className="setup-stage-list admin-mt-12">
            {forecast.supplyLanes.map((lane) => (
              <div className="setup-stage-item" key={lane.city}>
                <span>{lane.ready ? 'LIVE' : 'CHECK'}</span>
                <div>
                  <strong>{lane.city}</strong>
                  <p className="muted">
                    {lane.ready}/{lane.total} ready, {lane.online} online, {lane.locationNeedsRefresh} need
                    location refresh, {lane.blocked} blocked.
                  </p>
                </div>
                <Link className="text-link" href={`/partners?q=${encodeURIComponent(lane.city)}`}>
                  Open
                </Link>
              </div>
            ))}
            {forecast.supplyLanes.length === 0 ? (
              <div className="setup-stage-item">
                <span>EMPTY</span>
                <div>
                  <strong>No city data yet</strong>
                  <p className="muted">Partner city data will appear here once profiles are filled.</p>
                </div>
                <small>0</small>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function partnerDispatchForecastToneClass(tone: PartnerDispatchForecastTone) {
  if (tone === 'danger' || tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}

function partnerDispatchForecastToneLabel(tone: PartnerDispatchForecastTone) {
  if (tone === 'danger') {
    return 'Immediate check';
  }
  if (tone === 'warn') {
    return 'Monitor';
  }
  if (tone === 'info') {
    return 'Info';
  }
  return 'Clear';
}
