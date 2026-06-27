const STANDARD_DURATION_OPTIONS = [60, 90, 120];

type ServiceCatalogOption = {
  id: string;
  serviceGroupKey?: string | null;
  name: string;
  nameTranslations?: unknown;
  description?: string | null;
  durationMin: number;
  basePrice: number;
  active?: boolean;
  payoutRules?: unknown[];
};

export function groupServiceCatalogOptions<T extends ServiceCatalogOption>(options: T[]) {
  const groups = new Map<string, T[]>();
  const names = new Map<string, string>();
  const descriptions = new Map<string, string | null>();
  const translations = new Map<string, unknown>();

  for (const option of options) {
    const key = serviceCatalogGroupKey(option);
    groups.set(key, [...(groups.get(key) ?? []), option]);
    if (!names.has(key)) {
      names.set(key, option.name);
    }
    if (!descriptions.has(key)) {
      descriptions.set(key, option.description ?? null);
    }
    if (!translations.has(key)) {
      translations.set(key, option.nameTranslations ?? null);
    }
  }

  return [...groups.entries()].map(([key, groupOptions]) => {
    const sortedOptions = [...groupOptions].sort((left, right) => {
      const durationCompare = left.durationMin - right.durationMin;
      if (durationCompare !== 0) {
        return durationCompare;
      }
      return left.basePrice - right.basePrice;
    });
    const activeOptions = sortedOptions.filter((option) => option.active !== false);
    const activeDurations = new Set(activeOptions.map((option) => option.durationMin));
    const prices = activeOptions.map((option) => option.basePrice);

    return {
      key,
      name: names.get(key) ?? 'Service',
      nameTranslations: translations.get(key) ?? null,
      description: descriptions.get(key) ?? null,
      durationSummary: sortedOptions.map((option) => `${option.durationMin} min`).join(', '),
      activeOptionCount: activeOptions.length,
      missingStandardDurations: STANDARD_DURATION_OPTIONS.filter(
        (duration) => !activeDurations.has(duration),
      ),
      minBasePrice: prices.length ? Math.min(...prices) : null,
      maxBasePrice: prices.length ? Math.max(...prices) : null,
      payoutRuleCount: sortedOptions.reduce((sum, option) => sum + (option.payoutRules?.length ?? 0), 0),
      options: sortedOptions,
    };
  });
}

function serviceCatalogGroupKey(option: ServiceCatalogOption) {
  const explicitKey = option.serviceGroupKey?.trim();
  if (explicitKey) {
    return explicitKey;
  }
  return slugify(option.name) || option.id;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
