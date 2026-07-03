import { ArrowRight, SlidersHorizontal } from 'lucide-react';

import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminActionCard, AdminCard, AdminSection } from '../../components/admin-surface';

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
    <AdminSection
      actions={
        <AdminFormControlLink className="button button-secondary" href="/operations-policy">
          <SlidersHorizontal aria-hidden="true" size={16} />
          Policy: fresh location {'<='} {staleLocationMinutes}m
        </AdminFormControlLink>
      }
      className="admin-mb-16 partner-dispatch-forecast-card"
      description="Converts the filtered partner list into dispatch capacity, recovery work, and city-level supply records for direct requests and marketplace matching."
      title="Dispatch capacity forecast"
    >
      <div className="grid admin-mt-12">
        {forecast.totals.map((item) => (
          <AdminActionCard
            detail={item.detail}
            href={item.href}
            key={item.label}
            signalClassName={partnerDispatchForecastToneClass(item.tone)}
            signalLabel={partnerDispatchForecastToneLabel(item.tone)}
            title={item.label}
            value={item.value}
          />
        ))}
      </div>
      <div className="grid admin-mt-12">
        <AdminCard className="ops-task-note partner-dispatch-panel">
          <h3>Dispatch blockers</h3>
          <div className="setup-stage-list admin-mt-12">
            {forecast.blockers.map((item) => (
              <div className="setup-stage-item" key={item.label}>
                <span>{item.count ? 'FIX' : 'OK'}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.detail}</p>
                </div>
                <AdminFormControlLink className="button button-secondary partner-summary-action" href={item.href}>
                  <ArrowRight aria-hidden="true" size={14} />
                  {item.count}
                </AdminFormControlLink>
              </div>
            ))}
          </div>
        </AdminCard>
        <AdminCard className="ops-task-note partner-dispatch-panel">
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
                <AdminFormControlLink
                  className="button button-secondary partner-summary-action"
                  href={`/partners?q=${encodeURIComponent(lane.city)}`}
                >
                  <ArrowRight aria-hidden="true" size={14} />
                  Open
                </AdminFormControlLink>
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
        </AdminCard>
      </div>
    </AdminSection>
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
