import Link from 'next/link';

import { ActionMenu } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminDetailGrid, AdminTaskCard } from '../../../components/admin-surface';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDateTime,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import {
  createProviderReport,
  createProviderSanction,
  updateProviderReport,
} from '../../partner-controls/actions';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerReportControlPayoutHold = {
  readonly idLabel: string;
  readonly reason: string;
  readonly timeline: string;
  readonly type: string;
};

export type PartnerReportRow = {
  readonly bookingHref?: string;
  readonly bookingLabel?: string;
  readonly category: string;
  readonly createdLabel: string;
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
  readonly id: string;
  readonly liftControlHref?: string;
  readonly reason: string;
  readonly reportLine?: string | null;
  readonly smallLabel: string;
  readonly status: string;
  readonly timeline: string;
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
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Keep customer complaints, staff findings, payout holds, and account blocks visible on the partner profile."
      footer={
        <Link className="text-link" href={reportsDeskHref}>
          Open reports desk
        </Link>
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
        <div className="actions full-span">
          <AdminFormControlButton type="submit">Create report</AdminFormControlButton>
        </div>
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
                    <span className="muted">{payoutHold.timeline}</span>
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
          <div className="actions full-span">
            <AdminFormControlButton type="submit">Apply account control</AdminFormControlButton>
            <AdminFormControlLink href="/payouts">Open payouts</AdminFormControlLink>
          </div>
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
                      {report.category} / {report.source} / {report.createdLabel}
                    </p>
                    {report.details ? <p className="muted">{report.details}</p> : null}
                    {report.resolutionNote ? (
                      <p className="muted">Resolution: {report.resolutionNote}</p>
                    ) : null}
                  </td>
                  <td>
                    <StatusBadge tone={statusBadgeToneFromPillClass(reportSeverityPill(report.severity))}>
                      {report.severity}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge tone={statusBadgeToneFromPillClass(reportStatusPill(report.status))}>
                      {report.status}
                    </StatusBadge>
                  </td>
                  <td>
                    {report.bookingHref && report.bookingLabel ? (
                      <Link className="text-link" href={report.bookingHref}>
                        Booking {report.bookingLabel}
                      </Link>
                    ) : (
                      <span className="muted">No booking linked</span>
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
                    <StatusBadge tone={statusBadgeToneFromPillClass(controlStatusPill(control.status))}>
                      {control.status}
                    </StatusBadge>
                  </td>
                  <td>
                    <span className="muted">{control.timeline}</span>
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
                      <span className="muted">No action</span>
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
    </AdminFilterPanel>
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
            <div className="actions full-span">
              <AdminFormControlButton type="submit">Update report</AdminFormControlButton>
            </div>
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
            <div className="actions full-span">
              <AdminFormControlButton type="submit">Apply linked control</AdminFormControlButton>
            </div>
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
