import { readSearchParam } from '../lib/date-range';

export type DashboardDetailsMode = 'summary' | 'all';

type DashboardParams = Record<string, string | string[] | undefined>;

export type DashboardViewMode = {
  readonly detailsMode: DashboardDetailsMode;
  readonly shouldRenderFullDashboard: boolean;
};

export type DashboardDataHrefs = {
  readonly operationalPolicyHref: string | null;
};

export function buildDashboardViewMode(params: DashboardParams): DashboardViewMode {
  const detailsMode = normalizeDashboardDetailsMode(readSearchParam(params.details));
  return {
    detailsMode,
    shouldRenderFullDashboard: detailsMode === 'all',
  };
}

export function buildDashboardDataHrefs(params: DashboardParams): DashboardDataHrefs {
  const viewMode = buildDashboardViewMode(params);
  return {
    operationalPolicyHref: viewMode.shouldRenderFullDashboard ? '/admin/operational-policy' : null,
  };
}

export function buildDashboardDetailsHref(detailsMode: DashboardDetailsMode, params: DashboardParams) {
  const query = new URLSearchParams();
  const range = readSearchParam(params.range);
  if (range) {
    query.set('range', range);
  }
  if (detailsMode === 'all') {
    query.set('details', 'all');
  }
  const value = query.toString();
  return value ? `/?${value}` : '/';
}

function normalizeDashboardDetailsMode(value: string): DashboardDetailsMode {
  return value === 'all' ? 'all' : 'summary';
}
