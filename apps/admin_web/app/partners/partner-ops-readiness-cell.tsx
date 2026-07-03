import { ExternalLink } from 'lucide-react';

import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminCard } from '../../components/admin-surface';
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
          className="button button-secondary admin-inline-action admin-mt-8"
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
        <span className={`pill ${partnerListActionPillClass(action.tone)}`}>{action.status}</span>
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
        <span
          className={`pill ${partnerOpsBadgePillClass(badge.tone)}`}
          key={badge.label}
          title={badge.detail}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function PartnerIssuePills({ issues }: { readonly issues: readonly PartnerOpsReadinessIssue[] }) {
  if (!issues.length) {
    return (
      <div className="participant-list admin-mb-8">
        <span className="pill pill-success">No blocking issues</span>
      </div>
    );
  }

  return (
    <div className="participant-list admin-mb-8">
      {issues.slice(0, 5).map((issue) => (
        <span className={`pill ${issue.severity === 'high' ? 'pill-danger' : 'pill-warn'}`} key={issue.label}>
          {issue.label}
        </span>
      ))}
      {issues.length > 5 ? <span className="pill pill-info">+{issues.length - 5} more</span> : null}
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
      <div className="ops-section-header">
        <div>
          <strong>Marketplace participation eligibility</strong>
          <p className="muted">{eligibility.detail}</p>
        </div>
        <span className={`pill ${eligibility.eligible ? 'pill-success' : 'pill-warn'}`}>
          {eligibility.eligible ? 'Candidate ready' : 'Excluded'}
        </span>
      </div>
      <div className="participant-list admin-mt-8">
        <span className="pill pill-info">Radius: {formatDistanceMeters(opsPolicy.backupRadiusMeters)}</span>
        <span className="pill pill-info">First window: {opsPolicy.responseWindowMinutes}m</span>
        <span className="pill pill-info">Location: {opsPolicy.staleLocationMinutes}m fresh</span>
      </div>
      {eligibility.blockers.length ? (
        <div className="participant-list admin-mt-8">
          {eligibility.blockers.map((blocker) => (
            <span
              className={`pill ${blocker.severity === 'hard' ? 'pill-danger' : 'pill-warn'}`}
              key={blocker.label}
            >
              {blocker.label}
            </span>
          ))}
        </div>
      ) : null}
      <p className="muted admin-mt-8">
        {eligibility.operatorAction}
      </p>
    </AdminCard>
  );
}
