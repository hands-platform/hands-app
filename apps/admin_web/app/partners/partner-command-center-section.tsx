import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';

export type PartnerCommandCenterSectionTone = 'danger' | 'info' | 'ok' | 'warn';

export type PartnerCommandCenterSectionLane = {
  readonly detail: string;
  readonly href: string;
  readonly metrics: readonly { readonly label: string; readonly value: string }[];
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerCommandCenterSectionTone;
};

type PartnerCommandCenterSectionProps = {
  readonly lanes: readonly PartnerCommandCenterSectionLane[];
};

export function PartnerCommandCenterSection({ lanes }: PartnerCommandCenterSectionProps) {
  return (
    <section className="card admin-mb-16">
      <AdminSectionHeader
        description="Operator overview across onboarding, dispatch readiness, payout/tax readiness, and report follow-up."
        status={<span className="pill pill-info">Daily control view</span>}
        title="Partner command center"
      />
      <div className="grid admin-mt-12">
        {lanes.map((lane) => (
          <Link className="card" href={lane.href} key={lane.title}>
            <p>{lane.title}</p>
            <h2>{lane.status}</h2>
            <span className={`signal ${partnerCommandCenterToneClass(lane.tone)}`}>
              {partnerCommandCenterToneLabel(lane.tone)}
            </span>
            <p className="muted admin-mt-8">
              {lane.detail}
            </p>
            <div className="participant-list admin-mt-10">
              {lane.metrics.map((item) => (
                <span className="pill" key={item.label}>
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function partnerCommandCenterToneClass(tone: PartnerCommandCenterSectionTone) {
  if (tone === 'danger' || tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}

function partnerCommandCenterToneLabel(tone: PartnerCommandCenterSectionTone) {
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
