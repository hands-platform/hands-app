import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminCard } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import { type PartnerDecisionQueue, withPartnerDecisionQueue } from '../partner-review-mode';
import { buildPartnerDetailWorkspaceHref } from './partner-detail-workspace-model';

type PartnerDetailFullRecordIndexSectionProps = {
  readonly approvalOpenCount: number;
  readonly bookingRecordCount: number;
  readonly canViewDiagnostics: boolean;
  readonly decisionQueue?: PartnerDecisionQueue | null;
  readonly financeOpenCount: number;
  readonly operationalPolicyAvailable?: boolean;
  readonly partnerId: string;
  readonly workOpenCount: number;
};

export function PartnerDetailFullRecordIndexSection({
  approvalOpenCount,
  bookingRecordCount,
  canViewDiagnostics,
  decisionQueue = null,
  financeOpenCount,
  operationalPolicyAvailable = true,
  partnerId,
  workOpenCount,
}: PartnerDetailFullRecordIndexSectionProps) {
  const openCount = approvalOpenCount + (operationalPolicyAvailable ? workOpenCount : 0) + financeOpenCount;

  return (
    <AdminCard className="partner-workspace-index" id="partner-full-record-index">
      <AdminSectionHeader
        actions={
          <StatusBadge tone={openCount || !operationalPolicyAvailable ? 'warning' : 'success'}>
            {openCount ? `${openCount} open` : operationalPolicyAvailable ? 'No action' : 'No known action'}
          </StatusBadge>
        }
        description="Choose the existing work area for this Partner. This compatibility URL no longer loads every record and form onto one page."
        title="Partner work areas"
      />
      <AdminTraceSummary
        ariaLabel="Partner work areas"
        className="admin-mt-12 partner-workspace-index-grid"
        inferScope={false}
        metrics={[
          {
            detail: 'Profile decision, KYC, submitted evidence, and public profile content.',
            href: withPartnerDecisionQueue(
              buildPartnerDetailWorkspaceHref(partnerId, 'dossier', 'approval'),
              decisionQueue,
            ),
            label: 'Approval & profile',
            value: approvalOpenCount ? `${approvalOpenCount} open` : 'Ready',
          },
          {
            detail: operationalPolicyAvailable
              ? 'Service, location, app reachability, schedule, and booking readiness.'
              : 'Operational policy data is unavailable. Pause matching and readiness decisions.',
            href: withPartnerDecisionQueue(
              buildPartnerDetailWorkspaceHref(partnerId, 'access', 'readiness'),
              decisionQueue,
            ),
            label: 'Work readiness',
            value: operationalPolicyAvailable
              ? workOpenCount
                ? `${workOpenCount} open`
                : 'Ready'
              : 'Unavailable',
          },
          {
            detail: 'Booking journey, current participation, and retained evidence workspaces.',
            href: withPartnerDecisionQueue(
              buildPartnerDetailWorkspaceHref(partnerId, 'bookings', 'journey'),
              decisionQueue,
            ),
            label: 'Booking evidence',
            value: `${bookingRecordCount} records`,
          },
          {
            detail: 'Partner wallet, receivable, withdrawal, and payout records.',
            href: withPartnerDecisionQueue(
              buildPartnerDetailWorkspaceHref(partnerId, 'dossier', 'finance'),
              decisionQueue,
            ),
            label: 'Money',
            value: financeOpenCount ? `${financeOpenCount} open` : 'No open issue',
          },
          {
            detail: 'Reviews, operator notes, reports, account controls, and retained activity.',
            href: withPartnerDecisionQueue(
              buildPartnerDetailWorkspaceHref(partnerId, 'control', 'records'),
              decisionQueue,
            ),
            label: 'History & controls',
            value: 'Open workspace',
          },
          ...(canViewDiagnostics
            ? [
                {
                  detail: 'Developer-only device, session, and technical records.',
                  href: withPartnerDecisionQueue(
                    buildPartnerDetailWorkspaceHref(partnerId, 'access', 'diagnostics'),
                    decisionQueue,
                  ),
                  label: 'Diagnostics',
                  value: 'Developer only',
                },
              ]
            : []),
        ]}
      />
    </AdminCard>
  );
}
