import { NextRequest, NextResponse } from 'next/server';

import type { AdminOperationalPolicySetting, AdminProvider } from '../../../../../lib/admin-api';
import { adminGet } from '../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../lib/admin-session';
import { buildCsvContent } from '../../../../../lib/csv-export';
import {
  buildPartnerDataHrefs,
  buildProviderActiveFilters,
  buildProviderFilters,
  partnerRowsPagination,
} from '../../../../partners/partner-filters';
import { buildProviderOpsPolicy, buildProviderOpsPolicyApiHref } from '../../../../partners/partner-list-ops';
import {
  filterPartners,
  sortPartners,
  type PartnerListQueryDeps,
} from '../../../../partners/partner-list-query';
import {
  partnerBackupMatchingEligibility,
  partnerCanAcceptBookingNow,
  partnerHasHardAcceptanceBlocker,
  providerDispatchReady,
} from '../../../../partners/partner-list-readiness';
import { buildPartnerOperationRow } from '../../../../partners/partner-operation-row';
import { buildPartnerMasterRow } from '../../../../partners/partner-master-row';
import { providerDisplayName } from '../../../../partners/partner-display';
import { buildPartnerExportRows, PARTNER_EXPORT_COLUMNS } from '../../../../partners/partner-export-rows';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

const PARTNER_LIST_QUERY_DEPS: PartnerListQueryDeps = {
  canAcceptBookingNow: partnerCanAcceptBookingNow,
  dispatchReady: providerDispatchReady,
  displayName: providerDisplayName,
  hasHardAcceptanceBlocker: partnerHasHardAcceptanceBlocker,
  marketplaceEligibility: partnerBackupMatchingEligibility,
};

export async function GET(request: NextRequest) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const filters = buildProviderFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const dataHrefs = buildPartnerDataHrefs(filters);
  const [rawProviders, operationalPolicies] = await Promise.all([
    adminGet<AdminProvider[]>(dataHrefs.listHref, []),
    adminGet<AdminOperationalPolicySetting[]>(buildProviderOpsPolicyApiHref(), []),
  ]);
  const opsPolicy = buildProviderOpsPolicy(operationalPolicies);
  const allProviders = dataHrefs.listIsServerPaginated
    ? rawProviders
    : sortPartners(rawProviders, opsPolicy, filters.sort, PARTNER_LIST_QUERY_DEPS);
  const providers = dataHrefs.listIsServerPaginated
    ? allProviders
    : filterPartners(allProviders, filters, opsPolicy, PARTNER_LIST_QUERY_DEPS);
  const visibleProviders = partnerRowsPagination(providers, filters, {
    serverPaginated: dataHrefs.listIsServerPaginated,
    totalRows: providers.length,
  }).rows;
  const masterRows = visibleProviders.map((provider) =>
    buildPartnerMasterRow(provider, opsPolicy, { displayName: providerDisplayName }),
  );
  const operationRows = visibleProviders.map((provider) =>
    buildPartnerOperationRow(provider, opsPolicy, {
      canAcceptBookingNow: partnerCanAcceptBookingNow,
      displayName: providerDisplayName,
    }),
  );
  const activeFilters = buildProviderActiveFilters(filters);
  const filterLabel =
    activeFilters.length > 0 ? activeFilters.map((filter) => filter.label).join(' | ') : 'All partners';
  const rows = buildPartnerExportRows({
    fallbackOperationRow: (provider) =>
      buildPartnerOperationRow(provider, opsPolicy, {
        canAcceptBookingNow: partnerCanAcceptBookingNow,
        displayName: providerDisplayName,
      }),
    filterLabel,
    filters,
    masterRows,
    operationRows,
  });
  const csv = buildCsvContent(rows, [...PARTNER_EXPORT_COLUMNS]);

  return new NextResponse(csv, {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': 'attachment; filename="hands-partners.csv"',
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}
