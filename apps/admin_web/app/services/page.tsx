import { AdminPageTemplate } from '../../components/admin-page-template';
import { adminGet, type AdminServiceCatalogItem } from '../../lib/admin-api';
import { groupServices, readSingleParam, type ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import { serviceActionNotice } from '../../lib/service-action-notice';
import { ServiceActionNoticeSection } from './service-action-notice-section';
import { ServiceCatalogManagerSection } from './service-catalog-manager-section';

type ServicesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
const STANDARD_SERVICE_DURATIONS = new Set([60, 90, 120]);

export default async function ServicesPage({ searchParams }: { searchParams?: ServicesPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const services = await adminGet<AdminServiceCatalogItem[]>('/admin/services?scope=operational', []);
  const visibleServices = services.filter(
    (service) => !isSmokeOrTestService(service) && STANDARD_SERVICE_DURATIONS.has(service.durationMin),
  );
  const groupedServices = groupServices(visibleServices);
  const activeServices = visibleServices.filter((service) => service.active);
  const dialogMode = readDialogMode(params.dialog);
  const editGroupKey = readSingleParam(params.group);
  const editGroup = dialogMode === 'edit' ? findServiceGroup(groupedServices, editGroupKey) : null;
  const payoutRuleCount = visibleServices.reduce(
    (sum, service) => sum + (service.payoutRules?.length ?? 0),
    0,
  );

  return (
    <AdminPageTemplate
      description="Manage the base service menu, duration options, base customer prices, and Partner payout amounts."
      title="Service catalog"
    >
      <div className="service-catalog-page">
        <ServiceActionNoticeSection notice={serviceActionNotice(params)} />
        <ServiceCatalogManagerSection
          dialogMode={dialogMode}
          editGroup={editGroup}
          activeOptionCount={activeServices.length}
          groups={groupedServices}
          payoutRuleCount={payoutRuleCount}
          totalGroupCount={groupedServices.length}
        />
      </div>
    </AdminPageTemplate>
  );
}

function readDialogMode(value: string | readonly string[] | undefined) {
  const mode = readSingleParam(value);
  return mode === 'new' || mode === 'edit' ? mode : null;
}

function findServiceGroup(groups: readonly ServiceCatalogGroup[], key: string | undefined) {
  return groups.find((group) => group.key === key) ?? null;
}

function isSmokeOrTestService(service: AdminServiceCatalogItem) {
  const key = service.serviceGroupKey?.toLowerCase() ?? '';
  const name = service.name.toLowerCase();
  const marker = `${key} ${name}`;
  return (
    key.startsWith('smoke') ||
    marker.includes('test') ||
    name.startsWith('smoke') ||
    /\d{10,}/.test(marker)
  );
}
