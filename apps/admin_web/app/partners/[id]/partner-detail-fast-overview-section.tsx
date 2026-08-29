import type { ReactNode } from 'react';
import { MessageCircle, Phone } from 'lucide-react';

import { ActionMenu } from '../../../components/action-menu';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminErrorState, AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
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
  readonly actionIssueCount: number;
  readonly actionItems: readonly PartnerDetailFastActionItem[];
  readonly activityItems: readonly PartnerDetailFastActivityItem[];
  readonly chatHref: string;
  readonly currentStatus: string;
  readonly fullHref: string;
  readonly operationalPolicyAvailable?: boolean;
  readonly operationalPolicyFailureStatus?: number | null;
  readonly partnerName: string;
  readonly phone?: string | null;
  readonly policyRetryHref?: string;
  readonly subtitle: string;
  readonly workItems: readonly PartnerDetailFastWorkItem[];
  readonly workspaceLinks: readonly PartnerDetailFastOverviewLink[];
};

export function PartnerDetailFastOverviewSection({
  accountControlsHref,
  actionIssueCount,
  actionItems,
  activityItems,
  chatHref,
  currentStatus,
  fullHref,
  operationalPolicyAvailable = true,
  operationalPolicyFailureStatus,
  partnerName,
  phone,
  policyRetryHref,
  subtitle,
  workItems,
  workspaceLinks,
}: PartnerDetailFastOverviewSectionProps) {
  const hiddenActionIssueCount = Math.max(0, actionIssueCount - actionItems.length);

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
          <StatusBadgeFromPillClass
            pillClass={
              actionItems.some((item) => item.tone === 'pill-danger')
                ? 'pill-danger'
                : actionItems.length
                  ? 'pill-warn'
                  : 'pill-success'
            }
          >
            {actionIssueCount ? `${actionIssueCount} open` : 'No action'}
          </StatusBadgeFromPillClass>
        }
        className="partner-fast-command-section"
        description="Only unresolved root issues that have an operator path are counted. The top five are shown without an internal vertical scroll."
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
                  {item.href ? (
                    <AdminFormControlLink href={item.href}>{item.nextAction}</AdminFormControlLink>
                  ) : (
                    <strong>{item.nextAction}</strong>
                  )}
                </div>
              </div>
            ))}
            {hiddenActionIssueCount ? (
              <div className="button-row admin-mt-12">
                <span>
                  {`+${hiddenActionIssueCount} more ${hiddenActionIssueCount === 1 ? 'issue' : 'issues'}`}
                </span>
                <AdminFormControlLink href={fullHref}>Review all issues</AdminFormControlLink>
              </div>
            ) : null}
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
        {operationalPolicyAvailable ? (
          <div className="partner-fast-work-grid">
            {workItems.map((item) => (
              <a className="partner-fast-work-card" href={item.href} key={item.label}>
                <span>{item.label}</span>
                <StatusBadgeFromPillClass pillClass={item.tone}>{item.status}</StatusBadgeFromPillClass>
                <p>{item.detail}</p>
              </a>
            ))}
          </div>
        ) : (
          <AdminErrorState
            action={
              operationalPolicyFailureStatus === 401 ||
              operationalPolicyFailureStatus === 403 ||
              !policyRetryHref ? null : (
                <AdminTextLink href={policyRetryHref}>Retry policy data</AdminTextLink>
              )
            }
            message={
              operationalPolicyFailureStatus === 401 || operationalPolicyFailureStatus === 403
                ? 'You do not have permission to load the operational policy used for matching and readiness decisions. Pause matching and readiness decisions.'
                : 'Operational policy data could not be loaded. Pause matching and readiness decisions, then retry.'
            }
            title={
              operationalPolicyFailureStatus === 401 || operationalPolicyFailureStatus === 403
                ? 'Operational policy restricted'
                : 'Operational policy unavailable'
            }
          />
        )}
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
