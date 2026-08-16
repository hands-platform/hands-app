import { redirect } from 'next/navigation';

import { AdminExternalReadiness, adminGetResult } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { setupBrowserFixture } from './setup-browser-fixtures';
import { SetupOverviewSection } from './setup-overview-section';
import { parseSetupWorkspaceQuery, setupWorkspaceCanonicalHref } from './setup-page-model';
import { SetupRefreshControl } from './setup-refresh-control';

type SetupPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SetupPage({ searchParams }: { searchParams?: SetupPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const canonicalHref = setupWorkspaceCanonicalHref(params);
  if (canonicalHref) redirect(canonicalHref);

  const workspace = parseSetupWorkspaceQuery(params);
  const browserFixture = setupBrowserFixture(readSetupParam(params.fixture));
  const result = browserFixture?.result ?? await adminGetResult<AdminExternalReadiness | null>('/health/external', null);

  return (
    <AdminPageTemplate
      actions={<SetupRefreshControl />}
      contentClassName="setup-page"
      description="Active service health and launch configuration status."
      title="External Services"
    >
      {browserFixture ? (
        <AdminInlineNotice tone="warning">
          Isolated browser fixture: {browserFixture.label}. This is not a live operational response.
        </AdminInlineNotice>
      ) : null}
      <SetupOverviewSection
        errorCode={result.errorCode ?? null}
        mode={workspace.mode}
        readiness={result.data}
        requestId={result.requestId ?? null}
        status={result.status}
        view={workspace.view}
      />
    </AdminPageTemplate>
  );
}

function readSetupParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim();
}
