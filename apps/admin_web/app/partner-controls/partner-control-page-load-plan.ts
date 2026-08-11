import { readSearchParam } from '../../lib/date-range';

const PARTNER_CONTROL_LIST_TAKE = 10;

type PartnerControlPageLoadPlanParams = Record<string, string | string[] | undefined>;

export type PartnerControlDetailsMode = 'summary' | 'controls' | 'reports' | 'sanctions';

export type PartnerControlPageLoadPlan = {
  readonly blockersPage: number;
  readonly detailsMode: PartnerControlDetailsMode;
  readonly listTake: number;
  readonly partnerSearchHref: string | null;
  readonly providersHref: string | null;
  readonly reportsHref: string | null;
  readonly reportHref: string | null;
  readonly reportsPage: number;
  readonly sanctionsHref: string | null;
  readonly sanctionsPage: number;
  readonly shouldRenderAccountControls: boolean;
  readonly shouldRenderPartnerBlockers: boolean;
  readonly shouldRenderReports: boolean;
  readonly shouldRenderSummary: boolean;
  readonly summaryHref: string | null;
};

export function buildPartnerControlPageLoadPlan(
  params: PartnerControlPageLoadPlanParams = {},
): PartnerControlPageLoadPlan {
  const detailsMode = normalizePartnerControlDetailsMode(params);
  const blockersPage = readPositivePage(params.blockerPage);
  const reportsPage = readPositivePage(params.reportPage);
  const sanctionsPage = readPositivePage(params.sanctionPage);
  const q = readSearchParam(params.q);
  const review = readSearchParam(params.review);
  const sort = readSearchParam(params.sort);
  const partnerQ = readSearchParam(params.partnerQ);
  const shouldLoadBlockers = detailsMode === 'summary' || detailsMode === 'controls';
  const shouldLoadReports = detailsMode === 'reports';
  const shouldLoadSanctions = detailsMode === 'sanctions';
  const reviewReportId = readSearchParam(params.reviewReportId);
  const creatingReport = readSearchParam(params.newReport) === '1' && !reviewReportId;

  return {
    blockersPage,
    detailsMode,
    listTake: PARTNER_CONTROL_LIST_TAKE,
    partnerSearchHref:
      shouldLoadReports && creatingReport
        ? apiHref('/admin/partner-controls/providers', {
            q: partnerQ,
            review: 'all',
            take: '20',
            withTotal: 'true',
          })
        : null,
    providersHref: shouldLoadBlockers
      ? apiHref('/admin/partner-controls/providers', {
          q,
          review: review || 'attention',
          skip: pageSkip(blockersPage),
          sort,
          take: String(PARTNER_CONTROL_LIST_TAKE),
          withTotal: 'true',
        })
      : null,
    reportsHref: shouldLoadReports
      ? apiHref('/admin/provider-reports', {
          q,
          review: review === 'overdue' ? review : readSearchParam(params.status) ? '' : 'active',
          severity: readSearchParam(params.severity),
          skip: pageSkip(reportsPage),
          sort,
          status: readSearchParam(params.status),
          take: String(PARTNER_CONTROL_LIST_TAKE),
          withTotal: 'true',
        })
      : null,
    reportHref:
      shouldLoadReports && reviewReportId ? `/admin/provider-reports/${encodeURIComponent(reviewReportId)}` : null,
    reportsPage,
    sanctionsHref: shouldLoadSanctions
      ? apiHref('/admin/provider-sanctions', {
          q,
          skip: pageSkip(sanctionsPage),
          sort,
          status: readSearchParam(params.sanction) || 'ACTIVE',
          take: String(PARTNER_CONTROL_LIST_TAKE),
          type: readSearchParam(params.controlType),
          withTotal: 'true',
        })
      : null,
    sanctionsPage,
    shouldRenderAccountControls: shouldLoadSanctions,
    shouldRenderPartnerBlockers: detailsMode === 'controls',
    shouldRenderReports: shouldLoadReports,
    shouldRenderSummary: detailsMode === 'summary',
    summaryHref: detailsMode === 'summary' ? '/admin/partner-controls/summary' : null,
  };
}

export function buildPartnerControlDetailsHref(
  detailsMode: PartnerControlDetailsMode,
  params: Record<string, string | undefined> = {},
) {
  return partnerControlHref(params, { ...params, details: detailsMode });
}

export function partnerControlWorkspaceHref(
  params: PartnerControlPageLoadPlanParams,
  detailsMode: PartnerControlDetailsMode,
) {
  return partnerControlHref(
    { q: readSearchParam(params.q) },
    { details: detailsMode },
  );
}

export function partnerControlHref(
  params: PartnerControlPageLoadPlanParams = {},
  overrides: Record<string, string | undefined> = {},
) {
  const state: Record<string, string | undefined> = {};
  for (const key of [
    'details',
    'q',
    'review',
    'status',
    'severity',
    'sanction',
    'controlType',
    'sort',
    'blockerPage',
    'reportPage',
    'sanctionPage',
    'newReport',
    'partnerQ',
    'reviewReportId',
    'controlAction',
    'sanctionId',
    'notice',
  ]) {
    state[key] = readSearchParam(params[key]);
  }
  Object.assign(state, overrides);

  const detailsMode = normalizePartnerControlDetailsMode(state);
  const values: Record<string, string | undefined> = {
    details: detailsMode === 'summary' ? undefined : detailsMode,
  };

  if (detailsMode === 'summary') {
    values.q = state.q;
  }

  if (detailsMode === 'controls') {
    values.q = state.q;
    values.review = state.review && state.review !== 'attention' ? state.review : undefined;
    values.sort = state.sort && state.sort !== 'priority' ? state.sort : undefined;
    values.blockerPage = positivePageValue(state.blockerPage);
  }

  if (detailsMode === 'reports') {
    values.q = state.q;
    values.review = state.review === 'overdue' ? 'overdue' : undefined;
    values.status = state.status;
    values.severity = state.severity;
    values.sort = state.sort && state.sort !== 'priority' ? state.sort : undefined;
    values.reportPage = positivePageValue(state.reportPage);
    if (state.reviewReportId) {
      values.reviewReportId = state.reviewReportId;
    } else if (state.newReport === '1') {
      values.newReport = '1';
      values.partnerQ = state.partnerQ;
    }
  }

  if (detailsMode === 'sanctions') {
    values.q = state.q;
    values.controlType = state.controlType;
    values.sanction = state.sanction === 'HISTORY' ? 'HISTORY' : undefined;
    values.sort = state.sort && state.sort !== 'newest' ? state.sort : undefined;
    values.sanctionPage = positivePageValue(state.sanctionPage);
    if (state.controlAction === 'lift-control' && state.sanctionId) {
      values.controlAction = state.controlAction;
      values.sanctionId = state.sanctionId;
    }
  }

  if (overrides.notice) values.notice = overrides.notice;
  return pageHref(values);
}

function pageSkip(page: number) {
  return page > 1 ? String((page - 1) * PARTNER_CONTROL_LIST_TAKE) : '';
}

function apiHref(path: string, values: Record<string, string>) {
  const query = new URLSearchParams(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  return `${path}?${query.toString()}`;
}

function pageHref(values: Record<string, string | undefined>) {
  const query = new URLSearchParams(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  return query.size ? `/partner-controls?${query.toString()}` : '/partner-controls';
}

function readPositivePage(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function positivePageValue(value: string | undefined) {
  const page = readPositivePage(value);
  return page > 1 ? String(page) : undefined;
}

function normalizePartnerControlDetailsMode(
  params: PartnerControlPageLoadPlanParams,
): PartnerControlDetailsMode {
  const requestedMode = readSearchParam(params.details);
  if (requestedMode === 'summary') return 'summary';
  if (requestedMode === 'controls' || requestedMode === 'reports' || requestedMode === 'sanctions') {
    return requestedMode;
  }
  if (readSearchParam(params.sanction) || readSearchParam(params.sanctionPage)) return 'sanctions';
  if (
    readSearchParam(params.status) ||
    readSearchParam(params.severity) ||
    readSearchParam(params.reportPage) ||
    readSearchParam(params.newReport) ||
    readSearchParam(params.reviewReportId)
  ) {
    return 'reports';
  }
  if (readSearchParam(params.review) === 'cash-debt' || readSearchParam(params.blockerPage)) {
    return 'controls';
  }
  return 'summary';
}
