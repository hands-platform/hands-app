import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';
import {
  openPartnerOperationalChecks,
  partnerOperationalDomainLabel,
  type PartnerOperationalCheck,
} from './partner-detail-operational-status-model';
import { partnerOpsPillClass, partnerOpsStatusBadgeTone } from './partner-detail-tone';

type PartnerOperationalStatusSectionProps = {
  readonly checks: readonly PartnerOperationalCheck[];
};

const operationalHeaders = ['Area', 'Current status', 'Reason', 'Next action'];

export function PartnerDetailNeedsActionSection({ checks }: PartnerOperationalStatusSectionProps) {
  const openChecks = openPartnerOperationalChecks(checks);
  const resultTone = openChecks.some((check) => check.tone === 'blocked')
    ? 'blocked'
    : openChecks.length
      ? 'pending'
      : 'done';

  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="Only unresolved Partner issues are listed here. Every count and status on this page uses the same operational checks."
      id="partner-needs-action"
      resultLabel={openChecks.length ? `${openChecks.length} open` : 'Clear'}
      resultTone={partnerOpsStatusBadgeTone(resultTone)}
      title="Needs action"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<AdminEmptyState framed message="No Partner issue needs operator action." />}
          headers={operationalHeaders}
          rowCount={openChecks.length}
        >
          {openChecks.map((check) => (
            <PartnerOperationalCheckRow check={check} key={check.id} showDomain />
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={openChecks.length} />
    </PartnerDetailVuexyTablePanel>
  );
}

export function PartnerDetailWorkReadinessSection({ checks }: PartnerOperationalStatusSectionProps) {
  const workChecks = checks.filter((check) => check.domain === 'WORK');
  const openChecks = openPartnerOperationalChecks(workChecks);
  const resultTone = openChecks.some((check) => check.tone === 'blocked')
    ? 'blocked'
    : openChecks.length
      ? 'pending'
      : 'done';

  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="One operational view of services, location, app reachability, and current work availability."
      id="partner-work-readiness"
      resultLabel={openChecks.length ? `${openChecks.length} issue(s)` : 'Ready'}
      resultTone={partnerOpsStatusBadgeTone(resultTone)}
      title="Readiness checks"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<AdminEmptyState framed message="No Partner readiness check is available." />}
          headers={operationalHeaders}
          rowCount={workChecks.length}
        >
          {workChecks.map((check) => (
            <PartnerOperationalCheckRow check={check} key={check.id} />
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={workChecks.length} />
    </PartnerDetailVuexyTablePanel>
  );
}

function PartnerOperationalCheckRow({
  check,
  showDomain = false,
}: {
  readonly check: PartnerOperationalCheck;
  readonly showDomain?: boolean;
}) {
  return (
    <tr>
      <td>
        <strong>{showDomain ? partnerOperationalDomainLabel(check.domain) : check.title}</strong>
        {showDomain ? <p className="muted">{check.title}</p> : null}
      </td>
      <td>
        <StatusBadgeFromPillClass pillClass={partnerOpsPillClass(check.tone)}>
          {check.status}
        </StatusBadgeFromPillClass>
      </td>
      <td>
        <p className="muted">{check.detail}</p>
      </td>
      <td>
        {check.href ? (
          <AdminTextLink href={check.href}>{check.actionLabel}</AdminTextLink>
        ) : (
          <span className="muted">{check.actionLabel}</span>
        )}
      </td>
    </tr>
  );
}
