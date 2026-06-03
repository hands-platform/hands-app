export type LegacyProviderSearchParams = Record<string, string | string[] | undefined>;

export function buildLegacyPartnerQueryString(params: LegacyProviderSearchParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) search.append(key, item);
      });
      continue;
    }
    if (value) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
