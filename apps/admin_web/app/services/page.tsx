import { AdminPageTemplate } from '../../components/admin-page-template';
import {
  adminGetResult,
  type AdminServiceCatalogAuditEvidence,
  type AdminServiceCatalogGroup,
  type AdminServiceCatalogHealth,
  type AdminServiceCatalogImpact,
} from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../lib/admin-operator-access-model';
import { readSingleParam, type ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import { serviceActionNotice } from '../../lib/service-action-notice';
import { ServiceActionNoticeSection } from './service-action-notice-section';
import { ServiceCatalogManagerSection } from './service-catalog-manager-section';

type ServicesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ServicesPage({ searchParams }: { searchParams?: ServicesPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const evidenceGroupKey = readSingleParam(params.evidence);
  const [groupsResult, healthResult, operatorAccess, evidenceResult] = await Promise.all([
    adminGetResult<AdminServiceCatalogGroup[]>('/admin/services/groups?scope=operational', [], {
      freshness: 'stable',
      revalidateSeconds: 300,
      tags: ['service-catalog'],
    }),
    adminGetResult<AdminServiceCatalogHealth | null>('/admin/services/health', null, {
      freshness: 'stable',
      revalidateSeconds: 300,
      tags: ['service-catalog'],
    }),
    getCurrentAdminOperatorAccess(),
    evidenceGroupKey
      ? adminGetResult<AdminServiceCatalogAuditEvidence | null>(
          `/admin/services/groups/${encodeURIComponent(evidenceGroupKey)}/audit-evidence`,
          null,
          { freshness: 'aggregate', revalidateSeconds: 30, tags: ['service-catalog'] },
        )
      : Promise.resolve(null),
  ]);
  const groupedServices = groupsResult.data.map(toServiceCatalogGroup);
  const dialogMode = readDialogMode(params.dialog);
  const editGroupKey = readSingleParam(params.group);
  const editGroup = dialogMode === 'edit' ? findServiceGroup(groupedServices, editGroupKey) : null;
  const impactResult = editGroup
    ? await adminGetResult<AdminServiceCatalogImpact | null>(
        `/admin/services/groups/${encodeURIComponent(editGroup.key)}/impact`,
        null,
        { freshness: 'aggregate', revalidateSeconds: 30, tags: ['service-catalog'] },
      )
    : null;

  return (
    <AdminPageTemplate
      description="Control app-visible services, duration pricing, Partner payout rules, and publication readiness."
      title="Service catalog"
    >
      <div className="service-catalog-page">
        <ServiceActionNoticeSection notice={serviceActionNotice(params)} />
        <ServiceCatalogManagerSection
          dataAvailable={groupsResult.ok}
          canOpenFullAuditLog={hasAdminOperatorCategory(operatorAccess, 'SYSTEM_AUDIT')}
          dialogMode={dialogMode}
          editGroup={editGroup}
          evidence={evidenceResult?.data ?? null}
          evidenceAvailable={evidenceResult?.ok ?? true}
          evidenceGroupKey={evidenceGroupKey ?? null}
          groups={groupedServices}
          health={healthResult.data}
          healthAvailable={healthResult.ok}
          impact={impactResult?.data ?? null}
          impactAvailable={impactResult?.ok ?? true}
          invalidEditGroupKey={dialogMode === 'edit' && !editGroup ? editGroupKey ?? 'missing' : null}
        />
      </div>
    </AdminPageTemplate>
  );
}

function toServiceCatalogGroup(group: AdminServiceCatalogGroup): ServiceCatalogGroup {
  return {
    key: group.key,
    label: group.name,
    nameTranslations: group.nameTranslations,
    items: group.options,
    draft: group.draft ?? null,
  };
}

function readDialogMode(value: string | readonly string[] | undefined) {
  const mode = readSingleParam(value);
  return mode === 'new' || mode === 'edit' ? mode : null;
}

function findServiceGroup(groups: readonly ServiceCatalogGroup[], key: string | undefined) {
  return groups.find((group) => group.key === key) ?? null;
}
