import { Plus, RefreshCw } from 'lucide-react';
import {
  type AdminPartnerControlProviderPage,
  type AdminProvider,
  type AdminProviderReport,
  type AdminProviderReportAuditHistory,
  type AdminProviderReportPage,
  type AdminProviderSanction,
  type AdminProviderSanctionPage,
  adminGetResult,
} from '../../lib/admin-api';
import { shortDisplayId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import { AdminDataTable, AdminTablePaginationFooter } from '../../components/admin-data-table';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import {
  AdminFormActionRow,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDateTime,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import {
  AdminBasicTimeline,
  AdminDisclosure,
  AdminDisclosureCard,
  AdminNoticeCard,
  AdminSection,
} from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import {
  applyPartnerControlFilters,
  createProviderReportWithState,
  createProviderSanctionWithState,
  liftProviderSanction,
  updateProviderReportWithState,
} from './actions';
import {
  buildPartnerControlDeskActionConfirmation,
  partnerControlDeskActionConfirmHref,
  readPartnerControlDeskConfirmationAction,
  type PartnerControlDeskConfirmationAction,
} from './partner-control-desk-action-confirmation';
import {
  buildPartnerControlActiveFilters,
  buildPartnerControlFilters,
  partnerControlListHref,
} from './partner-control-page-filters';
import {
  buildPartnerControlPageLoadPlan,
  partnerControlHref,
  partnerControlNewReportHref,
  partnerControlReportReviewHref,
  type PartnerControlDetailsMode,
} from './partner-control-page-load-plan';
import { buildPartnerControlPageMetrics } from './partner-control-page-metrics';
import {
  buildPartnerControlSummaryFromServer,
  type PartnerControlSummaryResponse,
} from './partner-control-summary';
import { partnerControlImpact, type PartnerControlBlockerKind } from './partner-control-policy';
import { PartnerControlActionForm, PartnerControlRestrictionForm } from './partner-control-restriction-form';

type PartnerControlsSearchParams = Promise<Record<string, string | string[] | undefined>>;

const EMPTY_PROVIDER_PAGE: AdminPartnerControlProviderPage = { items: [], skip: 0, take: 10, totalCount: 0 };
const EMPTY_REPORT_PAGE: AdminProviderReportPage = { items: [], skip: 0, take: 10, totalCount: 0 };
const EMPTY_REPORT_AUDIT_HISTORY: AdminProviderReportAuditHistory = { items: [] };
const EMPTY_SANCTION_PAGE: AdminProviderSanctionPage = { items: [], skip: 0, take: 10, totalCount: 0 };

const REPORT_CATEGORIES = [
  ['SAFETY', 'Safety'],
  ['BEHAVIOR', 'Behavior'],
  ['IDENTITY', 'Identity'],
  ['PAYMENT', 'Payment'],
  ['SERVICE_QUALITY', 'Service quality'],
  ['OTHER', 'Other'],
] as const;

export default async function PartnerControlsPage({
  searchParams,
}: {
  searchParams?: PartnerControlsSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const filters = buildPartnerControlFilters(params);
  const loadPlan = buildPartnerControlPageLoadPlan(params);
  const [
    summaryResult,
    providerResult,
    reportResult,
    directReportResult,
    reportAuditResult,
    sanctionResult,
    partnerSearchResult,
  ] = await Promise.all([
    loadPlan.summaryHref
      ? adminGetResult<PartnerControlSummaryResponse | null>(loadPlan.summaryHref, null)
      : Promise.resolve({ data: null, ok: true, status: 200 }),
    loadPlan.providersHref
      ? adminGetResult<AdminPartnerControlProviderPage>(loadPlan.providersHref, EMPTY_PROVIDER_PAGE)
      : Promise.resolve({ data: EMPTY_PROVIDER_PAGE, ok: true, status: 200 }),
    loadPlan.reportsHref
      ? adminGetResult<AdminProviderReportPage>(loadPlan.reportsHref, EMPTY_REPORT_PAGE)
      : Promise.resolve({ data: EMPTY_REPORT_PAGE, ok: true, status: 200 }),
    loadPlan.reportHref
      ? adminGetResult<AdminProviderReport | null>(loadPlan.reportHref, null)
      : Promise.resolve({ data: null, ok: true, status: 200 }),
    loadPlan.reportAuditHref
      ? adminGetResult<AdminProviderReportAuditHistory>(loadPlan.reportAuditHref, EMPTY_REPORT_AUDIT_HISTORY)
      : Promise.resolve({ data: EMPTY_REPORT_AUDIT_HISTORY, ok: true, status: 200 }),
    loadPlan.sanctionsHref
      ? adminGetResult<AdminProviderSanctionPage>(loadPlan.sanctionsHref, EMPTY_SANCTION_PAGE)
      : Promise.resolve({ data: EMPTY_SANCTION_PAGE, ok: true, status: 200 }),
    loadPlan.partnerSearchHref
      ? adminGetResult<AdminPartnerControlProviderPage>(loadPlan.partnerSearchHref, EMPTY_PROVIDER_PAGE)
      : Promise.resolve({ data: EMPTY_PROVIDER_PAGE, ok: true, status: 200 }),
  ]);
  const summary = buildPartnerControlSummaryFromServer(summaryResult.data) ?? [
    ['Reports needing review', 'Unavailable'],
    ['Active restrictions', 'Unavailable'],
    ['Debt gates', 'Unavailable'],
    ['Overdue', 'Unavailable'],
  ];
  const pageMetrics = buildPartnerControlPageMetrics(summary, summaryResult.data?.generatedAt, {
    overdue: summaryResult.data?.overdueReports,
    urgent: summaryResult.data?.urgentMajorReports,
  });
  const controlConfirmation = buildPartnerControlDeskActionConfirmation(
    sanctionResult.data.items,
    readPartnerControlDeskConfirmationAction(readSearchParam(params.controlAction)),
    readSearchParam(params.sanctionId),
    filters,
  );
  const activeFilters = buildPartnerControlActiveFilters(filters).map((filter) => filter.label);
  const selectedReport = directReportResult.data;
  const creatingReport = readSearchParam(params.newReport) === '1' && !loadPlan.reportHref;
  const pageTitle = partnerControlPageTitle(loadPlan.detailsMode);

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
          id={`partner-control-action-${controlConfirmation.sanctionId}`}
          textInputs={controlConfirmation.textInputs}
          title={controlConfirmation.title}
          tone={controlConfirmation.tone}
        />
      ) : null}
      <AdminPageTemplate
        actions={
          <div className="actions">
            {summaryResult.data?.generatedAt ? (
              <span className="muted">
                Updated <DateTimeText value={summaryResult.data.generatedAt} />
              </span>
            ) : null}
            <AdminFormControlLink href={partnerControlHref(params, {})}>
              <RefreshCw aria-hidden="true" size={16} /> Refresh now
            </AdminFormControlLink>
          </div>
        }
        contentClassName="partner-controls-page"
        description="Prioritized Partner reports, operating blockers, and account restrictions with exact server totals."
        metrics={loadPlan.shouldRenderSummary ? pageMetrics : []}
        metricsClassName="partner-control-summary-metrics"
        title={pageTitle}
      >
        <PartnerControlLoadNotice
          mode={loadPlan.detailsMode}
          ok={partnerControlLoadOk(loadPlan.detailsMode, {
            partnerSearch: !loadPlan.partnerSearchHref || partnerSearchResult.ok,
            providers: !loadPlan.providersHref || providerResult.ok,
            reports: !loadPlan.reportsHref || reportResult.ok,
            sanctions: !loadPlan.sanctionsHref || sanctionResult.ok,
            summary: !loadPlan.summaryHref || summaryResult.ok,
          })}
        />
        <PartnerControlActionNotice value={readSearchParam(params.notice)} />

        {loadPlan.shouldRenderSummary ? (
          <>
            <AdminSection
              className="admin-mb-16"
              description={`One highest-impact blocker per Partner. Showing ${providerResult.data.items.length} of ${providerResult.data.totalCount}, ordered by operating impact, then age.`}
              id="partner-control-priority-queue"
              statusLabel={priorityCountLabel(providerResult.data.totalCount)}
              statusTone={providerResult.data.totalCount ? 'warning' : 'success'}
              title="Priority queue"
            >
              <PartnerBlockerTable providers={providerResult.data.items} />
              <PartnerQueueFooter
                itemLabel="Partners"
                page={providerResult.data}
                params={params}
                pageParam="blockerPage"
              />
            </AdminSection>
            <AdminSection
              className="admin-mb-16 partner-control-health-signals"
              description="Secondary health signals do not override the operating impact shown in the priority queue. Optional tax records are never an operating gate."
              id="partner-control-health-signals"
              title="Health signals"
            >
              <AdminFilterChipGroup ariaLabel="Partner health signals">
                <AdminTextLink href="/partner-controls?details=controls&review=location">
                  Location gaps {summaryResult.data?.locationGaps ?? 'Unavailable'}
                </AdminTextLink>
                <AdminTextLink href="/partner-controls?details=controls&review=kyc">
                  KYC readiness gaps {summaryResult.data?.kycGaps ?? 'Unavailable'}
                </AdminTextLink>
                <AdminTextLink href="/partner-controls?details=controls&review=bank">
                  Bank approval gaps {summaryResult.data?.bankGaps ?? 'Unavailable'}
                </AdminTextLink>
              </AdminFilterChipGroup>
              <p className="muted admin-mt-8">
                A Partner can appear in both lane totals. Optional tax records are context only and never an
                operating gate.
              </p>
            </AdminSection>
          </>
        ) : null}

        {loadPlan.shouldRenderPartnerBlockers ? (
          <>
            <PartnerBlockerFilters filters={filters} />
            <AdminSection
              className="admin-mb-16"
              description={`${providerResult.data.items.length} of ${providerResult.data.totalCount} Partners in the server-filtered queue.`}
              id="partner-control-blockers"
              statusLabel={priorityCountLabel(providerResult.data.totalCount)}
              statusTone={providerResult.data.totalCount ? 'warning' : 'success'}
              title="Partner blockers"
            >
              <PartnerBlockerTable providers={providerResult.data.items} />
              <PartnerQueueFooter
                itemLabel="Partners"
                page={providerResult.data}
                params={params}
                pageParam="blockerPage"
              />
            </AdminSection>
          </>
        ) : null}

        {loadPlan.shouldRenderReports ? (
          <>
            <ReportFilters
              activeFilters={activeFilters}
              filters={filters}
              newReportHref={partnerControlNewReportHref(params)}
            />
            {creatingReport ? (
              <NewPartnerReportPanel
                partnerOptions={partnerSearchResult.data.items}
                partnerQ={readSearchParam(params.partnerQ)}
              />
            ) : null}
            {loadPlan.reportHref && (!directReportResult.ok || !selectedReport) ? (
              <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
                This report could not be loaded directly. Return to the report queue and retry before making a
                decision.
              </AdminNoticeCard>
            ) : null}
            {selectedReport ? (
              <ReportReviewPanel
                auditHistory={reportAuditResult.data}
                auditHistoryOk={reportAuditResult.ok}
                params={params}
                report={selectedReport}
              />
            ) : null}
            <AdminSection
              className="admin-mb-16"
              description={`${reportResult.data.items.length} of ${reportResult.data.totalCount} reports match the server filters.`}
              id="partner-control-reports"
              statusLabel={`${reportResult.data.totalCount} report${reportResult.data.totalCount === 1 ? '' : 's'}`}
              statusTone={reportResult.data.totalCount ? 'warning' : 'success'}
              title={reportQueueTitle(params)}
            >
              <ReportTable params={params} reports={reportResult.data.items} />
              <PartnerQueueFooter
                itemLabel="reports"
                page={reportResult.data}
                params={params}
                pageParam="reportPage"
              />
            </AdminSection>
          </>
        ) : null}

        {loadPlan.shouldRenderAccountControls ? (
          <>
            <RestrictionFilters filters={filters} params={params} />
            <AdminSection
              className="admin-mb-16"
              description={
                filters.sanction === 'HISTORY'
                  ? `${sanctionResult.data.items.length} of ${sanctionResult.data.totalCount} lifted or expired restrictions. Legacy records may not contain a lift reason.`
                  : `${sanctionResult.data.items.length} of ${sanctionResult.data.totalCount} active restrictions.`
              }
              id="partner-control-account-controls"
              statusLabel={`${sanctionResult.data.totalCount} ${filters.sanction === 'HISTORY' ? 'history' : 'active'}`}
              statusTone={
                filters.sanction !== 'HISTORY' && sanctionResult.data.totalCount ? 'warning' : 'success'
              }
              title={filters.sanction === 'HISTORY' ? 'Restriction history' : 'Active restrictions'}
            >
              <RestrictionTable params={params} sanctions={sanctionResult.data.items} />
              <PartnerQueueFooter
                itemLabel="restrictions"
                page={sanctionResult.data}
                params={params}
                pageParam="sanctionPage"
              />
            </AdminSection>
          </>
        ) : null}
      </AdminPageTemplate>
    </>
  );
}

function partnerControlPageTitle(mode: PartnerControlDetailsMode) {
  if (mode === 'controls') return 'Partner Blockers';
  if (mode === 'reports') return 'Reports';
  if (mode === 'sanctions') return 'Account Controls';
  return 'Action Queue';
}

function PartnerControlLoadNotice({
  mode,
  ok,
}: {
  readonly mode: PartnerControlDetailsMode;
  readonly ok: boolean;
}) {
  if (ok) return null;
  return (
    <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
      {mode === 'summary'
        ? 'Partner control totals or priority rows could not be loaded. Retry before using this workspace for operating decisions.'
        : 'This Partner control queue could not be loaded. Retry before treating the result as empty.'}
    </AdminNoticeCard>
  );
}

function partnerControlLoadOk(
  mode: PartnerControlDetailsMode,
  result: {
    readonly partnerSearch: boolean;
    readonly providers: boolean;
    readonly reports: boolean;
    readonly sanctions: boolean;
    readonly summary: boolean;
  },
) {
  if (mode === 'summary') return result.summary && result.providers;
  if (mode === 'controls') return result.providers;
  if (mode === 'reports') return result.reports && result.partnerSearch;
  return result.sanctions;
}

function PartnerControlActionNotice({ value }: { readonly value: string }) {
  if (!value) return null;
  const failed = value.endsWith('-failed');
  return (
    <AdminNoticeCard
      className="admin-mb-16"
      role={failed ? 'alert' : 'status'}
      tone={failed ? 'danger' : 'success'}
    >
      {failed
        ? 'The change was not saved. Review the form and try again.'
        : 'Partner control changes were saved.'}
    </AdminNoticeCard>
  );
}

function PartnerBlockerFilters({
  filters,
}: {
  readonly filters: ReturnType<typeof buildPartnerControlFilters>;
}) {
  return (
    <AdminFilterPanel
      className="admin-mb-16"
      description="Search the full Partner population and rank matching blockers on the server."
      id="partner-control-blocker-filters"
      title="Filter this queue"
    >
      <AdminFormGrid action={applyPartnerControlFilters} className="partner-control-filter-grid">
        <input name="details" type="hidden" value="controls" />
        <AdminFormSearch
          defaultValue={filters.q}
          label="Search Partners"
          name="q"
          placeholder="Name, phone, or Partner ID"
        />
        <AdminFormSelect
          defaultValue={filters.review || 'attention'}
          label="Blocking reason"
          labelVisibility="visible"
          name="review"
          options={[
            { label: 'All priority blockers', value: 'attention' },
            { label: 'Account blocks', value: 'account-block' },
            { label: 'Negative wallet', value: 'cash-debt' },
            { label: 'Payout holds', value: 'payout-hold' },
            { label: 'Open reports', value: 'report' },
            { label: 'KYC readiness', value: 'kyc' },
            { label: 'Bank approval', value: 'bank' },
            { label: 'Stale location', value: 'location' },
          ]}
        />
        <AdminFormSelect
          defaultValue={filters.sort || 'priority'}
          label="Sort"
          labelVisibility="visible"
          name="sort"
          options={[
            { label: 'Highest priority', value: 'priority' },
            { label: 'Oldest first', value: 'oldest' },
            { label: 'Newest first', value: 'newest' },
          ]}
        />
        <AdminFormActionRow wide={false}>
          <AdminFormControlButton type="submit">Apply filters</AdminFormControlButton>
          <AdminFormControlLink href="/partner-controls?details=controls">Reset</AdminFormControlLink>
        </AdminFormActionRow>
      </AdminFormGrid>
    </AdminFilterPanel>
  );
}

function PartnerBlockerTable({ providers }: { readonly providers: AdminProvider[] }) {
  return (
    <AdminDataTable
      className="partner-control-table partner-control-blocker-table"
      emptyMessage="No Partners match the current server filters."
      headers={[
        'Impact tier',
        'Partner',
        'Blocking reason',
        'Actual impact',
        'Age / SLA',
        'Next owner / action',
      ]}
      rowCount={providers.length}
    >
      {providers.map((provider) => {
        const risk = provider.controlRisk;
        if (!risk) return null;
        const policy = partnerControlImpact(risk.kind);
        return (
          <tr key={provider.id}>
            <td data-label="Impact tier">
              <StatusBadge tone={policy.tone}>{impactTierLabel(risk.kind, risk.priority)}</StatusBadge>
            </td>
            <td data-label="Partner">
              <PartnerIdentity provider={provider} />
            </td>
            <td data-label="Blocking reason">
              <strong>{policy.reason}</strong>
              {risk.kind === 'NEGATIVE_WALLET' ? (
                <p className="muted">
                  Current wallet: <MoneyText amount={provider.activitySummary?.walletBalance ?? 0} />
                </p>
              ) : null}
              <AdminDisclosure className="partner-control-row-disclosure">
                <summary>Policy and evidence</summary>
                <p>{policy.detail}</p>
              </AdminDisclosure>
            </td>
            <td data-label="Actual impact">
              <AdminFilterChipGroup ariaLabel={`${policy.reason} impact`}>
                {policy.impacts.map((impact) => (
                  <StatusBadge key={impact} tone={policy.tone}>
                    {impact}
                  </StatusBadge>
                ))}
              </AdminFilterChipGroup>
            </td>
            <td data-label="Age / SLA">
              {riskAgeLabel(risk.kind, risk.startedAt, risk.slaHours, risk.overdue)}
            </td>
            <td data-label="Next owner / action">
              <strong>{risk.ownerLabel}</strong>
              <br />
              <AdminTextLink href={partnerBlockerActionHref(provider, risk.kind)}>
                {risk.nextActionLabel}
              </AdminTextLink>
            </td>
          </tr>
        );
      })}
    </AdminDataTable>
  );
}

function ReportFilters({
  activeFilters,
  filters,
  newReportHref,
}: {
  readonly activeFilters: string[];
  readonly filters: ReturnType<typeof buildPartnerControlFilters>;
  readonly newReportHref: string;
}) {
  return (
    <AdminFilterPanel
      actions={
        <div className="actions">
          <AdminFormControlLink href="/partner-controls?details=reports&status=RESOLVED">
            View resolved
          </AdminFormControlLink>
          <AdminFormControlLink className="button-primary" href={newReportHref}>
            <Plus aria-hidden="true" size={16} /> New report
          </AdminFormControlLink>
        </div>
      }
      className="admin-mb-16"
      description="Filters run against every Partner report before pagination."
      id="partner-control-filters"
      title="Filter reports"
    >
      <AdminFormGrid action={applyPartnerControlFilters} className="partner-control-filter-grid">
        <input name="details" type="hidden" value="reports" />
        <AdminFormSearch
          defaultValue={filters.q}
          label="Search reports"
          name="q"
          placeholder="Partner, phone, report ID, or text"
        />
        <AdminFormSelect
          defaultValue={filters.status}
          label="Status"
          labelVisibility="visible"
          name="status"
          options={[
            { label: 'Needs review · Open + Investigating', value: '' },
            { label: 'Open', value: 'OPEN' },
            { label: 'Investigating', value: 'INVESTIGATING' },
            { label: 'Resolved', value: 'RESOLVED' },
            { label: 'Dismissed', value: 'DISMISSED' },
          ]}
        />
        <AdminFormSelect
          defaultValue={filters.severity}
          label="Severity"
          labelVisibility="visible"
          name="severity"
          options={[
            { label: 'All severities', value: '' },
            { label: 'Critical + high', value: 'HIGH_PLUS' },
            { label: 'Critical', value: 'CRITICAL' },
            { label: 'High', value: 'HIGH' },
            { label: 'Medium', value: 'MEDIUM' },
            { label: 'Low', value: 'LOW' },
          ]}
        />
        <AdminFormSelect
          defaultValue={filters.sort || 'priority'}
          label="Sort"
          labelVisibility="visible"
          name="sort"
          options={[
            { label: 'Priority and age', value: 'priority' },
            { label: 'Oldest first', value: 'oldest' },
            { label: 'Newest first', value: 'newest' },
          ]}
        />
        <AdminFormActionRow wide={false}>
          <AdminFormControlButton type="submit">Apply filters</AdminFormControlButton>
          <AdminFormControlLink href="/partner-controls?details=reports">Reset</AdminFormControlLink>
        </AdminFormActionRow>
        <AdminFilterSummary
          ariaLabel="Active partner control filters"
          className="full-span"
          labels={activeFilters}
        />
      </AdminFormGrid>
    </AdminFilterPanel>
  );
}

function NewPartnerReportPanel({
  partnerOptions,
  partnerQ,
}: {
  readonly partnerOptions: AdminProvider[];
  readonly partnerQ: string;
}) {
  const returnTo = '/partner-controls?details=reports';
  return (
    <AdminDisclosureCard
      className="admin-mb-16 partner-control-editor"
      id="partner-control-create-report"
      open
    >
      <summary>New Partner report</summary>
      <div className="partner-control-editor-body">
        <AdminFormGrid action={applyPartnerControlFilters} className="partner-control-filter-grid">
          <input name="details" type="hidden" value="reports" />
          <input name="newReport" type="hidden" value="1" />
          <AdminFormSearch
            defaultValue={partnerQ}
            label="Find Partner"
            name="partnerQ"
            placeholder="Name, phone, or Partner ID"
          />
          <AdminFormActionRow wide={false}>
            <AdminFormControlButton type="submit">Find Partner</AdminFormControlButton>
            <AdminFormControlLink href="/partner-controls?details=reports">Cancel</AdminFormControlLink>
          </AdminFormActionRow>
        </AdminFormGrid>
        <p className="muted admin-mt-8">
          Up to 20 Partners are listed alphabetically. Search by name, phone, or Partner ID to narrow the
          selection before creating a report.
        </p>
        <p className="muted admin-mt-16">
          Record the observed event in Summary. Use Details for the evidence an operator should verify.
        </p>
        <PartnerControlActionForm action={createProviderReportWithState} className="admin-mt-16">
          <input name="returnTo" type="hidden" value={returnTo} />
          <AdminFormSelect
            label="Partner"
            labelVisibility="visible"
            name="providerProfileId"
            options={[
              { label: partnerQ ? 'Select a matching Partner' : 'Select a Partner or search', value: '' },
              ...partnerOptions.map((provider) => ({
                label: partnerOptionLabel(provider),
                value: provider.id,
              })),
            ]}
            required
          />
          <AdminFormSelect
            label="Category"
            labelVisibility="visible"
            name="category"
            options={[
              { label: 'Select category', value: '' },
              ...REPORT_CATEGORIES.map(([value, label]) => ({ label, value })),
            ]}
            required
          />
          <AdminFormSelect
            label="Severity"
            labelVisibility="visible"
            name="severity"
            options={[
              { label: 'Select severity', value: '' },
              ...['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({ label: value, value })),
            ]}
            required
          />
          <AdminFormInput
            label="Booking ID (optional)"
            labelVisibility="visible"
            name="bookingId"
            placeholder="Linked booking ID"
          />
          <AdminFormInput
            className="admin-grid-span-2"
            label="Summary · Required · one-line incident description"
            labelVisibility="visible"
            maxLength={180}
            name="summary"
            required
          />
          <AdminFormTextarea
            className="admin-grid-span-2"
            label="Details · Evidence and context for the next operator"
            labelVisibility="visible"
            maxLength={2000}
            name="details"
          />
          <AdminFormActionRow>
            <AdminFormControlButton type="submit">Create report</AdminFormControlButton>
          </AdminFormActionRow>
        </PartnerControlActionForm>
      </div>
    </AdminDisclosureCard>
  );
}

function ReportTable({
  params,
  reports,
}: {
  readonly params: Record<string, string | string[] | undefined>;
  readonly reports: AdminProviderReport[];
}) {
  return (
    <AdminDataTable
      className="partner-control-table partner-control-report-table"
      emptyMessage={reportEmptyMessage(params)}
      headers={['Report', 'Partner', 'Severity / status', 'Owner', 'Age / SLA', 'Last update', 'Review']}
      rowCount={reports.length}
    >
      {reports.map((report) => (
        <tr key={report.id}>
          <td data-label="Report">
            <strong>{report.summary}</strong>
            <p className="muted">
              {report.category} · {shortDisplayId(report.id)}
            </p>
          </td>
          <td data-label="Partner">
            <LinkedPartnerIdentity provider={report.providerProfile} providerId={report.providerProfileId} />
          </td>
          <td data-label="Severity / status">
            <AdminFilterChipGroup>
              <StatusBadge tone={reportSeverityTone(report.severity)}>{report.severity}</StatusBadge>
              <StatusBadge tone={reportStatusTone(report.status)}>{report.status}</StatusBadge>
            </AdminFilterChipGroup>
          </td>
          <td data-label="Owner">{operatorLabel(report.assignedAdmin)}</td>
          <td data-label="Age / SLA">
            <ReportAgeSla report={report} />
          </td>
          <td data-label="Last update">
            <DateTimeText value={report.updatedAt ?? report.createdAt} />
          </td>
          <td data-label="Review">
            <AdminTextLink href={partnerControlReportReviewHref(params, report.id)}>
              Review report
            </AdminTextLink>
          </td>
        </tr>
      ))}
    </AdminDataTable>
  );
}

function ReportReviewPanel({
  auditHistory,
  auditHistoryOk,
  params,
  report,
}: {
  readonly auditHistory: AdminProviderReportAuditHistory;
  readonly auditHistoryOk: boolean;
  readonly params: Record<string, string | string[] | undefined>;
  readonly report: AdminProviderReport;
}) {
  const closeHref = partnerControlHref(params, { reviewReportId: undefined });
  return (
    <AdminDisclosureCard
      className="admin-mb-16 partner-control-editor"
      id="partner-control-report-review"
      open
    >
      <summary>
        Review report · {shortDisplayId(report.id)} · {report.summary}
      </summary>
      <div className="partner-control-editor-body">
        <p>{report.details || 'No additional report details were recorded.'}</p>
        <p className="muted">
          Partner: {providerName(report.providerProfile, report.providerProfileId)} · Created{' '}
          <DateTimeText value={report.createdAt} />
        </p>
        <AdminDisclosure className="admin-mt-16 partner-control-report-audit" open>
          <summary>Recent report changes · {auditHistory.items.length}</summary>
          <div className="admin-mt-12">
            <p className="muted">Most recent recorded create and update events. Read-only.</p>
            {!auditHistoryOk ? (
              <AdminNoticeCard className="admin-mt-12" role="status" tone="warning">
                Report change history could not be loaded. Retry before relying on this timeline.
              </AdminNoticeCard>
            ) : auditHistory.items.length ? (
              <AdminBasicTimeline
                className="admin-mt-12"
                compactMeta
                items={auditHistory.items.map((entry) => ({
                  detail:
                    entry.changes.resolutionNote === undefined
                      ? `By ${reportAuditActorLabel(entry.actor)}`
                      : entry.changes.resolutionNote
                        ? `By ${reportAuditActorLabel(entry.actor)} · Resolution: ${entry.changes.resolutionNote}`
                        : `By ${reportAuditActorLabel(entry.actor)} · Resolution note cleared`,
                  id: entry.id,
                  meta: reportAuditChangeMeta(entry.changes),
                  statusLabel: entry.action === 'provider_report.create' ? 'Created' : 'Updated',
                  statusTone: entry.action === 'provider_report.create' ? 'success' : 'info',
                  time: <DateTimeText value={entry.createdAt} />,
                  title: entry.action === 'provider_report.create' ? 'Report created' : 'Report updated',
                  tone: entry.action === 'provider_report.create' ? 'success' : 'info',
                }))}
              />
            ) : (
              <p className="muted admin-mt-12">No report change history was recorded.</p>
            )}
          </div>
        </AdminDisclosure>
        <PartnerControlActionForm action={updateProviderReportWithState} className="admin-mt-16">
          <input name="reportId" type="hidden" value={report.id} />
          <input name="providerProfileId" type="hidden" value={report.providerProfileId} />
          <input name="returnTo" type="hidden" value={closeHref} />
          <AdminFormSelect
            defaultValue={report.status}
            label="Status"
            labelVisibility="visible"
            name="status"
            options={['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'].map((value) => ({
              label: value,
              value,
            }))}
          />
          <AdminFormSelect
            defaultValue={report.severity}
            label="Severity"
            labelVisibility="visible"
            name="severity"
            options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({ label: value, value }))}
          />
          <AdminFormTextarea
            className="admin-grid-span-2"
            defaultValue={report.resolutionNote ?? ''}
            label="Resolution note · required for Resolved or Dismissed"
            labelVisibility="visible"
            maxLength={1000}
            name="resolutionNote"
          />
          <AdminFormActionRow>
            <AdminFormControlButton type="submit">Save report changes</AdminFormControlButton>
            <AdminFormControlLink href={closeHref}>Close review</AdminFormControlLink>
          </AdminFormActionRow>
        </PartnerControlActionForm>

        <AdminDisclosure className="partner-control-restriction-flow admin-mt-16">
          <summary>Apply account restriction</summary>
          <div className="partner-control-restriction-body">
            <p className="muted">Review the operating impact before applying a restriction.</p>
            <ul className="participant-list admin-mt-8" aria-label="Restriction impact preview">
              <li>
                <strong>Warning</strong>
                <span>No automatic operating gate</span>
              </li>
              <li>
                <strong>Account block</strong>
                <span>Visibility, invitations, acceptance, service start, payout, and withdrawal</span>
              </li>
              <li>
                <strong>Payout hold</strong>
                <span>Payout creation and release only</span>
              </li>
              <li>
                <strong>Public profile trust indicator removal</strong>
                <span>Public trust display only</span>
              </li>
            </ul>
            <PartnerControlRestrictionForm action={createProviderSanctionWithState}>
              <input name="providerProfileId" type="hidden" value={report.providerProfileId} />
              <input name="reportId" type="hidden" value={report.id} />
              <input name="returnTo" type="hidden" value={closeHref} />
              <AdminFormSelect
                defaultValue="WARNING"
                label="Restriction type"
                labelVisibility="visible"
                name="type"
                options={[
                  { label: 'Warning · no automatic operating gate', value: 'WARNING' },
                  { label: 'Account block · all operating access', value: 'ACCOUNT_BLOCK' },
                  { label: 'Payout hold · payout creation and release', value: 'PAYOUT_HOLD' },
                  {
                    label: 'Public profile trust indicator removal',
                    value: 'TRUST_BADGE_REMOVAL',
                  },
                ]}
              />
              <AdminFormDateTime label="Expiry" labelVisibility="visible" name="expiresAt" />
              <AdminFormTextarea
                className="admin-grid-span-2"
                label="Reason and evidence"
                labelVisibility="visible"
                minLength={12}
                maxLength={500}
                name="reason"
                required
              />
              <AdminFormCheckbox className="admin-grid-span-2" label="No expiry" name="noExpiry" value="true">
                No expiry · keep active until an operator lifts it
              </AdminFormCheckbox>
              <AdminFormCheckbox
                className="admin-grid-span-2"
                label="Confirm restriction"
                name="confirmation"
                required
                value="confirmed"
              >
                I confirm this restriction targets{' '}
                {providerName(report.providerProfile, report.providerProfileId)} and matches the evidence
                above.
              </AdminFormCheckbox>
              <AdminFormActionRow>
                <AdminFormControlButton type="submit">Apply restriction</AdminFormControlButton>
              </AdminFormActionRow>
            </PartnerControlRestrictionForm>
          </div>
        </AdminDisclosure>
      </div>
    </AdminDisclosureCard>
  );
}

function RestrictionFilters({
  filters,
  params,
}: {
  readonly filters: ReturnType<typeof buildPartnerControlFilters>;
  readonly params: Record<string, string | string[] | undefined>;
}) {
  const history = filters.sanction === 'HISTORY';
  return (
    <AdminFilterPanel
      actions={
        <AdminFilterChipGroup ariaLabel="Restriction lifecycle">
          <AdminFormControlLink
            aria-current={!history ? 'page' : undefined}
            className={!history ? 'button-primary' : 'button-secondary'}
            href={partnerControlHref(params, {
              details: 'sanctions',
              sanction: 'ACTIVE',
              sanctionPage: undefined,
            })}
          >
            Active
          </AdminFormControlLink>
          <AdminFormControlLink
            aria-current={history ? 'page' : undefined}
            className={history ? 'button-primary' : 'button-secondary'}
            href={partnerControlHref(params, {
              details: 'sanctions',
              sanction: 'HISTORY',
              sanctionPage: undefined,
            })}
          >
            History
          </AdminFormControlLink>
        </AdminFilterChipGroup>
      }
      className="admin-mb-16"
      description="Active restrictions and historical records are separate server-filtered queues."
      id="partner-control-restriction-filters"
      title="Filter account controls"
    >
      <AdminFormGrid action={applyPartnerControlFilters} className="partner-control-filter-grid">
        <input name="details" type="hidden" value="sanctions" />
        {history ? <input name="sanction" type="hidden" value="HISTORY" /> : null}
        <AdminFormSearch
          defaultValue={filters.q}
          label="Search restrictions"
          name="q"
          placeholder="Partner, report, reason, or restriction ID"
        />
        <AdminFormSelect
          defaultValue={filters.controlType}
          label="Restriction type"
          labelVisibility="visible"
          name="controlType"
          options={[
            { label: 'All types', value: '' },
            ...['WARNING', 'ACCOUNT_BLOCK', 'PAYOUT_HOLD', 'TRUST_BADGE_REMOVAL'].map((value) => ({
              label: value.replaceAll('_', ' '),
              value,
            })),
          ]}
        />
        <AdminFormSelect
          defaultValue={filters.sort || 'newest'}
          label="Sort"
          labelVisibility="visible"
          name="sort"
          options={[
            { label: 'Newest first', value: 'newest' },
            { label: 'Oldest first', value: 'oldest' },
          ]}
        />
        <AdminFormActionRow wide={false}>
          <AdminFormControlButton type="submit">Apply filters</AdminFormControlButton>
          <AdminFormControlLink
            href={partnerControlHref(params, {
              details: 'sanctions',
              q: undefined,
              controlType: undefined,
              sanction: history ? 'HISTORY' : undefined,
              sanctionPage: undefined,
              sort: undefined,
            })}
          >
            Reset
          </AdminFormControlLink>
        </AdminFormActionRow>
      </AdminFormGrid>
    </AdminFilterPanel>
  );
}

function RestrictionTable({
  params,
  sanctions,
}: {
  readonly params: Record<string, string | string[] | undefined>;
  readonly sanctions: AdminProviderSanction[];
}) {
  const history = readSearchParam(params.sanction) === 'HISTORY';
  return (
    <AdminDataTable
      className="partner-control-table partner-control-restriction-table"
      emptyMessage={
        history
          ? restrictionFiltersActive(params)
            ? 'No lifted or expired restrictions match the current filters.'
            : 'No lifted or expired restrictions.'
          : restrictionFiltersActive(params)
            ? 'No active restrictions match the current filters.'
            : 'No active restrictions.'
      }
      headers={['Restriction', 'Partner', 'Evidence', 'Issued / expires', 'Operator', 'Status', 'Review']}
      rowCount={sanctions.length}
    >
      {sanctions.map((sanction) => (
        <tr key={sanction.id}>
          <td data-label="Restriction">
            <strong>{sanction.type.replaceAll('_', ' ')}</strong>
            <p className="muted">{shortDisplayId(sanction.id)}</p>
          </td>
          <td data-label="Partner">
            <LinkedPartnerIdentity
              provider={sanction.providerProfile}
              providerId={sanction.providerProfileId}
            />
          </td>
          <td data-label="Evidence">
            <strong>Issued reason</strong>
            <p>{sanction.reason}</p>
            <p className="muted">
              {sanction.report
                ? `${sanction.report.category} · ${shortDisplayId(sanction.report.id)}`
                : 'No linked report'}
            </p>
            {history ? (
              <>
                <strong>Lift reason</strong>
                <p>{sanctionLiftReason(sanction) || 'Legacy · not recorded'}</p>
              </>
            ) : null}
          </td>
          <td data-label="Issued / expires">
            <DateTimeText value={sanction.startsAt} />
            <p className="muted">
              {sanction.expiresAt ? (
                <>
                  Expires <DateTimeText value={sanction.expiresAt} />
                </>
              ) : (
                'No expiry'
              )}
            </p>
            {sanction.liftedAt ? (
              <p className="muted">
                Lifted <DateTimeText value={sanction.liftedAt} />
              </p>
            ) : null}
          </td>
          <td data-label="Operator">
            {operatorLabel(sanction.issuedBy)}
            {sanction.liftedBy ? <p className="muted">Lifted by {operatorLabel(sanction.liftedBy)}</p> : null}
          </td>
          <td data-label="Status">
            <StatusBadge tone={sanction.status === 'ACTIVE' ? 'warning' : 'neutral'}>
              {sanction.status}
            </StatusBadge>
          </td>
          <td data-label="Review">
            {sanction.status === 'ACTIVE' ? (
              <AdminTextLink
                href={partnerControlDeskActionConfirmHref({
                  sanctionId: sanction.id,
                  details: 'sanctions',
                  q: readSearchParam(params.q),
                  sanction: readSearchParam(params.sanction) || 'ACTIVE',
                  sanctionPage: readSearchParam(params.sanctionPage),
                  sort: readSearchParam(params.sort),
                  controlType: readSearchParam(params.controlType),
                })}
              >
                Review restriction
              </AdminTextLink>
            ) : (
              <AdminTextLink href={`/partners/${sanction.providerProfileId}`}>Open Partner</AdminTextLink>
            )}
          </td>
        </tr>
      ))}
    </AdminDataTable>
  );
}

function PartnerQueueFooter({
  itemLabel,
  page,
  pageParam,
  params,
}: {
  readonly itemLabel: string;
  readonly page: { skip: number; take: number; totalCount: number; items: unknown[] };
  readonly pageParam: 'blockerPage' | 'reportPage' | 'sanctionPage';
  readonly params: Record<string, string | string[] | undefined>;
}) {
  const activePage = page.totalCount ? Math.floor(page.skip / page.take) + 1 : 1;
  const totalPages = Math.max(1, Math.ceil(page.totalCount / page.take));
  return (
    <AdminTablePaginationFooter
      activePage={activePage}
      ariaLabel={`${itemLabel} pagination`}
      className="vuexy-partner-table-footer"
      from={page.totalCount ? page.skip + 1 : 0}
      hrefForPage={(nextPage) => partnerControlListHref(params, pageParam, nextPage)}
      itemLabel={itemLabel}
      to={Math.min(page.skip + page.items.length, page.totalCount)}
      totalPages={totalPages}
      totalRows={page.totalCount}
    />
  );
}

function PartnerIdentity({ provider }: { readonly provider: AdminProvider }) {
  return (
    <div className="partner-control-person">
      <AdminTextLink href={`/partners/${provider.id}?section=full`}>
        {providerName(provider, provider.id)}
      </AdminTextLink>
      <span>
        {maskedPhone(provider.user?.phone)} · {shortDisplayId(provider.id)} · {provider.status}
      </span>
    </div>
  );
}

function LinkedPartnerIdentity({
  provider,
  providerId,
}: {
  readonly provider: AdminProviderReport['providerProfile'] | AdminProviderSanction['providerProfile'];
  readonly providerId: string;
}) {
  return (
    <div className="partner-control-person">
      <AdminTextLink href={`/partners/${providerId}?section=full`}>
        {providerName(provider, providerId)}
      </AdminTextLink>
      <span>
        {maskedPhone(provider?.user?.phone)} · {shortDisplayId(providerId)}
      </span>
    </div>
  );
}

function priorityCountLabel(count: number) {
  if (count === 0) return 'No Partners with blockers';
  return `${count} Partner${count === 1 ? '' : 's'} with blockers`;
}

function impactTierLabel(kind: PartnerControlBlockerKind, priority: number) {
  const tier = priority >= 90 ? 'P0' : priority >= 70 ? 'P1' : priority >= 50 ? 'P2' : 'P3';
  const impact =
    kind === 'ACCOUNT_BLOCK'
      ? 'work and payout blocked'
      : kind === 'NEGATIVE_WALLET'
        ? 'acceptance and payout blocked'
        : kind === 'PAYOUT_HOLD'
          ? 'payout blocked'
          : kind === 'URGENT_REPORT'
            ? 'urgent review'
            : kind === 'OVERDUE_REPORT'
              ? 'review SLA overdue'
              : kind === 'OPEN_REPORT'
                ? 'review required'
                : kind === 'KYC_READINESS'
                  ? 'readiness gap'
                  : kind === 'BANK_APPROVAL'
                    ? 'payout readiness gap'
                    : 'dispatch signal gap';
  return `${tier} · ${impact}`;
}

function partnerBlockerActionHref(provider: AdminProvider, kind: PartnerControlBlockerKind) {
  if (kind === 'NEGATIVE_WALLET') {
    return `/cash-settlements?${new URLSearchParams({ q: provider.id }).toString()}`;
  }
  if (kind === 'PAYOUT_HOLD') {
    return `/partner-controls?${new URLSearchParams({ details: 'sanctions', q: provider.id }).toString()}`;
  }
  if (kind === 'URGENT_REPORT' || kind === 'OVERDUE_REPORT' || kind === 'OPEN_REPORT') {
    return `/partner-controls?details=reports&q=${encodeURIComponent(provider.id)}`;
  }
  return `/partners/${provider.id}?section=full`;
}

function riskAgeLabel(
  kind: PartnerControlBlockerKind,
  startedAt: string | null,
  slaHours: number | null,
  overdue: boolean,
) {
  if (!startedAt) return 'Start time not tracked';
  const age = ageLabel(Date.now() - Date.parse(startedAt));
  if (!slaHours) {
    return kind === 'NEGATIVE_WALLET' || kind === 'STALE_LOCATION'
      ? `Last changed ${age} ago`
      : `Started ${age} ago`;
  }
  return `${age} · ${slaHours}h SLA${overdue ? ' overdue' : ''}`;
}

function reportAgeSlaLabel(report: AdminProviderReport) {
  if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
    return 'Closed';
  }
  const sla = reportSlaHours(report.severity);
  const elapsed = Math.max(0, Date.now() - Date.parse(report.createdAt));
  return `${ageLabel(elapsed)} · ${sla}h SLA${elapsed >= sla * 3_600_000 ? ' overdue' : ''}`;
}

function ReportAgeSla({ report }: { readonly report: AdminProviderReport }) {
  const label = reportAgeSlaLabel(report);
  if (label !== 'Closed') return label;
  return (
    <>
      Closed · <DateTimeText fallback="close time not tracked" value={report.resolvedAt} />
    </>
  );
}

function reportQueueTitle(params: Record<string, string | string[] | undefined>) {
  return readSearchParam(params.status) ? 'Reports' : 'Reports needing review';
}

function reportEmptyMessage(params: Record<string, string | string[] | undefined>) {
  const filtered = Boolean(
    readSearchParam(params.q) ||
    readSearchParam(params.status) ||
    readSearchParam(params.severity) ||
    readSearchParam(params.review),
  );
  return filtered ? 'No reports match the current filters.' : 'No reports need triage.';
}

function restrictionFiltersActive(params: Record<string, string | string[] | undefined>) {
  return Boolean(readSearchParam(params.q) || readSearchParam(params.controlType));
}

function sanctionLiftReason(sanction: AdminProviderSanction) {
  const reason = sanction.metadata?.liftReason;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

function reportSlaHours(severity: string) {
  if (severity === 'CRITICAL') return 2;
  if (severity === 'HIGH') return 8;
  if (severity === 'MEDIUM') return 24;
  return 72;
}

function ageLabel(milliseconds: number) {
  const hours = Math.max(0, Math.floor(milliseconds / 3_600_000));
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function providerName(
  provider:
    | Pick<AdminProvider, 'displayName' | 'user'>
    | AdminProviderReport['providerProfile']
    | AdminProviderSanction['providerProfile']
    | null
    | undefined,
  fallback: string,
) {
  return provider?.displayName || provider?.user?.fullName || `Partner ${shortDisplayId(fallback)}`;
}

function partnerOptionLabel(provider: AdminProvider) {
  return `${providerName(provider, provider.id)} · ${maskedPhone(provider.user?.phone)} · ${shortDisplayId(provider.id)} · ${provider.status}`;
}

function maskedPhone(value?: string | null) {
  const phone = value?.trim();
  if (!phone) return 'Phone unavailable';
  if (phone.length <= 5) return '•'.repeat(phone.length);
  return `${phone.slice(0, 3)}${'•'.repeat(Math.max(3, phone.length - 5))}${phone.slice(-2)}`;
}

function operatorLabel(operator?: { fullName?: string | null; phone?: string | null } | null) {
  return operator?.fullName || (operator?.phone ? maskedPhone(operator.phone) : 'Unassigned');
}

function reportAuditActorLabel(actor: AdminProviderReportAuditHistory['items'][number]['actor']) {
  return actor?.fullName || (actor?.id ? `Admin ${shortDisplayId(actor.id)}` : 'Unknown operator');
}

function reportAuditChangeMeta(changes: AdminProviderReportAuditHistory['items'][number]['changes']) {
  return [
    ...(changes.status ? [{ label: 'Status', value: changes.status }] : []),
    ...(changes.severity ? [{ label: 'Severity', value: changes.severity }] : []),
    ...(changes.category ? [{ label: 'Category', value: changes.category }] : []),
  ];
}

function reportSeverityTone(severity: string) {
  if (severity === 'CRITICAL') return 'danger' as const;
  if (severity === 'HIGH') return 'warning' as const;
  return 'info' as const;
}

function reportStatusTone(status: string) {
  if (status === 'OPEN') return 'warning' as const;
  if (status === 'INVESTIGATING') return 'info' as const;
  return 'success' as const;
}

function partnerControlDeskServerAction(action: PartnerControlDeskConfirmationAction) {
  switch (action) {
    case 'lift-control':
      return liftProviderSanction;
  }
}
