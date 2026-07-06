import { ActionMenu } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminDetailGrid, AdminTaskCard } from '../../../components/admin-surface';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormActionRow,
  AdminFormDateTime,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import {
  createProviderReport,
  createProviderSanction,
  updateProviderReport,
} from '../../partner-controls/actions';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerReportControlPayoutHold = {
  readonly expiresAt?: string | null;
  readonly idLabel: string;
  readonly reason: string;
  readonly startsAt?: string | null;
  readonly type: string;
};

export type PartnerReportRow = {
  readonly bookingHref?: string;
  readonly bookingLabel?: string;
  readonly category: string;
  readonly createdAt?: string | null;
  readonly defaultControlType: 'ACCOUNT_BLOCK' | 'WARNING';
  readonly details?: string | null;
  readonly id: string;
  readonly resolutionNote?: string | null;
  readonly severity: string;
  readonly smallLabel: string;
  readonly source: string;
  readonly status: string;
  readonly summary: string;
};

export type PartnerAccountControlRow = {
  readonly expiresAt?: string | null;
  readonly id: string;
  readonly liftControlHref?: string;
  readonly reason: string;
  readonly reportLine?: string | null;
  readonly smallLabel: string;
  readonly startsAt?: string | null;
  readonly status: string;
  readonly type: string;
};

type PartnerDetailReportsControlsSectionProps = {
  readonly accountControls: readonly PartnerAccountControlRow[];
  readonly payoutHold?: PartnerReportControlPayoutHold | null;
  readonly providerId: string;
  readonly reports: readonly PartnerReportRow[];
  readonly reportsDeskHref: string;
};

export function PartnerDetailReportsControlsSection({
  accountControls,
  payoutHold,
  providerId,
  reports,
  reportsDeskHref,
}: PartnerDetailReportsControlsSectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="Keep customer complaints, staff findings, payout holds, and account blocks visible on the partner profile."
      footer={
        <AdminTextLink href={reportsDeskHref}>
          Open reports desk
        </AdminTextLink>
      }
      id="partner-reports-controls"
      resultLabel={`${reports.length} report(s)`}
      resultTone={payoutHold ? 'danger' : 'info'}
      title="Reports and account controls"
    >
      <AdminFormGrid action={createProviderReport} className="admin-mb-16">
        <input type="hidden" name="providerProfileId" value={providerId} />
        <AdminFormInput
          label="Category"
          labelVisibility="visible"
          name="category"
          placeholder="safety, payout, behavior, identity"
          required
        />
        <AdminFormSelect
          defaultValue="MEDIUM"
          label="Severity"
          labelVisibility="visible"
          name="severity"
          options={reportSeverityOptions}
        />
        <AdminFormSelect
          defaultValue="ADMIN"
          label="Source"
          labelVisibility="visible"
          name="source"
          options={reportSourceOptions}
        />
        <AdminFormInput
          className="full-span"
          label="Summary"
          labelVisibility="visible"
          name="summary"
          placeholder="Short report summary"
          required
        />
        <AdminFormTextarea
          className="full-span"
          label="Details"
          labelVisibility="visible"
          name="details"
          placeholder="Evidence, timeline, follow-up, or staff note"
        />
        <AdminFormActionRow className="actions full-span">
          <AdminFormControlButton type="submit">Create report</AdminFormControlButton>
        </AdminFormActionRow>
      </AdminFormGrid>
      <AdminTaskCard className="ops-task-pending admin-mb-16">
        <AdminSectionHeader
          actions={(
            <StatusBadge tone={payoutHold ? 'danger' : 'success'}>
              {payoutHold ? 'Payout locked' : 'No payout hold'}
            </StatusBadge>
          )}
          description="Use this for immediate operating controls when a report is not yet required."
          title="Manual account control"
        />
        <div className="admin-mb-12">
          <AdminTableScroll>
            <AdminDataTable
              className={partnerDetailReviewTableClassName}
              emptyMessage={
                <ReportsControlsEmptyState message="No active payout hold is currently applied." />
              }
              headers={payoutHoldTableHeaders}
              rowCount={payoutHold ? 1 : 0}
            >
              {payoutHold ? (
                <tr>
                  <td>
                    <StatusBadge tone="danger">ACTIVE</StatusBadge>
                  </td>
                  <td>
                    <strong>{payoutHold.type}</strong>
                    <p className="muted">{payoutHold.reason}</p>
                  </td>
                  <td>
                    <ControlTimeline
                      expiresAt={payoutHold.expiresAt}
                      startsAt={payoutHold.startsAt}
                    />
                  </td>
                  <td>
                    <small>{payoutHold.idLabel}</small>
                  </td>
                </tr>
              ) : null}
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={payoutHold ? 1 : 0} />
        </div>
        <AdminFormGrid action={createProviderSanction}>
          <input type="hidden" name="providerProfileId" value={providerId} />
          <AdminFormSelect
            defaultValue="PAYOUT_HOLD"
            label="Control type"
            labelVisibility="visible"
            name="type"
            options={accountControlTypeOptions}
          />
          <AdminFormDateTime
            label="Expires at"
            labelVisibility="visible"
            name="expiresAt"
          />
          <AdminFormInput
            className="full-span"
            label="Reason"
            labelVisibility="visible"
            maxLength={500}
            minLength={12}
            name="reason"
            placeholder="Clear operator reason, visible in audit and payout controls"
            required
          />
          <AdminFormActionRow className="actions full-span">
            <AdminFormControlButton type="submit">Apply account control</AdminFormControlButton>
            <AdminFormControlLink href="/payouts">Open payouts</AdminFormControlLink>
          </AdminFormActionRow>
        </AdminFormGrid>
      </AdminTaskCard>
      <AdminDetailGrid>
        <div>
          <h3>Recent reports</h3>
          <AdminTableScroll>
            <AdminDataTable
              className={partnerDetailReviewTableClassName}
              emptyMessage={<ReportsControlsEmptyState message="No Partner reports recorded yet." />}
              headers={reportTableHeaders}
              rowCount={reports.length}
            >
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <strong>{report.summary}</strong>
                    <p className="muted">
                      {report.category} / {report.source} /{' '}
                      <DateTimeText fallback="Missing" value={report.createdAt} />
                    </p>
                    {report.details ? <p className="muted">{report.details}</p> : null}
                    {report.resolutionNote ? (
                      <p className="muted">Resolution: {report.resolutionNote}</p>
                    ) : null}
                  </td>
                  <td>
                    <StatusBadgeFromPillClass pillClass={reportSeverityPill(report.severity)}>
                      {report.severity}
                    </StatusBadgeFromPillClass>
                  </td>
                  <td>
                    <StatusBadgeFromPillClass pillClass={reportStatusPill(report.status)}>
                      {report.status}
                    </StatusBadgeFromPillClass>
                  </td>
                  <td>
                    {report.bookingHref && report.bookingLabel ? (
                      <AdminTextLink href={report.bookingHref}>
                        Booking {report.bookingLabel}
                      </AdminTextLink>
                    ) : (
                      <AdminInlineFallback>No booking linked</AdminInlineFallback>
                    )}
                    <p className="muted">{report.smallLabel}</p>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={reports.length} />
        </div>
        <div>
          <h3>Recent account controls</h3>
          <AdminTableScroll>
            <AdminDataTable
              className={partnerDetailReviewTableClassName}
              emptyMessage={
                <ReportsControlsEmptyState message="No active or historical account control recorded yet." />
              }
              headers={accountControlTableHeaders}
              rowCount={accountControls.length}
            >
              {accountControls.map((control) => (
                <tr key={control.id}>
                  <td>
                    <strong>{control.type}</strong>
                    <p className="muted">{control.reason}</p>
                    {control.reportLine ? <p className="muted">{control.reportLine}</p> : null}
                  </td>
                  <td>
                    <StatusBadgeFromPillClass pillClass={controlStatusPill(control.status)}>
                      {control.status}
                    </StatusBadgeFromPillClass>
                  </td>
                  <td>
                    <ControlTimeline expiresAt={control.expiresAt} startsAt={control.startsAt} />
                    <p className="muted">{control.smallLabel}</p>
                  </td>
                  <td>
                    {control.liftControlHref ? (
                      <ActionMenu
                        actions={[
                          {
                            description: 'Review before lifting this Partner account control.',
                            href: control.liftControlHref,
                            kind: 'link',
                            label: 'Lift control',
                            tone: 'warning',
                          },
                        ]}
                        label={`Control actions for ${control.smallLabel}`}
                        variant="dropdown"
                      />
                    ) : (
                      <AdminInlineFallback>No action</AdminInlineFallback>
                    )}
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={accountControls.length} />
        </div>
      </AdminDetailGrid>
      <PartnerReportCommandPanel providerId={providerId} reports={reports} />
    </PartnerDetailVuexyTablePanel>
  );
}

function ControlTimeline({
  expiresAt,
  startsAt,
}: {
  readonly expiresAt?: string | null;
  readonly startsAt?: string | null;
}) {
  return (
    <span className="muted">
      Started <DateTimeText fallback="Missing" value={startsAt} /> / expires{' '}
      <DateTimeText fallback="Missing" value={expiresAt} />
    </span>
  );
}

function PartnerReportCommandPanel({
  providerId,
  reports,
}: {
  readonly providerId: string;
  readonly reports: readonly PartnerReportRow[];
}) {
  const firstReport = reports[0];

  return (
    <AdminTaskCard className="partner-report-command-grid admin-mt-16">
      <div>
        <h3>Report command panel</h3>
        <p className="muted">
          Update report status or apply a linked control without crowding the report table.
        </p>
      </div>
      {firstReport ? (
        <>
          <AdminFormGrid action={updateProviderReport} className="compact-form partner-report-command-form">
            <input type="hidden" name="providerProfileId" value={providerId} />
            <AdminFormSelect
              defaultValue={firstReport.id}
              label="Report"
              labelVisibility="visible"
              name="reportId"
              options={reportSelectOptions(reports)}
            />
            <AdminFormSelect
              defaultValue={firstReport.status}
              label="Report status"
              labelVisibility="visible"
              name="status"
              options={reportStatusOptions}
            />
            <AdminFormSelect
              defaultValue={firstReport.severity}
              label="Report severity"
              labelVisibility="visible"
              name="severity"
              options={reportSeverityOptions}
            />
            <AdminFormInput
              className="full-span"
              label="Resolution note"
              labelVisibility="visible"
              name="resolutionNote"
              placeholder="Resolution note"
            />
            <AdminFormActionRow className="actions full-span">
              <AdminFormControlButton type="submit">Update report</AdminFormControlButton>
            </AdminFormActionRow>
          </AdminFormGrid>
          <AdminFormGrid action={createProviderSanction} className="compact-form partner-report-command-form">
            <input type="hidden" name="providerProfileId" value={providerId} />
            <AdminFormSelect
              defaultValue={firstReport.id}
              label="Linked report"
              labelVisibility="visible"
              name="reportId"
              options={reportSelectOptions(reports)}
            />
            <AdminFormSelect
              defaultValue={firstReport.defaultControlType}
              label="Control type"
              labelVisibility="visible"
              name="type"
              options={accountControlTypeOptions}
            />
            <AdminFormInput
              className="full-span"
              label="Control reason"
              labelVisibility="visible"
              maxLength={500}
              minLength={12}
              name="reason"
              placeholder="Control reason"
              required
            />
            <AdminFormActionRow className="actions full-span">
              <AdminFormControlButton type="submit">Apply linked control</AdminFormControlButton>
            </AdminFormActionRow>
          </AdminFormGrid>
        </>
      ) : (
        <ReportsControlsEmptyState message="No report commands are available until a report is recorded." />
      )}
    </AdminTaskCard>
  );
}

function reportSelectOptions(reports: readonly PartnerReportRow[]) {
  return reports.map((report) => ({
    label: `${report.smallLabel} / ${report.summary}`,
    value: report.id,
  }));
}

const reportTableHeaders = ['Report', 'Severity', 'Status', 'Linked record'] as const;
const accountControlTableHeaders = ['Control', 'Status', 'Timeline', 'Actions'] as const;
const payoutHoldTableHeaders = ['State', 'Control', 'Timeline', 'ID'] as const;

const reportSeverityOptions = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Major', value: 'HIGH' },
  { label: 'Urgent', value: 'CRITICAL' },
] as const;

const reportSourceOptions = [
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Customer', value: 'CUSTOMER' },
  { label: 'Partner', value: 'PROVIDER' },
  { label: 'System', value: 'SYSTEM' },
] as const;

const accountControlTypeOptions = [
  { label: 'Warning', value: 'WARNING' },
  { label: 'Payout hold', value: 'PAYOUT_HOLD' },
  { label: 'Account block', value: 'ACCOUNT_BLOCK' },
  { label: 'Profile review hold', value: 'TRUST_BADGE_REMOVAL' },
] as const;

const reportStatusOptions = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Investigating', value: 'INVESTIGATING' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Dismissed', value: 'DISMISSED' },
] as const;

function reportSeverityPill(severity: string) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'pill-danger';
  if (severity === 'MEDIUM') return 'pill-warn';
  return 'pill-neutral';
}

function reportStatusPill(status: string) {
  if (status === 'RESOLVED' || status === 'DISMISSED') return 'pill-success';
  if (status === 'INVESTIGATING') return 'pill-warn';
  return 'pill-info';
}

function controlStatusPill(status: string) {
  if (status === 'ACTIVE') return 'pill-danger';
  if (status === 'LIFTED' || status === 'EXPIRED') return 'pill-success';
  return 'pill-neutral';
}

function ReportsControlsEmptyState({ message }: { readonly message: string }) {
  return <AdminEmptyState framed message={message} title={null} />;
}
