import Link from 'next/link';
import type { ReactNode } from 'react';
import { ExternalLink, Filter, X } from 'lucide-react';
import {
  AdminOperationalPolicySetting,
  AdminProvider,
  AdminProviderReport,
  AdminProviderSanction,
  adminGet,
} from '../../lib/admin-api';
import { marketplaceDisplayText as partnerDisplayText } from '../../lib/admin-copy';
import {
  formatMoney,
  shortDisplayId,
} from '../../lib/admin-format';
import {
  createProviderReport,
  createProviderSanction,
  liftProviderSanction,
  updateProviderReport,
} from './actions';
import { readSearchParam } from '../../lib/date-range';
import { OPERATIONAL_POLICY_KEYS, readPositivePolicyNumber } from '../../lib/operations-policy';
import { ActionMenu } from '../../components/action-menu';
import { AdminDataTable, AdminTablePaginationFooter } from '../../components/admin-data-table';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormActionRow,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminActionsForm } from '../../components/admin-inline-action-form';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminActionCard, AdminSection, AdminTaskCard } from '../../components/admin-surface';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import { adminAvatarStatusFromSignals, type AdminAvatarStatus } from '../../lib/admin-avatar-status';
import {
  buildPartnerControlDeskActionConfirmation,
  partnerControlDeskActionConfirmHref,
  readPartnerControlDeskConfirmationAction,
  type PartnerControlDeskConfirmationAction,
} from './partner-control-desk-action-confirmation';
import {
  buildPartnerControlActiveFilters,
  buildPartnerControlFilters,
  isPartnerControlCashDebtReview,
  partnerControlListHref,
  type PartnerControlPageFilters,
} from './partner-control-page-filters';
import { buildPartnerControlPageLoadPlan } from './partner-control-page-load-plan';
import { buildPartnerControlPageMetrics } from './partner-control-page-metrics';
import {
  buildPartnerControlSummaryFromServer,
  type PartnerControlSummaryResponse,
} from './partner-control-summary';

type PartnerControlsSearchParams = Promise<Record<string, string | string[] | undefined>>;
type PartnerControlPolicy = {
  responseWindowMinutes: number;
  backupRadiusMeters: number;
  invitationLimit: number;
  locationFreshnessMinutes: number;
};

type PartnerControlBoardItem = {
  provider: AdminProvider;
  partner: string;
  status: string;
  walletBalance: number;
  reasons: string[];
  controls: Array<{ label: string; className: string }>;
  actionLabel: string;
  actionHref: string;
  operatorAction: string;
  priority: number;
};

type PartnerControlBoard = {
  metrics: PartnerControlCommandMetric[];
  items: PartnerControlBoardItem[];
};

const DEFAULT_PARTNER_CONTROL_POLICY: PartnerControlPolicy = {
  responseWindowMinutes: 10,
  backupRadiusMeters: 10000,
  invitationLimit: 50,
  locationFreshnessMinutes: 90,
};

function PartnerControlStatusBadge({
  children,
  pillClass,
}: {
  readonly children: ReactNode;
  readonly pillClass: string;
}) {
  return (
    <StatusBadge
      className={partnerControlStatusBadgeExtraClassName(pillClass)}
      tone={statusBadgeToneFromPillClass(pillClass)}
    >
      {children}
    </StatusBadge>
  );
}

function partnerControlStatusBadgeExtraClassName(pillClass: string) {
  const extraClassName = pillClass
    .split(/\s+/)
    .filter((className) => className && className !== 'pill' && !className.startsWith('pill-'))
    .join(' ');
  return extraClassName || undefined;
}

export default async function PartnerControlsPage({
  searchParams,
}: {
  searchParams?: PartnerControlsSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const filters = buildPartnerControlFilters(params);
  const loadPlan = buildPartnerControlPageLoadPlan(params);
  const [providers, reports, sanctions, summaryResponse, operationalPolicies] = await Promise.all([
    adminGet<AdminProvider[]>(loadPlan.providersHref, []),
    adminGet<AdminProviderReport[]>(loadPlan.reportsHref, []),
    adminGet<AdminProviderSanction[]>(loadPlan.sanctionsHref, []),
    adminGet<PartnerControlSummaryResponse | null>(loadPlan.summaryHref, null),
    adminGet<AdminOperationalPolicySetting[]>(loadPlan.operationalPolicyHref, []),
  ]);
  const controlPolicy = buildPartnerControlPolicy(operationalPolicies);
  const visibleReports = filterReports(reports, filters);
  const visibleSanctions = filterSanctions(sanctions, filters);
  const reportTotalPages = partnerControlEstimatedTotalPages(visibleReports.length, loadPlan.reportsPage, loadPlan.listTake);
  const sanctionTotalPages = partnerControlEstimatedTotalPages(visibleSanctions.length, loadPlan.sanctionsPage, loadPlan.listTake);
  const activeFilters = buildPartnerControlActiveFilters(filters);
  const providerOptions = providers.map((provider) => ({
    id: provider.id,
    label: partnerDisplayText(provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id),
  }));
  const summary =
    buildPartnerControlSummaryFromServer(summaryResponse) ??
    buildPartnerControlSummary(reports, sanctions, providers, controlPolicy);
  const pageMetrics = buildPartnerControlPageMetrics(summary);
  const rawProviderWatchlist = buildPartnerControlWatchlist(providers, controlPolicy);
  const providerWatchlist = filterPartnerControlWatchlist(rawProviderWatchlist, filters);
  const commandCenter = buildPartnerControlCommandCenter({
    reports,
    sanctions,
    watchlist: providerWatchlist,
  });
  const operatingBlocks = buildPartnerOperatingBlocks(providerWatchlist);
  const acceptanceUnblockBoard = buildBookingAcceptanceUnblockBoard(providerWatchlist, controlPolicy);
  const acceptanceUnblockPlaybook = buildAcceptanceUnblockPlaybook(acceptanceUnblockBoard);
  const partnerControlBoard = buildPartnerControlBoard(providers, providerWatchlist);
  const controlConfirmation = buildPartnerControlDeskActionConfirmation(
    sanctions,
    readPartnerControlDeskConfirmationAction(readSearchParam(params.controlAction)),
    readSearchParam(params.sanctionId),
    filters,
  );

  return (
    <>
      {controlConfirmation ? (
        <ConfirmDialog
          action={partnerControlDeskServerAction(controlConfirmation.action)}
          cancelHref={controlConfirmation.cancelHref}
          confirmLabel={controlConfirmation.confirmLabel}
          description={controlConfirmation.description}
          disabled={controlConfirmation.disabled}
          hiddenInputs={controlConfirmation.hiddenInputs}
          id={`partner-control-desk-action-${controlConfirmation.action}-${controlConfirmation.sanctionId}`}
          title={controlConfirmation.title}
          tone={controlConfirmation.tone}
        />
      ) : null}
      <AdminPageTemplate
        contentClassName="partner-controls-page"
        description="Track Partner reports, account controls, booking blocks, payout holds, and operations follow-up in one operator view."
        metrics={pageMetrics}
        title="Partner Controls"
      >

      <AdminSection
        actions={
          <>
          <PartnerControlStatusBadge pillClass={commandCenter.urgentCount ? 'pill-danger' : 'pill-success'}>
            {commandCenter.urgentCount ? `${commandCenter.urgentCount} time-sensitive` : 'No time-sensitive lane'}
          </PartnerControlStatusBadge>
          <AdminFormControlLink className="button-secondary partner-control-inline-action" href="/operations-policy">
            <ExternalLink aria-hidden="true" size={14} />
            {controlPolicy.responseWindowMinutes}m first-pick / {formatDistance(controlPolicy.backupRadiusMeters)}{' '}
            marketplace radius / {controlPolicy.invitationLimit} invite cap / location{' '}
            {controlPolicy.locationFreshnessMinutes}m
          </AdminFormControlLink>
          </>
        }
        className="admin-mb-16"
        description="One-screen review for finance blocks, account controls, document review, and investigation SLA."
        id="partner-control-command-center"
        title="Partner control command center"
      >
        <div className="ops-task-grid admin-mt-12">
          {commandCenter.lanes.map((lane) => (
            <AdminActionCard
              actionLabel={lane.action}
              className={lane.className}
              detail={lane.detail}
              href={lane.href}
              key={lane.title}
              leading={<small>{lane.status}</small>}
              title={lane.title}
              variant="ops-task"
            >
              <div className="ops-task-breakdown">
                {lane.metrics.map((metric) => (
                  <span className={`ops-task-breakdown-item ${metric.tone}`} key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </span>
                ))}
              </div>
            </AdminActionCard>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Sorted by saved report level, wallet impact, active controls, and how long the item has waited."
        id="partner-control-next-actions"
        statusLabel={`${commandCenter.nextActions.length} action(s)`}
        statusTone="info"
        title="Next operator actions"
      >
        {commandCenter.nextActions.length ? (
          <div className="setup-stage-list admin-mt-12">
            {commandCenter.nextActions.map((action) => (
              <div className="setup-stage-item" key={action.id}>
                <span>{action.status}</span>
                <div>
                  <strong>{action.title}</strong>
                  <p className="muted">{action.detail}</p>
                  <p className="muted">{action.operatorAction}</p>
                  <div className="participant-list">
                    {action.tags.map((tag) => (
                      <PartnerControlStatusBadge key={`${action.id}-${tag.label}`} pillClass={tag.tone}>
                        {tag.label}
                      </PartnerControlStatusBadge>
                    ))}
                  </div>
                </div>
                <Link className="text-link" href={action.href}>
                  Open
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted admin-mt-12">
            No Partner control action currently needs operator review.
          </p>
        )}
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Shows factual Partner controls for booking blocks, wallet debt, payout gates, document gaps, location freshness, and device reachability."
        id="partner-control-board"
        statusLabel={`${partnerControlBoard.items.length} partner(s)`}
        statusTone="info"
        title="Partner control board"
      >
        <div className="ops-task-grid admin-mt-12">
          {partnerControlBoard.metrics.map((controlMetric) => (
            <AdminTaskCard
              key={controlMetric.label}
              leading={<small>{controlMetric.label}</small>}
              title={controlMetric.value}
            >
              <div className="ops-task-breakdown">
                <span className={`ops-task-breakdown-item ${controlMetric.tone}`}>
                  <span>Control type</span>
                  <strong>{controlMetric.label}</strong>
                </span>
              </div>
            </AdminTaskCard>
          ))}
        </div>
        {partnerControlBoard.items.length ? (
          <div className="setup-stage-list admin-mt-12">
            {partnerControlBoard.items.map((item) => (
              <div className="setup-stage-item" key={item.provider.id}>
                <span>{item.status}</span>
                <div>
                  <PartnerControlProviderCell
                    helper={
                      <>
                        Wallet <MoneyText amount={item.walletBalance} /> / {item.reasons.join(', ')}
                      </>
                    }
                    provider={item.provider}
                  />
                  <p className="muted">{item.operatorAction}</p>
                  <div className="participant-list">
                    {item.controls.map((control) => (
                      <PartnerControlStatusBadge
                        key={`${item.provider.id}-${control.label}`}
                        pillClass={control.className}
                      >
                        {control.label}
                      </PartnerControlStatusBadge>
                    ))}
                  </div>
                </div>
                <div className="actions">
                  <Link className="text-link" href={item.actionHref}>
                    {item.actionLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted admin-mt-12">
            No Partner currently has an active account, wallet, document, payout, location, or device
            follow-up.
          </p>
        )}
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Shows which Partners cannot participate in marketplace bookings now, which issues only affect payout, and exactly where staff should clear the blocker."
        id="partner-control-unblock-board"
        status={
          <PartnerControlStatusBadge
            pillClass={
              acceptanceUnblockBoard.some((item) => item.blockingCount > 0) ? 'pill-danger' : 'pill-success'
            }
          >
            {acceptanceUnblockBoard.reduce((sum, item) => sum + item.blockingCount, 0)} blocking partner(s)
          </PartnerControlStatusBadge>
        }
        title="Marketplace and payout unblock board"
      >
        <div className="ops-task-grid admin-mt-12">
          {acceptanceUnblockBoard.map((item) => (
            <AdminActionCard
              actionLabel={item.action}
              className={item.className}
              detail={item.detail}
              href={item.href}
              key={item.id}
              leading={<small>{item.status}</small>}
              title={item.title}
              variant="ops-task"
            >
              <p className="muted">
                <strong>Operator script:</strong> {item.operatorScript}
              </p>
              <p className="muted">
                <strong>Customer impact:</strong> {item.customerImpact}
              </p>
              <div className="ops-task-breakdown">
                {item.metrics.map((metric) => (
                  <span className={`ops-task-breakdown-item ${metric.tone}`} key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </span>
                ))}
              </div>
              {item.partnerSamples.length ? (
                <div className="participant-list admin-mt-10">
                  {item.partnerSamples.map((partner) => (
                    <StatusBadge key={`${item.id}-${partner}`} tone="info">
                      {partner}
                    </StatusBadge>
                  ))}
                </div>
              ) : null}
            </AdminActionCard>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Step-by-step operating order for restoring Partner marketplace and payout gates without mixing payout-only gates into customer discovery or marketplace participation decisions."
        id="partner-control-unblock-playbook"
        status={
          <PartnerControlStatusBadge
            pillClass={
              acceptanceUnblockPlaybook.some((step) => step.blockingCount) ? 'pill-warn' : 'pill-success'
            }
          >
            {acceptanceUnblockPlaybook.reduce((sum, step) => sum + step.blockingCount, 0)} active blocker(s)
          </PartnerControlStatusBadge>
        }
        title="Marketplace and payout unblock playbook"
      >
        <div className="setup-stage-list admin-mt-12">
          {acceptanceUnblockPlaybook.map((step) => (
            <div className="setup-stage-item" key={step.id}>
              <span>{step.step}</span>
              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.detail}</p>
                <p className="muted">
                  <strong>Booking impact:</strong> {step.bookingImpact}
                </p>
                <p className="muted">
                  <strong>Payout impact:</strong> {step.payoutImpact}
                </p>
                <p className="muted">
                  <strong>Customer impact:</strong> {step.customerImpact}
                </p>
                <div className="participant-list">
                  <PartnerControlStatusBadge pillClass={step.pillClass}>{step.status}</PartnerControlStatusBadge>
                  <StatusBadge tone="info">{step.owner}</StatusBadge>
                  {step.partnerSamples.map((partner) => (
                    <StatusBadge key={`${step.id}-${partner}`} tone="neutral">
                      {partner}
                    </StatusBadge>
                  ))}
                </div>
              </div>
              <Link className="text-link" href={step.href}>
                {step.action}
              </Link>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Explains why a Partner may be held from paid work, payout, or dispatch-sensitive work, with the exact screen an operator should open next."
        id="partner-control-block-matrix"
        status={
          <PartnerControlStatusBadge pillClass={operatingBlocks.length ? 'pill-warn' : 'pill-success'}>
            {operatingBlocks.length ? `${operatingBlocks.length} block record(s)` : 'No block record'}
          </PartnerControlStatusBadge>
        }
        title="Partner operating block matrix"
      >
        {operatingBlocks.length ? (
          <div className="setup-stage-list admin-mt-12">
            {operatingBlocks.map((block) => (
              <div className="setup-stage-item" key={block.id}>
                <span>{block.impact}</span>
                <div>
                  <strong>{block.title}</strong>
                  <p className="muted">{block.reason}</p>
                  <p className="muted">{block.operatorAction}</p>
                  <div className="participant-list">
                    <PartnerControlStatusBadge pillClass={block.tone}>{block.severity}</PartnerControlStatusBadge>
                    <StatusBadge tone="info">{block.partner}</StatusBadge>
                  </div>
                </div>
                <div className="actions">
                  <Link className="text-link" href={block.href}>
                    Open
                  </Link>
                  <AdminFormControlLink
                    className="button-secondary partner-control-inline-action"
                    href={`/partners/${block.providerId}`}
                  >
                    Profile
                  </AdminFormControlLink>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted admin-mt-12">
            No Partner currently has a control record that should block operations.
          </p>
        )}
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Dashboard links land here with the exact review lane already selected."
        id="partner-control-filters"
        status={
          <PartnerControlStatusBadge pillClass={activeFilters.length ? 'pill-warn' : 'pill-success'}>
            Showing {visibleReports.length} report(s), {visibleSanctions.length} account control(s)
          </PartnerControlStatusBadge>
        }
        title="Control filters"
      >
        {activeFilters.length > 0 ? (
          <p className="muted admin-mb-12">
            Active queue: {activeFilters.map((filter) => filter.description).join(' ')}
          </p>
        ) : (
          <p className="muted admin-mb-12">No control filter is active. Showing every report and account-control lane.</p>
        )}
        <AdminFormGrid action="/partner-controls">
          {filters.review ? <input name="review" type="hidden" value={filters.review} /> : null}
          <AdminFormInput
            className="admin-form-control-fluid"
            defaultValue={filters.q}
            label="Search"
            labelVisibility="visible"
            name="q"
            placeholder="Partner, phone, category, reason"
          />
          <AdminFormSelect
            className="admin-form-control-fluid"
            defaultValue={filters.status}
            label="Report status"
            labelVisibility="visible"
            name="status"
            options={[
              { label: 'All', value: '' },
              { label: 'Open', value: 'OPEN' },
              { label: 'Investigating', value: 'INVESTIGATING' },
              { label: 'Resolved', value: 'RESOLVED' },
              { label: 'Dismissed', value: 'DISMISSED' },
            ]}
          />
          <AdminFormSelect
            className="admin-form-control-fluid"
            defaultValue={filters.severity}
            label="Report level"
            labelVisibility="visible"
            name="severity"
            options={[
              { label: 'All', value: '' },
              { label: 'Urgent + major reports', value: 'HIGH_PLUS' },
              { label: 'Urgent', value: 'CRITICAL' },
              { label: 'Major', value: 'HIGH' },
              { label: 'Medium', value: 'MEDIUM' },
              { label: 'Low', value: 'LOW' },
            ]}
          />
          <AdminFormSelect
            className="admin-form-control-fluid"
            defaultValue={filters.sanction}
            label="Account control"
            labelVisibility="visible"
            name="sanction"
            options={[
              { label: 'All', value: '' },
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Lifted', value: 'LIFTED' },
              { label: 'Expired', value: 'EXPIRED' },
            ]}
          />
          <AdminFormActionRow className="actions full-span">
            <AdminFormControlButton className="button-primary" type="submit">
              <Filter aria-hidden="true" size={16} />
              Apply filters
            </AdminFormControlButton>
            <AdminFormControlLink className="button-secondary" href="/partner-controls">
              <X aria-hidden="true" size={16} />
              Clear filters
            </AdminFormControlLink>
          </AdminFormActionRow>
          {activeFilters.length > 0 ? (
            <div className="participant-list full-span">
              <StatusBadge tone="info">Active filters</StatusBadge>
              {activeFilters.map((filter) => (
                <StatusBadge key={`${filter.kind}-${filter.value}`} tone="warning">
                  {filter.label}
                </StatusBadge>
              ))}
            </div>
          ) : null}
        </AdminFormGrid>
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Factual partner follow-ups from wallet debt, account controls, onboarding gaps, devices, and recent report history."
        id="partner-control-checklist"
        statusLabel={`${providerWatchlist.length} partner(s)`}
        statusTone="info"
        title="System control checklist"
      >
        <AdminDataTable
          emptyMessage="No Partner control follow-ups are active."
          headers={['Partner', 'Control signals', 'Money / access', 'Operator next step']}
          rowCount={providerWatchlist.length}
        >
            {providerWatchlist.map((item) => (
              <tr key={item.provider.id}>
                <td>
                  <PartnerControlProviderCell provider={item.provider} />
                  <PartnerControlStatusBadge pillClass={watchSeverityPill(item.severity)}>
                    {item.severity}
                  </PartnerControlStatusBadge>
                </td>
                <td>
                  <div className="participant-list">
                    {item.signals.map((signal) => (
                      <PartnerControlStatusBadge key={signal.label} pillClass={watchSignalPill(signal.kind)}>
                        {signal.label}
                      </PartnerControlStatusBadge>
                    ))}
                  </div>
                  <p className="muted">{item.detail}</p>
                </td>
                <td>
                  <strong>
                    <MoneyText amount={item.walletBalance} />
                  </strong>
                  <p className="muted">
                    {item.walletBalance < 0
                      ? `Settlement ref ${cashDebtSettlementReference(item.provider.id)}`
                      : 'No negative wallet balance in pending/available earnings.'}
                  </p>
                  {item.hasPayoutHold ? (
                    <StatusBadge tone="danger">Payout hold active</StatusBadge>
                  ) : null}
                  {item.provider.blockedAt ? <StatusBadge tone="danger">Account blocked</StatusBadge> : null}
                </td>
                <td>
                  <div className="actions">
                    {item.walletBalance < 0 ? (
                      <Link className="text-link" href="/cash-settlements">
                        Cash debt queue
                      </Link>
                    ) : null}
                    {item.openReportCount > 0 ? (
                      <AdminFormControlLink
                        className="button-secondary partner-control-inline-action"
                        href={`/partner-controls?q=${encodeURIComponent(item.provider.id)}`}
                      >
                        <ExternalLink aria-hidden="true" size={14} />
                        Report lane
                      </AdminFormControlLink>
                    ) : null}
                  </div>
                  <p className="muted">{item.nextStep}</p>
                </td>
              </tr>
            ))}
        </AdminDataTable>
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Use this for customer complaints, staff findings, payout holds, or service safety notes."
        id="partner-control-create-report"
        title="Create partner report"
      >
        <AdminFormGrid action={createProviderReport}>
          <AdminFormSelect
            className="admin-form-control-fluid"
            label="Partner"
            labelVisibility="visible"
            name="providerProfileId"
            options={[
              { label: 'Choose partner', value: '' },
              ...providerOptions.map((provider) => ({ label: provider.label, value: provider.id })),
            ]}
            required
          />
          <AdminFormInput
            className="admin-form-control-fluid"
            label="Category"
            labelVisibility="visible"
            name="category"
            placeholder="safety, payout, behavior, identity"
            required
          />
          <AdminFormSelect
            className="admin-form-control-fluid"
            defaultValue="MEDIUM"
            label="Report level"
            labelVisibility="visible"
            name="severity"
            options={[
              { label: 'Low', value: 'LOW' },
              { label: 'Medium', value: 'MEDIUM' },
              { label: 'Major', value: 'HIGH' },
              { label: 'Urgent', value: 'CRITICAL' },
            ]}
          />
          <AdminFormSelect
            className="admin-form-control-fluid"
            defaultValue="ADMIN"
            label="Source"
            labelVisibility="visible"
            name="source"
            options={[
              { label: 'Admin', value: 'ADMIN' },
              { label: 'Customer', value: 'CUSTOMER' },
              { label: 'Partner', value: 'PROVIDER' },
              { label: 'System', value: 'SYSTEM' },
            ]}
          />
          <AdminFormInput
            className="admin-form-control-fluid"
            label="Booking ID"
            labelVisibility="visible"
            name="bookingId"
            placeholder="Optional booking id"
          />
          <AdminFormInput
            className="admin-form-control-fluid admin-grid-span-2"
            label="Summary"
            labelVisibility="visible"
            name="summary"
            placeholder="Short operator-readable report summary"
            required
          />
          <AdminFormTextarea
            className="admin-form-control-fluid admin-grid-span-2"
            label="Details"
            labelVisibility="visible"
            name="details"
            placeholder="Evidence, timeline, customer/partner statements, next step"
          />
          <AdminFormActionRow className="actions full-span">
            <AdminFormControlButton className="button-primary" type="submit">
              Create report
            </AdminFormControlButton>
          </AdminFormActionRow>
        </AdminFormGrid>
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Open and investigating reports should be cleared before profile review or payout changes."
        id="partner-control-reports"
        statusLabel={`${visibleReports.length} shown`}
        statusTone="info"
        title="Reports"
      >
        <AdminDataTable
          emptyMessage={emptyPartnerControlMessage('report', activeFilters)}
          headers={['Report', 'Partner', 'Status', 'Account control', 'Action']}
          rowCount={visibleReports.length}
        >
            {visibleReports.map((report) => (
              <tr key={report.id}>
                <td>
                  <strong>{partnerDisplayText(report.summary)}</strong>
                  <p className="muted">
                    {report.category} / {report.source} / <PartnerControlDateText value={report.createdAt} />
                  </p>
                  {report.details ? <p className="muted">{partnerDisplayText(report.details)}</p> : null}
                  {report.bookingId ? (
                    <AdminFormControlLink
                      className="button-secondary partner-control-inline-action"
                      href={`/bookings/${report.bookingId}`}
                    >
                      <ExternalLink aria-hidden="true" size={14} />
                      Booking {shortDisplayId(report.bookingId)}
                    </AdminFormControlLink>
                  ) : null}
                </td>
                <td>
                  <PartnerControlLinkedProviderCell
                    fallbackId={report.providerProfileId}
                    provider={report.providerProfile}
                  />
                </td>
                <td>
                  <PartnerControlStatusBadge pillClass={severityPill(report.severity)}>
                    {report.severity}
                  </PartnerControlStatusBadge>
                  <PartnerControlStatusBadge pillClass={`${statusPill(report.status)} admin-ml-6`}>
                    {report.status}
                  </PartnerControlStatusBadge>
                  {report.resolutionNote ? (
                    <p className="muted">{partnerDisplayText(report.resolutionNote)}</p>
                  ) : null}
                </td>
                <td>
                  <AdminActionsForm action={createProviderSanction}>
                    <input type="hidden" name="providerProfileId" value={report.providerProfileId} />
                    <input type="hidden" name="reportId" value={report.id} />
                    <AdminFormSelect
                      label="Account control type"
                      name="type"
                      defaultValue={report.severity === 'CRITICAL' ? 'ACCOUNT_BLOCK' : 'WARNING'}
                      options={[
                        { label: 'Warning', value: 'WARNING' },
                        { label: 'Payout hold', value: 'PAYOUT_HOLD' },
                        { label: 'Account block', value: 'ACCOUNT_BLOCK' },
                        { label: 'Profile review hold', value: 'TRUST_BADGE_REMOVAL' },
                      ]}
                    />
                    <AdminFormInput
                      label="Account control reason"
                      name="reason"
                      placeholder="Account control reason"
                      required
                      minLength={12}
                      maxLength={500}
                    />
                    <AdminFormControlButton className="button-primary" type="submit">
                      Apply
                    </AdminFormControlButton>
                  </AdminActionsForm>
                </td>
                <td>
                  <AdminActionsForm action={updateProviderReport}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="providerProfileId" value={report.providerProfileId} />
                    <AdminFormSelect
                      defaultValue={report.status}
                      label="Report status"
                      name="status"
                      options={[
                        { label: 'Open', value: 'OPEN' },
                        { label: 'Investigating', value: 'INVESTIGATING' },
                        { label: 'Resolved', value: 'RESOLVED' },
                        { label: 'Dismissed', value: 'DISMISSED' },
                      ]}
                    />
                    <AdminFormSelect
                      defaultValue={report.severity}
                      label="Report level"
                      name="severity"
                      options={[
                        { label: 'Low', value: 'LOW' },
                        { label: 'Medium', value: 'MEDIUM' },
                        { label: 'Major', value: 'HIGH' },
                        { label: 'Urgent', value: 'CRITICAL' },
                      ]}
                    />
                    <AdminFormInput
                      label="Resolution or follow-up note"
                      name="resolutionNote"
                      placeholder="Resolution or follow-up note"
                    />
                    <AdminFormControlButton className="button-primary" type="submit">
                      Update
                    </AdminFormControlButton>
                  </AdminActionsForm>
                </td>
              </tr>
            ))}
        </AdminDataTable>
        <AdminTablePaginationFooter
          activePage={loadPlan.reportsPage}
          ariaLabel="Partner reports pages"
          className="vuexy-partner-table-footer"
          from={partnerControlPagedListFrom(visibleReports.length, loadPlan.reportsPage, loadPlan.listTake)}
          hrefForPage={(page) => partnerControlListHref(params, 'reportPage', page)}
          to={partnerControlPagedListTo(visibleReports.length, loadPlan.reportsPage, loadPlan.listTake)}
          totalPages={reportTotalPages}
          totalRows={partnerControlPagedListTotalRows(
            visibleReports.length,
            loadPlan.reportsPage,
            loadPlan.listTake,
          )}
        />
      </AdminSection>

      <AdminSection
        description="Active account controls restrict work or payout. Lift them only with a clear audit trail."
        id="partner-control-account-controls"
        statusLabel={`${visibleSanctions.length} shown`}
        statusTone="info"
        title="Account controls"
      >
        <AdminDataTable
          emptyMessage={emptyPartnerControlMessage('sanction', activeFilters)}
          headers={['Control', 'Partner', 'Linked report', 'Timeline', 'Action']}
          rowCount={visibleSanctions.length}
        >
            {visibleSanctions.map((sanction) => (
              <tr key={sanction.id}>
                <td>
                  <PartnerControlStatusBadge pillClass={sanction.status === 'ACTIVE' ? 'pill-danger' : 'pill-neutral'}>
                    {sanction.status}
                  </PartnerControlStatusBadge>
                  <p>
                    <strong>{sanction.type}</strong>
                  </p>
                  <p className="muted">{partnerDisplayText(sanction.reason)}</p>
                </td>
                <td>
                  <PartnerControlLinkedProviderCell
                    fallbackId={sanction.providerProfileId}
                    provider={sanction.providerProfile}
                  />
                </td>
                <td>
                  {sanction.report ? (
                    <>
                      <strong>{sanction.report.category}</strong>
                      <p className="muted">
                        {sanction.report.severity} / {sanction.report.status}
                      </p>
                      <p className="muted">{partnerDisplayText(sanction.report.summary)}</p>
                    </>
                  ) : (
                    <span className="muted">Manual account control</span>
                  )}
                </td>
                <td>
                  <p className="muted">
                    Started: <PartnerControlDateText value={sanction.startsAt} />
                  </p>
                  <p className="muted">
                    Expires: <PartnerControlDateText value={sanction.expiresAt} />
                  </p>
                  <p className="muted">
                    Lifted: <PartnerControlDateText value={sanction.liftedAt} />
                  </p>
                </td>
                <td>
                  {sanction.status === 'ACTIVE' ? (
                    <ActionMenu
                      actions={[
                        {
                          description: 'Review before lifting this Partner account control.',
                          href: partnerControlDeskActionConfirmHref({
                            q: filters.q,
                            sanction: filters.sanction,
                            sanctionId: sanction.id,
                            severity: filters.severity,
                            status: filters.status,
                          }),
                          kind: 'link',
                          label: 'Lift control',
                          tone: 'warning',
                        },
                      ]}
                      label={`Account control actions for ${shortDisplayId(sanction.id)}`}
                    />
                  ) : (
                    <span className="muted">Closed</span>
                  )}
                </td>
              </tr>
            ))}
        </AdminDataTable>
        <AdminTablePaginationFooter
          activePage={loadPlan.sanctionsPage}
          ariaLabel="Partner account control pages"
          className="vuexy-partner-table-footer"
          from={partnerControlPagedListFrom(visibleSanctions.length, loadPlan.sanctionsPage, loadPlan.listTake)}
          hrefForPage={(page) => partnerControlListHref(params, 'sanctionPage', page)}
          to={partnerControlPagedListTo(visibleSanctions.length, loadPlan.sanctionsPage, loadPlan.listTake)}
          totalPages={sanctionTotalPages}
          totalRows={partnerControlPagedListTotalRows(
            visibleSanctions.length,
            loadPlan.sanctionsPage,
            loadPlan.listTake,
          )}
        />
      </AdminSection>
      </AdminPageTemplate>
    </>
  );
}

function partnerControlDeskServerAction(action: PartnerControlDeskConfirmationAction) {
  switch (action) {
    case 'lift-control':
      return liftProviderSanction;
  }
}

type PartnerControlLinkedProvider =
  | NonNullable<AdminProviderReport['providerProfile']>
  | NonNullable<AdminProviderSanction['providerProfile']>;

function PartnerControlProviderCell({
  helper,
  provider,
}: {
  readonly helper?: ReactNode;
  readonly provider: AdminProvider;
}) {
  return (
    <AdminPersonCell
      avatarClassName="vuexy-booking-avatar is-partner"
      avatarStatus={partnerControlProviderAvatarStatus(provider)}
      className="vuexy-booking-person"
      helper={helper ?? provider.user?.phone ?? 'No phone'}
      href={`/partners/${provider.id}`}
      label={adminProviderName(provider)}
      linkClassName="table-link"
    />
  );
}

function PartnerControlLinkedProviderCell({
  fallbackId,
  provider,
}: {
  readonly fallbackId: string;
  readonly provider?: PartnerControlLinkedProvider | null;
}) {
  if (!provider) {
    return <span>{fallbackId}</span>;
  }

  return (
    <AdminPersonCell
      avatarClassName="vuexy-booking-avatar is-partner"
      avatarStatus="offline"
      className="vuexy-booking-person"
      helper={provider.user?.phone ?? 'No phone'}
      href={`/partners/${provider.id}`}
      label={providerNameOrId(provider, fallbackId)}
      linkClassName="table-link"
    />
  );
}

function partnerControlProviderAvatarStatus(provider: AdminProvider): AdminAvatarStatus {
  return adminAvatarStatusFromSignals({
    devices: provider.devices,
    fallbackOnline: provider.status === 'ONLINE_AVAILABLE' || provider.status === 'ONLINE_AVAILABLE_SOON',
    matching: (provider.participants ?? []).some((participant) =>
      ['INVITED', 'PENDING', 'REQUESTED'].includes(participant.status),
    ),
    sessions: provider.sessions,
    working: provider.status === 'ONLINE_BUSY',
  });
}

type PartnerControlCommandCenterInput = {
  reports: AdminProviderReport[];
  sanctions: AdminProviderSanction[];
  watchlist: PartnerControlWatchItem[];
};

type PartnerControlCommandMetric = {
  label: string;
  value: ReactNode;
  tone:
    | 'ops-task-breakdown-ok'
    | 'ops-task-breakdown-info'
    | 'ops-task-breakdown-warn'
    | 'ops-task-breakdown-danger';
};

type PartnerControlNextAction = {
  id: string;
  priority: number;
  status: string;
  title: string;
  detail: string;
  operatorAction: string;
  href: string;
  tags: Array<{ label: string; tone: string }>;
};

type PartnerOperatingBlock = {
  id: string;
  providerId: string;
  partner: string;
  impact: string;
  severity: string;
  tone: string;
  title: string;
  reason: string;
  operatorAction: string;
  href: string;
  priority: number;
};

type BookingAcceptanceUnblockCard = {
  id: string;
  title: string;
  status: string;
  detail: string;
  operatorScript: string;
  customerImpact: string;
  action: string;
  href: string;
  className: string;
  blockingCount: number;
  partnerSamples: string[];
  metrics: PartnerControlCommandMetric[];
};

type AcceptanceUnblockPlaybookStep = {
  id: string;
  step: string;
  owner: string;
  title: string;
  status: string;
  pillClass: string;
  detail: string;
  bookingImpact: string;
  payoutImpact: string;
  customerImpact: string;
  action: string;
  href: string;
  blockingCount: number;
  partnerSamples: string[];
};

function buildPartnerControlBoard(
  providers: AdminProvider[],
  watchlist: PartnerControlWatchItem[],
): PartnerControlBoard {
  const watchByProvider = new Map(watchlist.map((item) => [item.provider.id, item]));
  const items = providers
    .map((provider) => buildPartnerControlBoardItem(provider, watchByProvider.get(provider.id)))
    .filter((item): item is PartnerControlBoardItem => Boolean(item))
    .sort((left, right) => right.priority - left.priority || left.partner.localeCompare(right.partner))
    .slice(0, 12);
  const bookingBlocked = items.filter((item) =>
    item.controls.some((control) => control.label === 'Booking blocked'),
  );
  const payoutGated = items.filter((item) =>
    item.controls.some((control) => control.label === 'Payout gated'),
  );
  const documentReview = items.filter((item) =>
    item.controls.some((control) => control.label === 'Documents'),
  );
  const locationFollowUp = items.filter((item) =>
    item.controls.some((control) => control.label === 'Location'),
  );

  return {
    metrics: [
      metric('Active controls', items.length, items.length ? 'warn' : 'ok'),
      metric('Booking blocks', bookingBlocked.length, bookingBlocked.length ? 'danger' : 'ok'),
      metric('Payout gates', payoutGated.length, payoutGated.length ? 'warn' : 'ok'),
      metric('Documents', documentReview.length, documentReview.length ? 'warn' : 'ok'),
      metric('Location checks', locationFollowUp.length, locationFollowUp.length ? 'info' : 'ok'),
    ],
    items,
  };
}

function buildPartnerControlBoardItem(
  provider: AdminProvider,
  watchItem: PartnerControlWatchItem | undefined,
): PartnerControlBoardItem | null {
  const walletBalance = providerUnsettledWalletBalance(provider);
  const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const reportsOpen = (provider.reports ?? []).filter((report) =>
    ['OPEN', 'INVESTIGATING'].includes(report.status),
  );
  const reasons = watchItem?.signals.map((signal) => signal.label) ?? [];
  const controls: PartnerControlBoardItem['controls'] = [];
  let priority = 0;

  if (
    provider.blockedAt ||
    walletBalance < 0 ||
    activeSanctions.some((sanction) => sanction.type === 'ACCOUNT_BLOCK')
  ) {
    controls.push({ label: 'Booking blocked', className: 'pill-danger' });
    priority += 100;
  }
  if (activeSanctions.some((sanction) => sanction.type === 'PAYOUT_HOLD')) {
    controls.push({ label: 'Payout gated', className: 'pill-warn' });
    priority += 80;
  }
  if (reportsOpen.length > 0 || activeSanctions.length > 0) {
    controls.push({ label: 'Reports', className: 'pill-info' });
    priority += 60;
  }
  if (
    !provider.kyc ||
    provider.kyc.status !== 'APPROVED' ||
    !(provider.bankAccounts ?? []).some((account) => account.status === 'APPROVED')
  ) {
    controls.push({ label: 'Documents', className: 'pill-warn' });
    priority += 40;
  }
  if (watchItem?.signals.some((signal) => signal.kind === 'LOCATION')) {
    controls.push({ label: 'Location', className: 'pill-info' });
    priority += 25;
  }
  if (watchItem?.signals.some((signal) => signal.kind === 'DEVICE')) {
    controls.push({ label: 'Device', className: 'pill-info' });
    priority += 20;
  }
  if (!watchItem && controls.length === 0) return null;

  const status = controls.some((control) => control.label === 'Booking blocked')
    ? 'Blocked'
    : controls.some((control) => control.label === 'Payout gated')
      ? 'Payout'
      : 'Review';
  const fallbackReasons = reasons.length ? reasons : controls.map((control) => control.label);

  return {
    provider,
    partner: partnerDisplayText(provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id),
    status,
    walletBalance,
    reasons: fallbackReasons.slice(0, 5),
    controls,
    actionLabel: reportsOpen.length || activeSanctions.length ? 'Open reports' : 'Open profile',
    actionHref:
      reportsOpen.length || activeSanctions.length
        ? `/partner-controls?q=${encodeURIComponent(provider.id)}`
        : `/partners/${provider.id}`,
    operatorAction:
      walletBalance < 0
        ? 'Collect the cash fee deposit or approve an auditable offset before this partner accepts more bookings.'
        : activeSanctions.length
          ? 'Review active account or payout controls and record the next operation decision.'
          : 'Open the partner profile and clear the missing document, location, or device follow-up.',
    priority,
  };
}

function buildPartnerControlCommandCenter(input: PartnerControlCommandCenterInput) {
  const openReports = input.reports.filter((report) => ['OPEN', 'INVESTIGATING'].includes(report.status));
  const urgentReports = openReports.filter((report) => ['CRITICAL', 'HIGH'].includes(report.severity));
  const overdueReports = openReports.filter((report) => reportAgeHours(report) >= reportSlaHours(report));
  const activeSanctions = input.sanctions.filter((sanction) => sanction.status === 'ACTIVE');
  const activePayoutHolds = activeSanctions.filter((sanction) => sanction.type === 'PAYOUT_HOLD');
  const activeAccountBlocks = activeSanctions.filter((sanction) => sanction.type === 'ACCOUNT_BLOCK');
  const walletDebtItems = input.watchlist.filter((item) => item.walletBalance < 0);
  const sharedDeviceItems = input.watchlist.filter((item) =>
    item.signals.some((signal) => signal.kind === 'DEVICE'),
  );

  const lanes = [
    {
      title: 'Safety triage',
      status: urgentReports.length ? 'URGENT' : 'CLEAR',
      detail: urgentReports.length
        ? 'Urgent or major reports need evidence review and a decision before profile review changes.'
        : 'No urgent or major partner report is currently open.',
      href: urgentReports.length ? '/partner-controls?severity=HIGH_PLUS' : '/partner-controls?status=OPEN',
      action: urgentReports.length ? 'Open urgent + major lane' : 'Review open reports',
      className: urgentReports.length ? 'ops-task-blocked' : 'ops-task-done',
      metrics: [
        metric('Urgent', urgentReports.filter((report) => report.severity === 'CRITICAL').length, 'danger'),
        metric('Major', urgentReports.filter((report) => report.severity === 'HIGH').length, 'warn'),
        metric('Open', openReports.length, openReports.length ? 'info' : 'ok'),
      ],
    },
    {
      title: 'Finance block',
      status: walletDebtItems.length ? 'BLOCKED' : 'CLEAR',
      detail: walletDebtItems.length
        ? 'Negative wallet Partners must settle cash fee debt before final acceptance, service start, or payout release.'
        : 'No Partner wallet is currently blocked by cash fee debt.',
      href: walletDebtItems.length ? '/cash-settlements' : '/earnings',
      action: walletDebtItems.length ? 'Open cash settlements' : 'Review earnings',
      className: walletDebtItems.length ? 'ops-task-blocked' : 'ops-task-done',
      metrics: [
        metric('Wallets', walletDebtItems.length, walletDebtItems.length ? 'danger' : 'ok'),
        metric(
          'Debt',
          <MoneyText amount={walletDebtItems.reduce((sum, item) => sum + Math.abs(item.walletBalance), 0)} />,
          walletDebtItems.length ? 'danger' : 'ok',
        ),
        metric('Payout holds', activePayoutHolds.length, activePayoutHolds.length ? 'warn' : 'ok'),
      ],
    },
    {
      title: 'Access controls',
      status: activeSanctions.length ? 'LIVE' : 'CLEAR',
      detail: activeSanctions.length
        ? 'Active account controls are live operating controls and need clean audit follow-up.'
        : 'No active account control is currently restricting partner operations.',
      href: activeSanctions.length ? '/partner-controls?sanction=ACTIVE' : '/partner-controls',
      action: activeSanctions.length ? 'Review active controls' : 'Open control board',
      className: activeSanctions.length ? 'ops-task-pending' : 'ops-task-done',
      metrics: [
        metric('Controls', activeSanctions.length, activeSanctions.length ? 'warn' : 'ok'),
        metric('Account blocks', activeAccountBlocks.length, activeAccountBlocks.length ? 'danger' : 'ok'),
        metric('Shared devices', sharedDeviceItems.length, sharedDeviceItems.length ? 'warn' : 'ok'),
      ],
    },
    {
      title: 'SLA aging',
      status: overdueReports.length ? 'OVERDUE' : 'ON TRACK',
      detail: overdueReports.length
        ? 'Some open investigations have passed the target review window.'
        : 'Open Partner reports are inside their review windows.',
      href: overdueReports.length
        ? '/partner-controls?status=OPEN'
        : '/partner-controls?status=INVESTIGATING',
      action: overdueReports.length ? 'Clear overdue reports' : 'Review investigations',
      className: overdueReports.length ? 'ops-task-blocked' : 'ops-task-done',
      metrics: [
        metric('Overdue', overdueReports.length, overdueReports.length ? 'danger' : 'ok'),
        metric(
          'Investigating',
          openReports.filter((report) => report.status === 'INVESTIGATING').length,
          'info',
        ),
        metric('Oldest', oldestReportAgeLabel(openReports), overdueReports.length ? 'warn' : 'ok'),
      ],
    },
  ];

  return {
    urgentCount: urgentReports.length + walletDebtItems.length + overdueReports.length,
    lanes,
    nextActions: buildPartnerControlNextActions({
      openReports,
      activeSanctions,
      watchlist: input.watchlist,
    }),
  };
}

function buildPartnerOperatingBlocks(watchlist: PartnerControlWatchItem[]) {
  const blocks: PartnerOperatingBlock[] = [];

  for (const item of watchlist) {
    const partner = adminProviderName(item.provider);
    if (item.walletBalance < 0) {
      blocks.push({
        id: `${item.provider.id}-wallet`,
        providerId: item.provider.id,
        partner,
        impact: 'MARKETPLACE BLOCK',
        severity: 'Wallet debt',
        tone: 'pill-danger',
        title: `${partner} cannot participate in marketplace bookings`,
        reason: `${formatMoney(Math.abs(item.walletBalance))} cash/company fee debt is still open.`,
        operatorAction: `Confirm Partner deposit, admin offset, or finance adjustment using ${cashDebtSettlementReference(item.provider.id)}.`,
        href: '/cash-settlements',
        priority: 110 + Math.min(20, Math.abs(item.walletBalance) / 100000),
      });
    }

    if (item.provider.blockedAt) {
      blocks.push({
        id: `${item.provider.id}-account-block`,
        providerId: item.provider.id,
        partner,
        impact: 'ACCOUNT BLOCK',
        severity: 'Blocked',
        tone: 'pill-danger',
        title: `${partner} account is blocked`,
        reason: item.provider.blockedReason || 'Partner account is restricted by an admin control.',
        operatorAction:
          'Review evidence and unblock only when the audit trail clearly explains the decision.',
        href: `/partners/${item.provider.id}`,
        priority: 105,
      });
    }

    if (item.hasPayoutHold) {
      blocks.push({
        id: `${item.provider.id}-payout-hold`,
        providerId: item.provider.id,
        partner,
        impact: 'PAYOUT BLOCK',
        severity: 'Payout hold',
        tone: 'pill-danger',
        title: `${partner} payout is on hold`,
        reason:
          'Active payout hold prevents normal payout processing until the underlying report is cleared.',
        operatorAction:
          'Open the payout and control lanes, resolve evidence, then lift the account control if appropriate.',
        href: '/payouts',
        priority: 92,
      });
    }

    if (item.openReportCount > 0) {
      blocks.push({
        id: `${item.provider.id}-open-report`,
        providerId: item.provider.id,
        partner,
        impact: 'REPORT REVIEW',
        severity: `${item.openReportCount} report(s)`,
        tone: item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'pill-danger' : 'pill-warn',
        title: `${partner} has open reports`,
        reason: 'Open reports can affect profile review, payout release, and future dispatch decisions.',
        operatorAction:
          'Move the report to investigating, resolve with notes, dismiss with evidence, or apply an account control.',
        href: `/partner-controls?q=${encodeURIComponent(item.provider.id)}`,
        priority: item.severity === 'CRITICAL' ? 88 : 78,
      });
    }

    const locationSignal = item.signals.find((signal) => signal.kind === 'LOCATION');
    if (locationSignal) {
      blocks.push({
        id: `${item.provider.id}-location`,
        providerId: item.provider.id,
        partner,
        impact: 'DISPATCH CHECK',
        severity: locationSignal.label,
        tone: 'pill-warn',
        title: `${partner} location needs refresh`,
        reason:
          'Distance sorting and configured invitation-radius decisions can be wrong when online location is missing or stale.',
        operatorAction:
          'Ask the Partner to reopen the app and refresh location before dispatch-sensitive work.',
        href: `/partners/${item.provider.id}`,
        priority: 64,
      });
    }

    if (item.signals.some((signal) => signal.kind === 'KYC')) {
      blocks.push({
        id: `${item.provider.id}-kyc`,
        providerId: item.provider.id,
        partner,
        impact: 'LEVEL GATE',
        severity: 'KYC pending',
        tone: 'pill-warn',
        title: `${partner} KYC is not approved`,
        reason:
          'Partner can remain in onboarding, but activity level should not be upgraded without identity approval.',
        operatorAction: 'Review CCCD/CMND and selfie documents, then approve, reject, or request reupload.',
        href: `/partners/${item.provider.id}`,
        priority: 56,
      });
    }

    if (item.signals.some((signal) => signal.kind === 'BANK')) {
      blocks.push({
        id: `${item.provider.id}-bank`,
        providerId: item.provider.id,
        partner,
        impact: 'PAYOUT SETUP',
        severity: 'Bank pending',
        tone: 'pill-warn',
        title: `${partner} bank account is not approved`,
        reason:
          'Partner may work only if policy allows it, but payout cannot be released without a verified account.',
        operatorAction: 'Review bank name, account holder, QR/banking data, and account-change history.',
        href: `/partners/${item.provider.id}`,
        priority: 48,
      });
    }

    if (item.signals.some((signal) => signal.kind === 'TAX')) {
      blocks.push({
        id: `${item.provider.id}-tax`,
        providerId: item.provider.id,
        partner,
        impact: 'FIRST EARNING',
        severity: 'Optional tax record',
        tone: 'pill-info',
        title: `${partner} has an optional tax profile review`,
        reason:
          'Tax profile registration is not required for Vietnam MVP partner approval, matching, work, payout, or wallet withdrawal.',
        operatorAction:
          'Review only if finance keeps optional tax records; do not hold Level 2 activity because of this profile.',
        href: '/tax-policy',
        priority: 36,
      });
    }
  }

  return blocks.sort((left, right) => right.priority - left.priority).slice(0, 18);
}

function buildBookingAcceptanceUnblockBoard(
  watchlist: PartnerControlWatchItem[],
  controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY,
): BookingAcceptanceUnblockCard[] {
  const cashDebtItems = watchlist.filter((item) => item.walletBalance < 0);
  const accountBlockedItems = watchlist.filter(
    (item) => item.provider.blockedAt || item.signals.some((signal) => signal.kind === 'BLOCK'),
  );
  const locationItems = watchlist.filter((item) => item.signals.some((signal) => signal.kind === 'LOCATION'));
  const verificationItems = watchlist.filter((item) => item.signals.some((signal) => signal.kind === 'KYC'));
  const deviceItems = watchlist.filter((item) => partnerHasDeviceContactGap(item.provider));
  const taxItems = watchlist.filter((item) => item.signals.some((signal) => signal.kind === 'TAX'));

  return [
    {
      id: 'wallet-debt',
      title: 'Cash fee debt gates final acceptance and service start',
      status: cashDebtItems.length ? 'BLOCKING' : 'CLEAR',
      detail: cashDebtItems.length
        ? 'Partners with negative wallet balance can stay visible but cannot complete final acceptance, start service, or receive payout release until HANDS fee debt is settled.'
        : 'No Partner is currently blocked by cash-service fee debt.',
      operatorScript:
        'Tell the Partner their unpaid HANDS fee must be deposited or offset before final acceptance, service start, or payout release unlocks.',
      customerImpact:
        'Customers can still see marketplace request flow normally; the Partner cannot complete final acceptance or service start until fee settlement is cleared.',
      action: cashDebtItems.length ? 'Open settlement queue' : 'Review wallet policy',
      href: cashDebtItems.length ? '/cash-settlements' : '/operations-policy',
      className: cashDebtItems.length ? 'ops-task-blocked' : 'ops-task-done',
      blockingCount: cashDebtItems.length,
      partnerSamples: partnerSamples(cashDebtItems),
      metrics: [
        metric('Blocked', cashDebtItems.length, cashDebtItems.length ? 'danger' : 'ok'),
        metric(
          'Debt',
          <MoneyText amount={cashDebtItems.reduce((sum, item) => sum + Math.abs(item.walletBalance), 0)} />,
          cashDebtItems.length ? 'danger' : 'ok',
        ),
        metric('Rule', 'Negative wallet', cashDebtItems.length ? 'warn' : 'ok'),
      ],
    },
    {
      id: 'account-controls',
      title: 'Account controls stop work',
      status: accountBlockedItems.length ? 'BLOCKING' : 'CLEAR',
      detail: accountBlockedItems.length
        ? 'Blocked accounts or active account controls must be reviewed before the partner receives work.'
        : 'No account block is currently holding partner work access.',
      operatorScript:
        'Keep the block active until evidence, notes, and the unblock reason are clear in the audit trail.',
      customerImpact: 'Customers will not see or match with partners under active account restrictions.',
      action: accountBlockedItems.length ? 'Review account blocks' : 'Open control board',
      href: accountBlockedItems.length ? '/partner-controls?sanction=ACTIVE' : '/partner-controls',
      className: accountBlockedItems.length ? 'ops-task-blocked' : 'ops-task-done',
      blockingCount: accountBlockedItems.length,
      partnerSamples: partnerSamples(accountBlockedItems),
      metrics: [
        metric('Blocked', accountBlockedItems.length, accountBlockedItems.length ? 'danger' : 'ok'),
        metric('Profile', accountBlockedItems.filter((item) => item.provider.blockedAt).length, 'info'),
        metric('Audit', 'Required', accountBlockedItems.length ? 'warn' : 'ok'),
      ],
    },
    {
      id: 'location-dispatch',
      title: 'Location freshness controls dispatch',
      status: locationItems.length ? 'DISPATCH HOLD' : 'READY',
      detail: locationItems.length
        ? `Distance ordering, ${formatDistance(
            controlPolicy.backupRadiusMeters,
          )} marketplace invitations, the ${controlPolicy.invitationLimit}-partner invite cap, and customer expectations depend on fresh partner location.`
        : 'Online partner locations are fresh enough for dispatch decisions.',
      operatorScript:
        'Ask the Partner to reopen the app and refresh GPS before taking dispatch-sensitive bookings.',
      customerImpact:
        'Distance sorting and marketplace invitations can be inaccurate when the last location is stale.',
      action: locationItems.length ? 'Open partner profiles' : 'Review location policy',
      href: locationItems.length ? '/partners' : '/operations-policy',
      className: locationItems.length ? 'ops-task-pending' : 'ops-task-done',
      blockingCount: 0,
      partnerSamples: partnerSamples(locationItems),
      metrics: [
        metric('Stale/missing', locationItems.length, locationItems.length ? 'warn' : 'ok'),
        metric('Acceptance', 'Policy gate', locationItems.length ? 'warn' : 'ok'),
        metric(
          'Invite pool',
          `${formatDistance(controlPolicy.backupRadiusMeters)} / ${controlPolicy.invitationLimit}`,
          'info',
        ),
      ],
    },
    {
      id: 'verification-readiness',
      title: 'KYC and activity readiness',
      status: verificationItems.length ? 'BOOKING BLOCK' : 'READY',
      detail: verificationItems.length
        ? 'Identity or required document gaps hold Level 2 paid work eligibility and marketplace participation until cleared.'
        : 'KYC, required documents, and partner verification are not blocking listed partners.',
      operatorScript:
        'Review CCCD/CMND and selfie evidence; reject with a specific reupload reason if anything is unclear.',
      customerImpact:
        'Paid work should only be accepted by Partners who passed the Level 2 identity and activity checks.',
      action: verificationItems.length ? 'Open acceptance-blocked Partners' : 'Review Partner levels',
      href: verificationItems.length ? '/partners?review=acceptance-blocked' : '/partners',
      className: verificationItems.length ? 'ops-task-blocked' : 'ops-task-done',
      blockingCount: verificationItems.length,
      partnerSamples: partnerSamples(verificationItems),
      metrics: [
        metric('Blocked', verificationItems.length, verificationItems.length ? 'danger' : 'ok'),
        metric('Work level', 'Level 2 gate', verificationItems.length ? 'danger' : 'ok'),
        metric('Payout', 'Withdrawal review', 'info'),
      ],
    },
    {
      id: 'device-contact',
      title: 'Push/contact readiness',
      status: deviceItems.length ? 'CONTACT CHECK' : 'READY',
      detail: deviceItems.length
        ? 'Partners without an enabled device can miss marketplace invitations and direct booking alerts.'
        : 'Partner device readiness does not show a broad notification follow-up.',
      operatorScript:
        'Confirm the partner has a current app session and enabled device before relying on push alerts.',
      customerImpact:
        'Marketplace supply may look available but fail to respond if the partner cannot receive alerts.',
      action: deviceItems.length ? 'Open app sessions' : 'Review sessions',
      href: '/app-sessions',
      className: deviceItems.length ? 'ops-task-pending' : 'ops-task-done',
      blockingCount: 0,
      partnerSamples: partnerSamples(deviceItems),
      metrics: [
        metric('Contact gaps', deviceItems.length, deviceItems.length ? 'warn' : 'ok'),
        metric('Push', 'Invite check', deviceItems.length ? 'warn' : 'ok'),
        metric('Fallback', 'Manual call', 'info'),
      ],
    },
    {
      id: 'tax-after-first-earning',
      title: 'Optional tax record is not an operating gate',
      status: taxItems.length ? 'OPTIONAL REVIEW' : 'READY',
      detail:
        'Tax profile registration is not required for Vietnam MVP and must not block Level 2 approval, matching, work, payout, or wallet withdrawal.',
      operatorScript:
        'Keep optional tax records read-only unless finance explicitly reviews submitted data for audit history.',
      customerImpact:
        'Customers can book approved Level 2 Partners without extra signup friction.',
      action: taxItems.length ? 'Open tax policy' : 'Review tax rules',
      href: '/tax-policy',
      className: taxItems.length ? 'ops-task-pending' : 'ops-task-done',
      blockingCount: 0,
      partnerSamples: partnerSamples(taxItems),
      metrics: [
        metric('Legacy records', taxItems.length, taxItems.length ? 'info' : 'ok'),
        metric('Acceptance', 'Not blocked', 'ok'),
        metric('Payout', 'Not blocked', 'ok'),
      ],
    },
  ];
}

function buildAcceptanceUnblockPlaybook(
  cards: BookingAcceptanceUnblockCard[],
): AcceptanceUnblockPlaybookStep[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const card = (id: string) => byId.get(id);

  return [
    {
      id: 'playbook-wallet-debt',
      step: '1',
      owner: 'Finance',
      title: 'Clear negative wallet first',
      status: card('wallet-debt')?.status ?? 'UNKNOWN',
      pillClass: card('wallet-debt')?.blockingCount ? 'pill-danger' : 'pill-success',
      detail:
        'Negative wallet is the strongest marketplace gate because cash bookings create unpaid HANDS fee debt.',
      bookingImpact:
        'Keeps marketplace visibility available, but final acceptance, service start, and payout release wait until deposit, admin offset, or earning offset is recorded.',
      payoutImpact:
        'Debt should be visible before payout so finance does not pay a partner while platform fees are unpaid.',
      customerImpact:
        'Customer final choice stays available from eligible participants; fee-debt Partners remain visible but cannot complete final acceptance or service start.',
      action: card('wallet-debt')?.action ?? 'Open settlement queue',
      href: card('wallet-debt')?.href ?? '/cash-settlements',
      blockingCount: card('wallet-debt')?.blockingCount ?? 0,
      partnerSamples: card('wallet-debt')?.partnerSamples ?? [],
    },
    {
      id: 'playbook-account-controls',
      step: '2',
      owner: 'Account ops',
      title: 'Resolve account controls',
      status: card('account-controls')?.status ?? 'UNKNOWN',
      pillClass: card('account-controls')?.blockingCount ? 'pill-danger' : 'pill-success',
      detail:
        'Account blocks and active account controls are deliberate operational controls and should stay above convenience.',
      bookingImpact: 'Blocks partner visibility and work access while the restriction is active.',
      payoutImpact: 'Payout holds should remain until the report or account control has a clean audit outcome.',
      customerImpact: 'Keeps customer bookings away from accounts with unresolved admin holds until documented review is complete.',
      action: card('account-controls')?.action ?? 'Review account blocks',
      href: card('account-controls')?.href ?? '/partner-controls?sanction=ACTIVE',
      blockingCount: card('account-controls')?.blockingCount ?? 0,
      partnerSamples: card('account-controls')?.partnerSamples ?? [],
    },
    {
      id: 'playbook-verification',
      step: '3',
      owner: 'KYC',
      title: 'Approve identity and activity readiness',
      status: card('verification-readiness')?.status ?? 'UNKNOWN',
      pillClass: card('verification-readiness')?.blockingCount ? 'pill-danger' : 'pill-success',
      detail:
        'KYC, required CCCD/selfie documents, partner verification, and service-ready profile are the Level 2 work gate for paid bookings.',
      bookingImpact:
        'Holds preferred direct requests and marketplace participation until identity evidence and activity readiness are approved.',
      payoutImpact: 'Bank approval is handled later when the Partner requests wallet withdrawal.',
      customerImpact: 'Keeps customer-facing booking flow simple while operators verify partner readiness before work access.',
      action: card('verification-readiness')?.action ?? 'Open acceptance-blocked partners',
      href: card('verification-readiness')?.href ?? '/partners?review=acceptance-blocked',
      blockingCount: card('verification-readiness')?.blockingCount ?? 0,
      partnerSamples: card('verification-readiness')?.partnerSamples ?? [],
    },
    {
      id: 'playbook-location',
      step: '4',
      owner: 'Dispatch',
      title: 'Refresh stale partner location',
      status: card('location-dispatch')?.status ?? 'UNKNOWN',
      pillClass: card('location-dispatch')?.blockingCount ? 'pill-danger' : 'pill-warn',
      detail:
        'Location freshness controls distance sorting and marketplace invite quality, but it is often solved by reopening the app.',
      bookingImpact:
        'Can weaken marketplace matching or make customer ETA expectations unreliable.',
      payoutImpact:
        'No direct payout impact, but location evidence may matter for disputes and no-show review.',
      customerImpact: 'Improves nearby partner ordering and reduces wasted waiting time.',
      action: card('location-dispatch')?.action ?? 'Open partner profiles',
      href: card('location-dispatch')?.href ?? '/partners?review=location',
      blockingCount: card('location-dispatch')?.blockingCount ?? 0,
      partnerSamples: card('location-dispatch')?.partnerSamples ?? [],
    },
    {
      id: 'playbook-device-contact',
      step: '5',
      owner: 'Ops',
      title: 'Confirm device and alert reachability',
      status: card('device-contact')?.status ?? 'UNKNOWN',
      pillClass: card('device-contact')?.blockingCount ? 'pill-danger' : 'pill-warn',
      detail:
        'In-app alerts are active now and FCM push is deferred, so recent app sessions and enabled devices matter.',
      bookingImpact:
        'Does not always hard-block acceptance, but weakens response rate and marketplace participation.',
      payoutImpact: 'No direct payout impact.',
      customerImpact: 'Reduces missed partner requests during the 10 minute response window.',
      action: card('device-contact')?.action ?? 'Open app sessions',
      href: card('device-contact')?.href ?? '/app-sessions',
      blockingCount: card('device-contact')?.blockingCount ?? 0,
      partnerSamples: card('device-contact')?.partnerSamples ?? [],
    },
    {
      id: 'playbook-tax',
      step: '6',
      owner: 'Finance',
      title: 'Treat tax as legacy-only review',
      status: card('tax-after-first-earning')?.status ?? 'UNKNOWN',
      pillClass: card('tax-after-first-earning')?.blockingCount ? 'pill-warn' : 'pill-success',
      detail:
        'Vietnam MVP does not require tax profile registration for partner approval, matching, work, payout, or withdrawal.',
      bookingImpact: 'Should not block signup, Level 2 approval, matching, or paid jobs.',
      payoutImpact:
        'Should not block payout or wallet withdrawal; bank details are reviewed during the withdrawal flow.',
      customerImpact: 'Reduces partner onboarding drop-off while finance remains controlled before payout.',
      action: card('tax-after-first-earning')?.action ?? 'Open tax policy',
      href: card('tax-after-first-earning')?.href ?? '/tax-policy',
      blockingCount: card('tax-after-first-earning')?.blockingCount ?? 0,
      partnerSamples: card('tax-after-first-earning')?.partnerSamples ?? [],
    },
  ];
}

function partnerSamples(items: PartnerControlWatchItem[], limit = 3) {
  return items.slice(0, limit).map((item) => adminProviderName(item.provider));
}

function partnerHasDeviceContactGap(provider: AdminProvider) {
  const devices = provider.devices ?? [];
  if (!devices.length) {
    return true;
  }
  return !devices.some((device) => device.enabled && !device.blockedAt);
}

function metric(
  label: string,
  value: ReactNode,
  tone: 'ok' | 'info' | 'warn' | 'danger',
): PartnerControlCommandMetric {
  const toneClass: Record<'ok' | 'info' | 'warn' | 'danger', PartnerControlCommandMetric['tone']> = {
    ok: 'ops-task-breakdown-ok',
    info: 'ops-task-breakdown-info',
    warn: 'ops-task-breakdown-warn',
    danger: 'ops-task-breakdown-danger',
  };

  return {
    label,
    value,
    tone: toneClass[tone],
  };
}

function buildPartnerControlNextActions(input: {
  openReports: AdminProviderReport[];
  activeSanctions: AdminProviderSanction[];
  watchlist: PartnerControlWatchItem[];
}) {
  const actions: PartnerControlNextAction[] = [];

  for (const report of input.openReports) {
    const ageHours = reportAgeHours(report);
    const slaHours = reportSlaHours(report);
    actions.push({
      id: `report-${report.id}`,
      priority: severityPriority(report.severity) + (ageHours >= slaHours ? 30 : 0),
      status: ageHours >= slaHours ? 'OVERDUE' : report.severity,
      title: partnerDisplayText(report.summary),
      detail: `${providerNameOrId(report.providerProfile, report.providerProfileId)} / ${report.category} / ${report.status} / ${ageLabel(ageHours)} old`,
      operatorAction:
        ageHours >= slaHours
          ? `Past ${slaHours}h target. Add resolution note, assign account control, or dismiss with evidence.`
          : 'Review evidence and move to investigating, resolved, dismissed, or account control.',
      href: report.bookingId
        ? `/bookings/${report.bookingId}`
        : `/partner-controls?q=${encodeURIComponent(report.id)}`,
      tags: [
        { label: report.severity, tone: severityPill(report.severity) },
        { label: report.status, tone: statusPill(report.status) },
        { label: `${slaHours}h SLA`, tone: ageHours >= slaHours ? 'pill-danger' : 'pill-info' },
      ],
    });
  }

  for (const item of input.watchlist.filter((watch) => watch.walletBalance < 0)) {
    actions.push({
      id: `wallet-${item.provider.id}`,
      priority: 95 + Math.min(20, Math.abs(item.walletBalance) / 100000),
      status: 'WALLET',
      title: `${adminProviderName(item.provider)} cash fee debt`,
      detail: `${formatMoney(Math.abs(item.walletBalance))} must be settled or offset before final acceptance, service start, or payout release.`,
      operatorAction: `Use ${cashDebtSettlementReference(item.provider.id)} and confirm finance settlement.`,
      href: '/cash-settlements',
      tags: [
        { label: 'Cash debt', tone: 'pill-danger' },
        { label: 'Booking blocked', tone: 'pill-danger' },
      ],
    });
  }

  for (const sanction of input.activeSanctions.slice(0, 12)) {
    actions.push({
      id: `sanction-${sanction.id}`,
      priority: sanction.type === 'ACCOUNT_BLOCK' ? 90 : sanction.type === 'PAYOUT_HOLD' ? 82 : 60,
      status: sanction.type,
      title: `${providerNameOrId(sanction.providerProfile, sanction.providerProfileId)} account control active`,
      detail: partnerDisplayText(sanction.reason),
      operatorAction:
        sanction.type === 'PAYOUT_HOLD'
          ? 'Resolve payout evidence before creating or paying payout batches.'
          : 'Keep or lift the account control only with a clear audit trail.',
      href: `/partner-controls?q=${encodeURIComponent(sanction.providerProfileId)}`,
      tags: [
        { label: sanction.status, tone: 'pill-danger' },
        { label: sanction.type, tone: sanction.type === 'WARNING' ? 'pill-warn' : 'pill-danger' },
      ],
    });
  }

  return actions.sort((left, right) => right.priority - left.priority).slice(0, 10);
}

function emptyPartnerControlMessage(kind: 'report' | 'sanction', activeFilters: Array<{ description: string }>) {
  const subject = kind === 'report' ? 'Partner reports' : 'Partner account controls';
  if (activeFilters.length === 0) {
    return `No ${subject} loaded yet.`;
  }
  return `No ${subject} match the active filters. Clear filters or switch investigation lane.`;
}

function partnerControlPagedListFrom(rowCount: number, activePage: number, pageSize: number) {
  if (rowCount <= 0) return 0;
  return (activePage - 1) * pageSize + 1;
}

function partnerControlPagedListTo(rowCount: number, activePage: number, pageSize: number) {
  if (rowCount <= 0) return 0;
  return partnerControlPagedListFrom(rowCount, activePage, pageSize) + rowCount - 1;
}

function partnerControlPagedListTotalRows(rowCount: number, activePage: number, pageSize: number) {
  if (rowCount <= 0) return 0;
  return partnerControlPagedListTo(rowCount, activePage, pageSize);
}

function partnerControlEstimatedTotalPages(rowCount: number, activePage: number, pageSize: number) {
  return Math.max(1, rowCount >= pageSize ? activePage + 1 : activePage);
}

function filterReports(reports: AdminProviderReport[], filters: PartnerControlPageFilters) {
  return reports.filter((report) => {
    if (filters.status && report.status !== filters.status) return false;
    if (filters.severity === 'HIGH_PLUS' && !['CRITICAL', 'HIGH'].includes(report.severity)) return false;
    if (filters.severity && filters.severity !== 'HIGH_PLUS' && report.severity !== filters.severity) {
      return false;
    }
    if (filters.q && !reportSearchText(report).includes(filters.q)) return false;
    return true;
  });
}

function filterSanctions(sanctions: AdminProviderSanction[], filters: PartnerControlPageFilters) {
  return sanctions.filter((sanction) => {
    if (filters.sanction && sanction.status !== filters.sanction) return false;
    if (filters.q && !sanctionSearchText(sanction).includes(filters.q)) return false;
    return true;
  });
}

function buildPartnerControlSummary(
  reports: AdminProviderReport[],
  sanctions: AdminProviderSanction[],
  providers: AdminProvider[],
  controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY,
) {
  const watchlist = buildPartnerControlWatchlist(providers, controlPolicy);
  return [
    [
      'Open reports',
      reports.filter((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)).length.toString(),
    ],
    [
      'Urgent / major',
      reports.filter((report) => ['CRITICAL', 'HIGH'].includes(report.severity)).length.toString(),
    ],
    ['Active controls', sanctions.filter((sanction) => sanction.status === 'ACTIVE').length.toString()],
    ['Blocked accounts', providers.filter((provider) => provider.blockedAt).length.toString()],
    ['Wallet debt', watchlist.filter((item) => item.walletBalance < 0).length.toString()],
    [
      'Location gaps',
      providers.filter((provider) => Boolean(providerLocationSignal(provider, controlPolicy))).length.toString(),
    ],
    [
      'Shared devices',
      watchlist.filter((item) => item.signals.some((signal) => signal.kind === 'DEVICE')).length.toString(),
    ],
    [
      'Onboarding gaps',
      watchlist
        .filter((item) => item.signals.some((signal) => ['KYC', 'BANK', 'TAX'].includes(signal.kind)))
        .length.toString(),
    ],
  ] as const;
}

type PartnerControlWatchItem = {
  provider: AdminProvider;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  signals: Array<{ kind: string; label: string }>;
  walletBalance: number;
  openReportCount: number;
  hasPayoutHold: boolean;
  detail: string;
  nextStep: string;
};

function buildPartnerControlWatchlist(
  providers: AdminProvider[],
  controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY,
): PartnerControlWatchItem[] {
  const deviceUsage = buildDeviceUsage(providers);
  return providers
    .map((provider) => buildPartnerControlWatchItem(provider, deviceUsage, controlPolicy))
    .filter((item): item is PartnerControlWatchItem => Boolean(item))
    .sort((left, right) => watchSeverityRank(right.severity) - watchSeverityRank(left.severity));
}

function filterPartnerControlWatchlist(
  watchlist: PartnerControlWatchItem[],
  filters: PartnerControlPageFilters,
) {
  if (isPartnerControlCashDebtReview(filters)) {
    return watchlist.filter((item) => item.walletBalance < 0);
  }
  return watchlist;
}

function buildPartnerControlWatchItem(
  provider: AdminProvider,
  deviceUsage: Map<string, Set<string>>,
  controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY,
): PartnerControlWatchItem | null {
  const walletBalance = providerUnsettledWalletBalance(provider);
  const openReportCount = (provider.reports ?? []).filter((report) =>
    ['OPEN', 'INVESTIGATING'].includes(report.status),
  ).length;
  const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const hasPayoutHold = activeSanctions.some((sanction) => sanction.type === 'PAYOUT_HOLD');
  const sharedDeviceCount = providerSharedDeviceCount(provider, deviceUsage);
  const signals: PartnerControlWatchItem['signals'] = [];

  if (provider.blockedAt) signals.push({ kind: 'BLOCK', label: 'Account blocked' });
  if (walletBalance < 0) signals.push({ kind: 'WALLET', label: 'Negative wallet' });
  if (hasPayoutHold) signals.push({ kind: 'PAYOUT', label: 'Payout hold' });
  if (openReportCount > 0) signals.push({ kind: 'REPORT', label: `${openReportCount} open report(s)` });
  if (sharedDeviceCount > 0) signals.push({ kind: 'DEVICE', label: `${sharedDeviceCount} shared device(s)` });
  const locationSignal = providerLocationSignal(provider, controlPolicy);
  if (locationSignal) {
    signals.push({ kind: 'LOCATION', label: locationSignal });
  }
  if (!provider.kyc || provider.kyc.status !== 'APPROVED')
    signals.push({ kind: 'KYC', label: 'KYC not approved' });
  if (!(provider.bankAccounts ?? []).some((account) => account.status === 'APPROVED')) {
    signals.push({ kind: 'BANK', label: 'Bank not approved' });
  }
  if (!provider.taxProfile || provider.taxProfile.status !== 'APPROVED') {
    signals.push({ kind: 'TAX', label: 'Tax not approved' });
  }

  if (!signals.length) return null;

  const severity =
    provider.blockedAt || walletBalance < 0 || hasPayoutHold
      ? 'CRITICAL'
      : openReportCount > 0 || sharedDeviceCount > 0
        ? 'HIGH'
        : ['KYC', 'BANK', 'LOCATION'].some((kind) => signals.some((signal) => signal.kind === kind))
          ? 'MEDIUM'
          : 'LOW';

  return {
    provider,
    severity,
    signals,
    walletBalance,
    openReportCount,
    hasPayoutHold,
    detail: partnerControlDetail({ walletBalance, openReportCount, sharedDeviceCount, signals }),
    nextStep: partnerControlNextStep({ walletBalance, hasPayoutHold, openReportCount, provider }, controlPolicy),
  };
}

function partnerControlDetail(input: {
  walletBalance: number;
  openReportCount: number;
  sharedDeviceCount: number;
  signals: Array<{ kind: string }>;
}) {
  if (input.walletBalance < 0) {
    return 'Partner can remain visible, but final cash/direct work gates wait until company fee debt is settled.';
  }
  if (input.openReportCount > 0) {
    return 'Open report history needs operator review before profile review, payout, or account changes.';
  }
  if (input.sharedDeviceCount > 0) {
    return 'Device overlap can indicate duplicate accounts or account sharing.';
  }
  if (input.signals.some((signal) => signal.kind === 'TAX')) {
    return 'Tax information can stay pending until first earning, but payout must remain gated.';
  }
  if (input.signals.some((signal) => signal.kind === 'LOCATION')) {
    return 'Online partner location is missing or stale, so dispatch distance and customer expectation can be wrong.';
  }
  return 'Partner has onboarding or compliance gaps that need staff follow-up.';
}

function partnerControlNextStep(
  input: {
    walletBalance: number;
    hasPayoutHold: boolean;
    openReportCount: number;
    provider: AdminProvider;
  },
  controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY,
) {
  if (input.walletBalance < 0) {
    return `Confirm Partner deposit or admin offset using ${cashDebtSettlementReference(input.provider.id)}.`;
  }
  if (input.hasPayoutHold) {
    return 'Resolve payout hold evidence before creating or paying payout batches.';
  }
  if (input.openReportCount > 0) {
    return 'Update report status with resolution note or apply an account control if needed.';
  }
  if (providerLocationSignal(input.provider, controlPolicy)) {
    return 'Ask the Partner to reopen the app and refresh their current location before dispatch-sensitive work.';
  }
  return 'Complete missing verification data before enabling additional profile review or payout features.';
}

function providerLocationSignal(provider: AdminProvider, controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY) {
  if (!provider.status.startsWith('ONLINE')) {
    return null;
  }
  if (
    provider.currentLat === null ||
    provider.currentLat === undefined ||
    provider.currentLng === null ||
    provider.currentLng === undefined
  ) {
    return 'Online location missing';
  }
  if (!provider.currentLocationUpdatedAt) {
    return 'Location timestamp missing';
  }

  const updatedAt = Date.parse(provider.currentLocationUpdatedAt);
  if (!Number.isFinite(updatedAt)) {
    return 'Location timestamp invalid';
  }
  return Date.now() - updatedAt > controlPolicy.locationFreshnessMinutes * 60_000
    ? `Location older than ${controlPolicy.locationFreshnessMinutes}m`
    : null;
}

function buildPartnerControlPolicy(settings: AdminOperationalPolicySetting[]): PartnerControlPolicy {
  return {
    responseWindowMinutes:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
      DEFAULT_PARTNER_CONTROL_POLICY.responseWindowMinutes,
    backupRadiusMeters:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
      DEFAULT_PARTNER_CONTROL_POLICY.backupRadiusMeters,
    invitationLimit:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit) ??
      DEFAULT_PARTNER_CONTROL_POLICY.invitationLimit,
    locationFreshnessMinutes:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
      DEFAULT_PARTNER_CONTROL_POLICY.locationFreshnessMinutes,
  };
}

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)}km`;
  }
  return `${meters}m`;
}

function buildDeviceUsage(providers: AdminProvider[]) {
  const usage = new Map<string, Set<string>>();
  for (const provider of providers) {
    for (const device of provider.devices ?? []) {
      if (!device.deviceId) continue;
      const set = usage.get(device.deviceId) ?? new Set<string>();
      set.add(provider.id);
      usage.set(device.deviceId, set);
    }
  }
  return usage;
}

function providerSharedDeviceCount(provider: AdminProvider, deviceUsage: Map<string, Set<string>>) {
  return (provider.devices ?? []).filter((device) => {
    const providers = deviceUsage.get(device.deviceId);
    return providers && providers.size > 1;
  }).length;
}

function providerUnsettledWalletBalance(provider: AdminProvider) {
  return (provider.earnings ?? [])
    .filter((earning) => ['PENDING', 'AVAILABLE'].includes(earning.status))
    .reduce((sum, earning) => sum + Number(earning.netAmount ?? 0), 0);
}

function adminProviderName(provider: AdminProvider) {
  return partnerDisplayText(provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id);
}

function watchSeverityRank(severity: PartnerControlWatchItem['severity']) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[severity] ?? 0;
}

function watchSeverityPill(severity: PartnerControlWatchItem['severity']) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'pill-danger';
  if (severity === 'MEDIUM') return 'pill-warn';
  return 'pill-neutral';
}

function watchSignalPill(kind: string) {
  if (['BLOCK', 'WALLET', 'PAYOUT'].includes(kind)) return 'pill-danger';
  if (['REPORT', 'DEVICE', 'LOCATION', 'KYC', 'BANK'].includes(kind)) return 'pill-warn';
  return 'pill-neutral';
}

function cashDebtSettlementReference(providerProfileId: string) {
  return `HANDS-WALLET-${providerProfileId.slice(-8).toUpperCase()}`;
}

function reportSearchText(report: AdminProviderReport) {
  return [
    report.id,
    report.category,
    report.summary,
    report.details,
    report.providerProfile?.displayName,
    report.providerProfile?.user?.phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function sanctionSearchText(sanction: AdminProviderSanction) {
  return [
    sanction.id,
    sanction.type,
    sanction.reason,
    sanction.report?.summary,
    sanction.providerProfile?.displayName,
    sanction.providerProfile?.user?.phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function providerNameOrId(
  provider:
    | AdminProviderReport['providerProfile']
    | AdminProviderSanction['providerProfile']
    | null
    | undefined,
  fallbackId: string,
) {
  return partnerDisplayText(provider?.displayName || provider?.user?.fullName || provider?.user?.phone || fallbackId);
}

function reportAgeHours(report: AdminProviderReport) {
  const createdAt = Date.parse(report.createdAt);
  if (Number.isNaN(createdAt)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - createdAt) / 3_600_000));
}

function reportSlaHours(report: AdminProviderReport) {
  if (report.severity === 'CRITICAL') return 2;
  if (report.severity === 'HIGH') return 8;
  if (report.severity === 'MEDIUM') return 24;
  return 72;
}

function oldestReportAgeLabel(reports: AdminProviderReport[]) {
  if (!reports.length) {
    return '0h';
  }
  return ageLabel(Math.max(...reports.map(reportAgeHours)));
}

function ageLabel(hours: number) {
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
}

function severityPriority(severity: string) {
  if (severity === 'CRITICAL') return 100;
  if (severity === 'HIGH') return 80;
  if (severity === 'MEDIUM') return 50;
  return 25;
}

function severityPill(severity: string) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'pill-danger';
  if (severity === 'MEDIUM') return 'pill-warn';
  return 'pill-neutral';
}

function statusPill(status: string) {
  if (status === 'RESOLVED' || status === 'DISMISSED') return 'pill-success';
  if (status === 'INVESTIGATING') return 'pill-warn';
  return 'pill-info';
}

function PartnerControlDateText({ value }: { readonly value?: string | null }) {
  return <DateTimeText fallback={value ? 'Invalid' : 'None'} value={value} />;
}
