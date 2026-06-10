import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';
import type { PartnerCommandLane } from './partner-command-center';
import {
  partnerShiftCardClass,
  partnerShiftPillClass,
  type PartnerShiftHandoff,
} from './partner-shift-handoff';

export type PartnerShiftHandoffSectionModel = PartnerShiftHandoff;

type PartnerShiftHandoffSectionProps = {
  readonly handoff: PartnerShiftHandoffSectionModel;
};

export function PartnerShiftHandoffSection({ handoff }: PartnerShiftHandoffSectionProps) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <AdminSectionHeader
        description="The first operator read for this partner queue. It turns KYC, wallet debt, dispatch readiness, location freshness, push readiness, and payout setup into a practical work order."
        status={<span className={`signal ${partnerCommandToneClass(handoff.tone)}`}>{handoff.label}</span>}
        title="Partner shift handoff"
      />
      <div className="ops-task-note" style={{ marginTop: 14 }}>
        <div className="ops-row">
          <div>
            <span className="pill pill-info">Next best partner move</span>
            <strong>{handoff.headline}</strong>
            <p className="muted">{handoff.detail}</p>
          </div>
          <Link className="text-link" href={handoff.primaryAction.href}>
            {handoff.primaryAction.label}
          </Link>
        </div>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 14 }}>
        {handoff.stats.map((stat) => (
          <Link
            className={`ops-task-breakdown-item ops-task-breakdown-${partnerDashboardTone(stat.tone)}`}
            href={stat.href}
            key={stat.label}
          >
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.detail}</small>
          </Link>
        ))}
      </div>
      <div className="ops-task-grid" style={{ marginTop: 14 }}>
        {handoff.actions.map((item) => (
          <Link
            className={`ops-task-card ${partnerShiftCardClass(item.tone)}`}
            href={item.href}
            key={item.title}
          >
            <span className={`pill ${partnerShiftPillClass(item.tone)}`}>{item.scope}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <small>{item.operatorAction}</small>
            <div className="participant-list" style={{ marginTop: 10 }}>
              {item.samples.length ? (
                item.samples.map((sample) => (
                  <span className="pill" key={`${item.title}-${sample}`}>
                    {sample}
                  </span>
                ))
              ) : (
                <span className="pill pill-success">No immediate partner sample</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function partnerDashboardTone(tone: PartnerCommandLane['tone']) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warn') return 'warn';
  if (tone === 'info') return 'info';
  return 'ok';
}

function partnerCommandToneClass(tone: PartnerCommandLane['tone']) {
  if (tone === 'danger' || tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}
