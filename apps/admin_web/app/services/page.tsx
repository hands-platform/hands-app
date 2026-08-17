import { AdminPageTemplate } from '../../components/admin-page-template';
import {
  adminGetResult,
  type AdminServiceCatalogGroup,
  type AdminServiceCatalogHealth,
  type AdminServiceCatalogImpact,
} from '../../lib/admin-api';
import { readSingleParam, type ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import { serviceActionNotice } from '../../lib/service-action-notice';
import { ServiceActionNoticeSection } from './service-action-notice-section';
import { ServiceCatalogManagerSection } from './service-catalog-manager-section';

type ServicesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ServicesPage({ searchParams }: { searchParams?: ServicesPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const [groupsResult, healthResult] = await Promise.all([
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
          dialogMode={dialogMode}
          editGroup={editGroup}
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
