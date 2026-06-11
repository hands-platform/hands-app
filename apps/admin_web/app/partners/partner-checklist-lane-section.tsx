import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';

type PartnerChecklistLaneTone = 'blocked' | 'done' | 'pending';

export type PartnerChecklistLaneSectionItem = {
  readonly actionDetail: string;
  readonly actionStatus: string;
  readonly actionTone: PartnerChecklistLaneTone;
  readonly href: string;
  readonly operatorAction: string;
  readonly partnerId: string;
  readonly partnerName: string;
};

type PartnerChecklistLaneSectionProps = {
  readonly blockedCount: number;
  readonly items: readonly PartnerChecklistLaneSectionItem[];
};

export function PartnerChecklistLaneSection({ blockedCount, items }: PartnerChecklistLaneSectionProps) {
  return (
    <section className="card admin-mb-16">
      <AdminSectionHeader
        description="Suggested operator order for fixing factual blockers from profile, KYC, document, bank, tax, wallet, location, and push readiness."
        status={
          <span className={`pill ${blockedCount === 0 ? 'pill-success' : 'pill-danger'}`}>
            {blockedCount} blocked
          </span>
        }
        title="Partner checklist lane"
      />
      <div className="setup-stage-list">
        {items.map((item) => (
          <div className="setup-stage-item" key={item.partnerId}>
            <span>{item.actionStatus}</span>
            <div>
              <strong>
                <Link className="text-link" href={item.href}>
                  {item.partnerName}
                </Link>
              </strong>
              <p className="muted">{item.actionDetail}</p>
              <p className="muted">{item.operatorAction}</p>
            </div>
            <small>{partnerChecklistLaneActionLabel(item.actionTone)}</small>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="setup-stage-item">
            <span>OK</span>
            <div>
              <strong>No partners need immediate attention</strong>
              <p className="muted">The current filtered list has no blocking partner operation items.</p>
            </div>
            <small>Clear</small>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function partnerChecklistLaneActionLabel(tone: PartnerChecklistLaneTone) {
  if (tone === 'done') {
    return 'OK';
  }
  if (tone === 'blocked') {
    return 'Fix';
  }
  return 'Check';
}
