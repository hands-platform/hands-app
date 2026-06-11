import Link from 'next/link';

import { ActionMenu } from '../../../components/action-menu';
import {
  createProviderReport,
  createProviderSanction,
  updateProviderReport,
} from '../../partner-controls/actions';

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
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Reports and account controls</h2>
          <p className="muted">
            Keep customer complaints, staff findings, payout holds, and account blocks visible on the
            partner profile.
          </p>
        </div>
        <Link className="text-link" href={reportsDeskHref}>
          Open reports desk
        </Link>
      </div>
      <form className="form-grid admin-mb-16" action={createProviderReport}>
        <input type="hidden" name="providerProfileId" value={providerId} />
        <label>
          Category
          <input name="category" placeholder="safety, payout, behavior, identity" required />
        </label>
        <label>
          Severity
          <select name="severity" defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">Major</option>
            <option value="CRITICAL">Urgent</option>
          </select>
        </label>
        <label>
          Source
          <select name="source" defaultValue="ADMIN">
            <option value="ADMIN">Admin</option>
            <option value="CUSTOMER">Customer</option>
            <option value="PROVIDER">Partner</option>
            <option value="SYSTEM">System</option>
          </select>
        </label>
        <label className="full-span">
          Summary
          <input name="summary" placeholder="Short report summary" required />
        </label>
        <label className="full-span">
          Details
          <textarea name="details" placeholder="Evidence, timeline, follow-up, or staff note" />
        </label>
        <div className="actions full-span">
          <button type="submit">Create report</button>
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
        {payoutHold ? (
          <div className="setup-stage-item admin-mb-12">
            <span>ACTIVE</span>
            <div>
              <strong>{payoutHold.type}</strong>
              <p className="muted">{payoutHold.reason}</p>
              <p className="muted">{payoutHold.timeline}</p>
            </div>
            <small>{payoutHold.idLabel}</small>
          </div>
        ) : null}
        <form className="form-grid" action={createProviderSanction}>
          <input type="hidden" name="providerProfileId" value={providerId} />
          <label>
            Control type
            <select name="type" defaultValue="PAYOUT_HOLD">
              <option value="WARNING">Warning</option>
              <option value="PAYOUT_HOLD">Payout hold</option>
              <option value="ACCOUNT_BLOCK">Account block</option>
              <option value="TRUST_BADGE_REMOVAL">Profile review hold</option>
            </select>
          </label>
          <label>
            Expires at
            <input name="expiresAt" type="datetime-local" />
          </label>
          <label className="full-span">
            Reason
            <input
              name="reason"
              placeholder="Clear operator reason, visible in audit and payout controls"
              required
              minLength={12}
              maxLength={500}
            />
          </label>
          <div className="actions full-span">
            <button type="submit">Apply account control</button>
            <Link className="text-link" href="/payouts">
              Open payouts
            </Link>
          </div>
        </form>
      </div>
      <div className="detail-grid">
        <div>
          <h3>Recent reports</h3>
          {reports.length ? (
            <div className="setup-stage-list">
              {reports.map((report) => (
                <div className="setup-stage-item" key={report.id}>
                  <span>{report.status}</span>
                  <div>
                    <strong>{report.summary}</strong>
                    <p className="muted">
                      {report.category} / {report.source} / {report.createdLabel}
                    </p>
                    <div className="participant-list admin-mt-6">
                      <span className={`pill ${reportSeverityPill(report.severity)}`}>
                        {report.severity}
                      </span>
                      <span className={`pill ${reportStatusPill(report.status)}`}>{report.status}</span>
                      {report.bookingHref && report.bookingLabel ? (
                        <Link className="text-link" href={report.bookingHref}>
                          Booking {report.bookingLabel}
                        </Link>
                      ) : null}
                    </div>
                    {report.details ? <p className="muted">{report.details}</p> : null}
                    {report.resolutionNote ? (
                      <p className="muted">Resolution: {report.resolutionNote}</p>
                    ) : null}
                    <form className="actions admin-mt-8" action={updateProviderReport}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <input type="hidden" name="providerProfileId" value={providerId} />
                      <select name="status" defaultValue={report.status}>
                        <option value="OPEN">Open</option>
                        <option value="INVESTIGATING">Investigating</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="DISMISSED">Dismissed</option>
                      </select>
                      <select name="severity" defaultValue={report.severity}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">Major</option>
                        <option value="CRITICAL">Urgent</option>
                      </select>
                      <input name="resolutionNote" placeholder="Resolution note" />
                      <button type="submit">Update</button>
                    </form>
                    <form className="actions admin-mt-8" action={createProviderSanction}>
                      <input type="hidden" name="providerProfileId" value={providerId} />
                      <input type="hidden" name="reportId" value={report.id} />
                      <select name="type" defaultValue={report.defaultControlType}>
                        <option value="WARNING">Warning</option>
                        <option value="PAYOUT_HOLD">Payout hold</option>
                        <option value="ACCOUNT_BLOCK">Account block</option>
                        <option value="TRUST_BADGE_REMOVAL">Profile review hold</option>
                      </select>
                      <input
                        name="reason"
                        placeholder="Control reason"
                        required
                        minLength={12}
                        maxLength={500}
                      />
                      <button type="submit">Apply control</button>
                    </form>
                  </div>
                  <small>{report.smallLabel}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No partner reports recorded yet.</p>
          )}
        </div>
        <div>
          <h3>Recent account controls</h3>
          {accountControls.length ? (
            <div className="setup-stage-list">
              {accountControls.map((control) => (
                <div className="setup-stage-item" key={control.id}>
                  <span>{control.status}</span>
                  <div>
                    <strong>{control.type}</strong>
                    <p className="muted">{control.reason}</p>
                    <p className="muted">{control.timeline}</p>
                    {control.reportLine ? <p className="muted">{control.reportLine}</p> : null}
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
                      />
                    ) : null}
                  </div>
                  <small>{control.smallLabel}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No active or historical account control recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
