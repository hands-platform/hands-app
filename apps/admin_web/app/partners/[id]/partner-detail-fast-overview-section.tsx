import type { ReactNode } from 'react';
import { MessageCircle, Phone } from 'lucide-react';

import { ActionMenu } from '../../../components/action-menu';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminSection } from '../../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import { marketplaceDisplayText } from '../../../lib/admin-copy';

export type PartnerDetailFastActionItem = {
  readonly area: string;
  readonly completion: string;
  readonly href?: string;
  readonly id: string;
  readonly impact: string;
  readonly nextAction: string;
  readonly problem: string;
  readonly status: string;
  readonly tone: string;
};

export type PartnerDetailFastWorkItem = {
  readonly detail: ReactNode;
  readonly href: string;
  readonly label: string;
  readonly status: 'Blocked' | 'Needs review' | 'No data' | 'Ready';
  readonly tone: string;
};

export type PartnerDetailFastActivityItem = {
  readonly at?: ReactNode;
  readonly detail: ReactNode;
  readonly label: string;
};

export type PartnerDetailFastOverviewLink = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly status: string;
  readonly tone: string;
};

type PartnerDetailFastOverviewSectionProps = {
  readonly accountControlsHref: string;
  readonly actionItems: readonly PartnerDetailFastActionItem[];
  readonly activityItems: readonly PartnerDetailFastActivityItem[];
  readonly chatHref: string;
  readonly currentStatus: string;
  readonly fullHref: string;
  readonly partnerName: string;
  readonly phone?: string | null;
  readonly subtitle: string;
  readonly workItems: readonly PartnerDetailFastWorkItem[];
  readonly workspaceLinks: readonly PartnerDetailFastOverviewLink[];
};

export function PartnerDetailFastOverviewSection({
  accountControlsHref,
  actionItems,
  activityItems,
  chatHref,
  currentStatus,
  fullHref,
  partnerName,
  phone,
  subtitle,
  workItems,
  workspaceLinks,
}: PartnerDetailFastOverviewSectionProps) {
  return (
    <AdminPageTemplate
      actions={
        <>
          {phone ? (
            <AdminFormControlLink href={`tel:${phone}`}>
              <Phone aria-hidden="true" size={16} />
              Contact Partner
            </AdminFormControlLink>
          ) : null}
          <AdminFormControlLink href={chatHref}>
            <MessageCircle aria-hidden="true" size={16} />
            Open chat
          </AdminFormControlLink>
          <ActionMenu
            actions={[
              { href: '/partners', kind: 'link', label: 'Back to partners' },
              { href: fullHref, kind: 'link', label: 'View partner work areas' },
              { href: accountControlsHref, kind: 'link', label: 'Account controls' },
            ]}
            label={`More actions for ${partnerName}`}
            variant="dropdown"
          />
        </>
      }
      contentClassName="partners-page partner-detail-page partner-fast-overview-page"
      description={`${marketplaceDisplayText(currentStatus)} / ${marketplaceDisplayText(subtitle)}`}
      title={partnerName}
    >
      <AdminSection
        actions={
          <StatusBadgeFromPillClass pillClass={actionItems.some((item) => item.tone === 'pill-danger') ? 'pill-danger' : actionItems.length ? 'pill-warn' : 'pill-success'}>
            {actionItems.length ? `${actionItems.length} open` : 'No action'}
          </StatusBadgeFromPillClass>
        }
        className="partner-fast-command-section"
        description="Only unresolved issues that have an operator path are shown. The list is capped at five items without an internal vertical scroll."
        id="partner-action-required"
        title="Action required"
      >
        {actionItems.length ? (
          <div className="partner-fast-action-list">
            {actionItems.map((item) => (
              <div className="partner-fast-action-row" key={item.id}>
                <div className="partner-fast-action-title">
                  <span>{item.area}</span>
                  <strong>{item.problem}</strong>
                  <StatusBadgeFromPillClass pillClass={item.tone}>{item.status}</StatusBadgeFromPillClass>
                </div>
                <div>
                  <span>Operational impact</span>
                  <p>{item.impact}</p>
                </div>
                <div>
                  <span>Completion</span>
                  <p>{item.completion}</p>
                </div>
                <div className="partner-fast-action-next">
                  <span>Next action</span>
                  {item.href ? <AdminFormControlLink href={item.href}>{item.nextAction}</AdminFormControlLink> : <strong>{item.nextAction}</strong>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmptyState framed message="No Partner issue needs operator action." title={null} />
        )}
      </AdminSection>

      <AdminSection
        className="partner-fast-command-section"
        description="Approval, service, availability, and wallet gates used for the current booking decision."
        id="partner-can-work-now"
        title="Can work now?"
      >
        <div className="partner-fast-work-grid">
          {workItems.map((item) => (
            <a className="partner-fast-work-card" href={item.href} key={item.label}>
              <span>{item.label}</span>
              <StatusBadgeFromPillClass pillClass={item.tone}>{item.status}</StatusBadgeFromPillClass>
              <p>{item.detail}</p>
            </a>
          ))}
        </div>
      </AdminSection>

      <div className="partner-fast-secondary-grid">
        <AdminSection className="partner-fast-overview-panel" title="Recent activity">
          <div className="partner-fast-activity-list">
            {activityItems.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.detail}</strong>
                {item.at ? <small>{item.at}</small> : null}
              </div>
            ))}
          </div>
        </AdminSection>

        <AdminSection className="partner-fast-overview-panel" title="Partner work areas">
          <div className="partner-fast-workspace-list">
            {workspaceLinks.map((link) => (
              <a href={link.href} key={link.href}>
                <span>
                  <strong>{link.label}</strong>
                  <small>{link.detail}</small>
                </span>
                <StatusBadgeFromPillClass pillClass={link.tone}>{link.status}</StatusBadgeFromPillClass>
              </a>
            ))}
          </div>
        </AdminSection>
      </div>
    </AdminPageTemplate>
  );
}
