import { AdminExternalReadiness, adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { SetupOverviewSection } from './setup-overview-section';
import {
  buildOperationalHealthRows,
  isReadinessUnavailable,
} from './setup-page-model';
import {
  externalRegistrationPlan,
} from './setup-page-data';

type SetupPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SetupPage({ searchParams }: { searchParams?: SetupPageSearchParams }) {
  await searchParams;
  const readiness = await adminGet<AdminExternalReadiness>('/health/external', {
    ok: false,
    timestamp: new Date(0).toISOString(),
    checks: [],
  });

  const readinessUnavailable = isReadinessUnavailable(readiness);
  const healthRows = buildOperationalHealthRows(
    readiness,
    externalRegistrationPlan,
    readinessUnavailable,
  );

  return (
    <AdminPageTemplate
      contentClassName="setup-page"
      description="Current external service health, operational impact, ownership, and recovery actions."
      title="Setup Readiness"
    >
      <SetupOverviewSection
        readinessUnavailable={readinessUnavailable}
        readinessTimestamp={readiness.timestamp}
        rows={healthRows}
      />
    </AdminPageTemplate>
  );
}
