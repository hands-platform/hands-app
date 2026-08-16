import type {
  AdminServiceCatalogDraft,
  AdminServiceCatalogItem,
  AdminTaxPolicyVersion,
} from './admin-api';

export type ServiceCatalogGroup = {
  readonly key: string;
  readonly label: string;
  readonly nameTranslations?: Record<string, string> | null;
  readonly items: readonly AdminServiceCatalogItem[];
  readonly draft?: AdminServiceCatalogDraft | null;
};

export function groupServices(services: readonly AdminServiceCatalogItem[]): readonly ServiceCatalogGroup[] {
  const groups = new Map<string, AdminServiceCatalogItem[]>();
  for (const service of services) {
    const key = service.serviceGroupKey ?? slugify(service.name);
    groups.set(key, [...(groups.get(key) ?? []), service]);
  }

  return [...groups.entries()].map(([key, items]) => ({
    items: items.sort((left, right) => left.durationMin - right.durationMin),
    key,
    label: items[0]?.name ?? key,
    nameTranslations: items[0]?.nameTranslations ?? null,
  }));
}

export function filterServiceGroups(
  groups: readonly ServiceCatalogGroup[],
  query: string,
): readonly ServiceCatalogGroup[] {
  if (!query) {
    return groups;
  }

  const search = query.toLowerCase();
  return groups
    .map((group) => {
      const groupMatches = [group.key, group.label].join(' ').toLowerCase().includes(search);
      if (groupMatches) {
        return group;
      }

      const items = group.items.filter((service) => serviceSearchText(service).includes(search));
      return items.length ? { ...group, items } : null;
    })
    .filter(isServiceCatalogGroup);
}

export function filterServices(
  services: readonly AdminServiceCatalogItem[],
  query: string,
): readonly AdminServiceCatalogItem[] {
  if (!query) {
    return services;
  }
  const search = query.toLowerCase();
  return services.filter((service) => serviceSearchText(service).includes(search));
}

export function readSingleParam(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function selectActiveTaxPolicy(policies: readonly AdminTaxPolicyVersion[], nowMs = Date.now()) {
  return policies
    .filter((policy) => {
      if (policy.status !== 'ACTIVE') {
        return false;
      }
      const startsAt = new Date(policy.effectiveFrom).getTime();
      const endsAt = policy.effectiveTo ? new Date(policy.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
      return startsAt <= nowMs && endsAt >= nowMs;
    })
    .sort(
      (left, right) => new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime(),
    )[0];
}

function serviceSearchText(service: AdminServiceCatalogItem) {
  return [
    service.id,
    service.name,
    ...Object.values(service.nameTranslations ?? {}),
    service.description,
    service.serviceGroupKey,
    service.durationMin,
    service.basePrice,
    service.priceStep,
    service.active ? 'active' : 'inactive',
  ]
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join(' ')
    .toLowerCase();
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isServiceCatalogGroup(group: ServiceCatalogGroup | null): group is ServiceCatalogGroup {
  return group !== null;
}
