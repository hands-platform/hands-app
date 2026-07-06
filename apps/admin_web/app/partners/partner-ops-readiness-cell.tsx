import { ExternalLink } from 'lucide-react';

import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminCard } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import type { AdminProvider } from '../../lib/admin-api';
import type { ProviderListAction } from './partner-list-actions';
import { partnerListActionPillClass } from './partner-list-actions';
import {
  formatDistanceMeters,
  type ProviderOpsPolicy,
} from './partner-list-ops';
import type { PartnerMarketplaceEligibility } from './partner-marketplace-eligibility';
import type { PartnerOpsBadge } from './partner-ops-badges';
import { partnerOpsBadgePillClass } from './partner-ops-badges';

export type PartnerOpsReadinessIssue = {
  readonly label: string;
  readonly severity: 'high' | 'medium';
};

type PartnerOpsReadinessCellProps = {
  readonly actionHint: string;
  readonly eligibility: PartnerMarketplaceEligibility;
  readonly hasOpenControl: boolean;
  readonly issues: readonly PartnerOpsReadinessIssue[];
  readonly nextAction: ProviderListAction;
  readonly opsBadges: readonly PartnerOpsBadge[];
  readonly opsPolicy: ProviderOpsPolicy;
  readonly provider: AdminProvider;
};

export function PartnerOpsReadinessCell({
  actionHint,
  eligibility,
  hasOpenControl,
  issues,
  nextAction,
  opsBadges,
  opsPolicy,
  provider,
}: PartnerOpsReadinessCellProps) {
  return (
    <>
      <PartnerNextActionSummary action={nextAction} />
      <PartnerOpsBadgeList badges={opsBadges} />
      <PartnerIssuePills issues={issues} />
      <p className="muted">{actionHint}</p>
      <PartnerBackupEligibilityCard eligibility={eligibility} opsPolicy={opsPolicy} />
      {hasOpenControl ? (
        <AdminFormControlLink
          className="button-secondary admin-inline-action admin-mt-8"
          href={`/partners?review=reports&q=${encodeURIComponent(provider.id)}`}
        >
          <ExternalLink aria-hidden="true" size={14} />
          Open reports
        </AdminFormControlLink>
      ) : null}
    </>
  );
}

function PartnerNextActionSummary({ action }: { readonly action: ProviderListAction }) {
  return (
    <div className="admin-mb-10">
      <div className="participant-list admin-mb-6">
        <StatusBadgeFromPillClass pillClass={partnerListActionPillClass(action.tone)}>
          {action.status}
        </StatusBadgeFromPillClass>
      </div>
      <p className="muted admin-mb-4">
        {action.detail}
      </p>
      <p className="muted admin-mb-8">
        {action.operatorAction}
      </p>
    </div>
  );
}

function PartnerOpsBadgeList({ badges }: { readonly badges: readonly PartnerOpsBadge[] }) {
  return (
    <div className="participant-list admin-mb-8">
      {badges.map((badge) => (
        <StatusBadgeFromPillClass
          key={badge.label}
          pillClass={partnerOpsBadgePillClass(badge.tone)}
          title={badge.detail}
        >
          {badge.label}
        </StatusBadgeFromPillClass>
      ))}
    </div>
  );
}

function PartnerIssuePills({ issues }: { readonly issues: readonly PartnerOpsReadinessIssue[] }) {
  if (!issues.length) {
    return (
      <div className="participant-list admin-mb-8">
        <StatusBadge tone="success">No blocking issues</StatusBadge>
      </div>
    );
  }

  return (
    <div className="participant-list admin-mb-8">
      {issues.slice(0, 5).map((issue) => (
        <StatusBadge key={issue.label} tone={issue.severity === 'high' ? 'danger' : 'warning'}>
          {issue.label}
        </StatusBadge>
      ))}
      {issues.length > 5 ? <StatusBadge tone="info">+{issues.length - 5} more</StatusBadge> : null}
    </div>
  );
}

function PartnerBackupEligibilityCard({
  eligibility,
  opsPolicy,
}: {
  readonly eligibility: PartnerMarketplaceEligibility;
  readonly opsPolicy: ProviderOpsPolicy;
}) {
  return (
    <AdminCard className="admin-mt-10 admin-p-12">
      <AdminSectionHeader
        actions={(
          <StatusBadge tone={eligibility.eligible ? 'success' : 'warning'}>
            {eligibility.eligible ? 'Candidate ready' : 'Excluded'}
          </StatusBadge>
        )}
        description={eligibility.detail}
        title="Marketplace participation eligibility"
      />
      <div className="participant-list admin-mt-8">
        <StatusBadge tone="info">Radius: {formatDistanceMeters(opsPolicy.backupRadiusMeters)}</StatusBadge>
        <StatusBadge tone="info">First window: {opsPolicy.responseWindowMinutes}m</StatusBadge>
        <StatusBadge tone="info">Location: {opsPolicy.staleLocationMinutes}m fresh</StatusBadge>
      </div>
      {eligibility.blockers.length ? (
        <div className="participant-list admin-mt-8">
          {eligibility.blockers.map((blocker) => (
            <StatusBadge key={blocker.label} tone={blocker.severity === 'hard' ? 'danger' : 'warning'}>
              {blocker.label}
            </StatusBadge>
          ))}
        </div>
      ) : null}
      <p className="muted admin-mt-8">
        {eligibility.operatorAction}
      </p>
    </AdminCard>
  );
}
