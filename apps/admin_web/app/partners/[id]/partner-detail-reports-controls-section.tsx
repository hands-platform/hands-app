import Link from 'next/link';

import { ActionMenu } from '../../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDateTime,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
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
      <form className="form-grid admin-mb-16" action={createProviderReport}>
        <input type="hidden" name="providerProfileId" value={providerId} />
        <AdminFormInput
          className="field"
          label="Category"
          labelVisibility="visible"
          name="category"
          placeholder="safety, payout, behavior, identity"
          required
        />
        <AdminFormSelect
          className="field"
          defaultValue="MEDIUM"
          label="Severity"
          labelVisibility="visible"
          name="severity"
          options={reportSeverityOptions}
        />
        <AdminFormSelect
          className="field"
          defaultValue="ADMIN"
          label="Source"
          labelVisibility="visible"
          name="source"
          options={reportSourceOptions}
        />
        <AdminFormInput
          className="field full-span"
          label="Summary"
          labelVisibility="visible"
          name="summary"
          placeholder="Short report summary"
          required
        />
        <AdminFormTextarea
          className="field full-span"
          label="Details"
          labelVisibility="visible"
          name="details"
          placeholder="Evidence, timeline, follow-up, or staff note"
        />
        <div className="actions full-span">
          <AdminFormControlButton type="submit">Create report</AdminFormControlButton>
        </div>
      </form>
      <div className="ops-task-card ops-task-pending admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h3>Manual account control</h3>
            <p className="muted">
              Use this for immediate operating controls when a report is not yet required.
            </p>
          </div>
          <span className={`pill ${payoutHold ? 'pill-danger' : 'pill-success'}`}>
            {payoutHold ? 'Payout locked' : 'No payout hold'}
          </span>
        </div>
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
                    <span className="pill pill-danger">ACTIVE</span>
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
        <form className="form-grid" action={createProviderSanction}>
          <input type="hidden" name="providerProfileId" value={providerId} />
          <AdminFormSelect
            className="field"
            defaultValue="PAYOUT_HOLD"
            label="Control type"
            labelVisibility="visible"
            name="type"
            options={accountControlTypeOptions}
          />
          <AdminFormDateTime
            className="field"
            label="Expires at"
            labelVisibility="visible"
            name="expiresAt"
          />
          <AdminFormInput
            className="field full-span"
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
        </form>
      </div>
      <div className="detail-grid">
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
                    <span className={`pill ${reportSeverityPill(report.severity)}`}>{report.severity}</span>
                  </td>
                  <td>
                    <span className={`pill ${reportStatusPill(report.status)}`}>{report.status}</span>
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
                    <span className={`pill ${controlStatusPill(control.status)}`}>{control.status}</span>
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
      </div>
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
    <div className="partner-report-command-grid admin-mt-16">
      <div>
        <h3>Report command panel</h3>
        <p className="muted">
          Update report status or apply a linked control without crowding the report table.
        </p>
      </div>
      {firstReport ? (
        <>
          <form className="form-grid compact-form partner-report-command-form" action={updateProviderReport}>
            <input type="hidden" name="providerProfileId" value={providerId} />
            <AdminFormSelect
              className="field"
              defaultValue={firstReport.id}
              label="Report"
              labelVisibility="visible"
              name="reportId"
              options={reportSelectOptions(reports)}
            />
            <AdminFormSelect
              className="field"
              defaultValue={firstReport.status}
              label="Report status"
              labelVisibility="visible"
              name="status"
              options={reportStatusOptions}
            />
            <AdminFormSelect
              className="field"
              defaultValue={firstReport.severity}
              label="Report severity"
              labelVisibility="visible"
              name="severity"
              options={reportSeverityOptions}
            />
            <AdminFormInput
              className="field full-span"
              label="Resolution note"
              labelVisibility="visible"
              name="resolutionNote"
              placeholder="Resolution note"
            />
            <div className="actions full-span">
              <AdminFormControlButton type="submit">Update report</AdminFormControlButton>
            </div>
          </form>
          <form
            className="form-grid compact-form partner-report-command-form"
            action={createProviderSanction}
          >
            <input type="hidden" name="providerProfileId" value={providerId} />
            <AdminFormSelect
              className="field"
              defaultValue={firstReport.id}
              label="Linked report"
              labelVisibility="visible"
              name="reportId"
              options={reportSelectOptions(reports)}
            />
            <AdminFormSelect
              className="field"
              defaultValue={firstReport.defaultControlType}
              label="Control type"
              labelVisibility="visible"
              name="type"
              options={accountControlTypeOptions}
            />
            <AdminFormInput
              className="field full-span"
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
          </form>
        </>
      ) : (
        <p className="muted">No report commands are available until a report is recorded.</p>
      )}
    </div>
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
  return (
    <>
      <strong>No records found</strong>
      <p className="muted">{message}</p>
    </>
  );
}
