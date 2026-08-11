export const WEBSITE_CONTENT_PAGE_SIZE = 20;

export function paginateWebsiteContentRows<T>(rows: readonly T[], pageValue?: string) {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / WEBSITE_CONTENT_PAGE_SIZE));
  const parsedPage = Number.parseInt(pageValue ?? '', 10);
  const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * WEBSITE_CONTENT_PAGE_SIZE;
  const pageRows = rows.slice(start, start + WEBSITE_CONTENT_PAGE_SIZE);

  return {
    rows: pageRows,
    page,
    totalPages,
    totalRows,
    from: pageRows.length ? start + 1 : 0,
    to: start + pageRows.length,
  };
}

export function websiteContentPageHref(page: number, site?: string, locale?: string, query?: string) {
  const params = new URLSearchParams();
  if (site) params.set('site', site);
  if (locale) params.set('locale', locale);
  if (query) params.set('q', query);
  if (page > 1) params.set('routePage', String(page));
  const queryString = params.toString();
  return `/website-content${queryString ? `?${queryString}` : ''}`;
}

export function websiteContentManageHref(
  pageId: string,
  page: number,
  site?: string,
  locale?: string,
  query?: string,
) {
  const href = websiteContentPageHref(page, site, locale, query);
  return `${href}${href.includes('?') ? '&' : '?'}pageId=${encodeURIComponent(pageId)}`;
}

export function filterWebsiteContentRows<T extends { internalName: string; path: string }>(
  rows: readonly T[],
  query?: string,
) {
  const needle = query?.trim().toLocaleLowerCase();
  if (!needle) return rows;
  return rows.filter(
    (row) =>
      row.internalName.toLocaleLowerCase().includes(needle) ||
      row.path.toLocaleLowerCase().includes(needle),
  );
}
