import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminStageItem, AdminStageList } from '../../components/admin-stage-item';
import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge } from '../../components/status-badge';

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
    <AdminSection
      actions={
        <StatusBadge tone={blockedCount === 0 ? 'success' : 'danger'}>
          {blockedCount} blocked
        </StatusBadge>
      }
      className="admin-mb-16 partner-checklist-lane-card"
      description="Suggested operator order for fixing factual blockers from profile, KYC, required documents, public media, wallet settlement, location, and push readiness."
      title="Partner checklist lane"
    >
      <AdminStageList>
        {items.map((item) => (
          <AdminStageItem key={item.partnerId}>
            <span>{item.actionStatus}</span>
            <div>
              <strong>
                <AdminTextLink href={item.href}>
                  {item.partnerName}
                </AdminTextLink>
              </strong>
              <p className="muted">{item.actionDetail}</p>
              <p className="muted">{item.operatorAction}</p>
            </div>
            <small>{partnerChecklistLaneActionLabel(item.actionTone)}</small>
          </AdminStageItem>
        ))}
        {items.length === 0 ? (
          <AdminStageItem>
            <span>OK</span>
            <div>
              <AdminEmptyState
                message="The current filtered list has no blocking partner operation items."
                title="No partners need immediate attention"
              />
            </div>
            <small>Clear</small>
          </AdminStageItem>
        ) : null}
      </AdminStageList>
    </AdminSection>
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
