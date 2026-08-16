import { createHash } from 'node:crypto';

export const PUBLIC_SITE_ROUTE_ACTIONS = [
  'KEEP',
  'CREATE',
  'BACKFILL_REVISION',
  'MOVE_ROUTE',
  'STALE_ROUTE',
  'CONFLICT',
  'BLOCKED',
];

const LEGACY_ROUTE_MOVES = new Map([
  ['MAIN:/partners/[city]/[slug]', '/partners/[city]/[district]/[slug]'],
]);

export function classifyPublicSiteRouteMigration(manifest, pages) {
  const expected = manifest.flatMap((entry) =>
    entry.requiredLocales.map((locale) => ({ ...entry, locale })),
  );
  const currentByKey = new Map(pages.map((page) => [rowKey(page.site, page.locale, page.path), page]));
  const expectedKeys = new Set(expected.map((row) => rowKey(row.site, row.locale, row.path)));
  const claimedLegacyKeys = new Set();
  const items = expected.map((row) => {
    const key = rowKey(row.site, row.locale, row.path);
    const page = currentByKey.get(key);
    if (page) return classifyExisting(row, page);
    const legacy = [...LEGACY_ROUTE_MOVES.entries()].find(([legacyRoute, targetPath]) => {
      const [site] = legacyRoute.split(':');
      return site === row.site && targetPath === row.path;
    });
    if (legacy) {
      const legacyPath = legacy[0].slice(legacy[0].indexOf(':') + 1);
      const legacyKey = rowKey(row.site, row.locale, legacyPath);
      const legacyPage = currentByKey.get(legacyKey);
      if (legacyPage && !legacyPage.activeRevisionId) {
        claimedLegacyKeys.add(legacyKey);
        return item('MOVE_ROUTE', row, legacyPage, { fromPath: legacyPath });
      }
      if (legacyPage) return item('CONFLICT', row, legacyPage, { reason: 'Legacy route has Live history and cannot be moved automatically.' });
    }
    return item('CREATE', row, null);
  });
  for (const page of pages) {
    const key = rowKey(page.site, page.locale, page.path);
    if (expectedKeys.has(key) || claimedLegacyKeys.has(key)) continue;
    items.push(item('STALE_ROUTE', page, page, { reason: 'Route is not present in the canonical manifest.' }));
  }
  const summary = Object.fromEntries(PUBLIC_SITE_ROUTE_ACTIONS.map((action) => [action, 0]));
  for (const row of items) summary[row.action] += 1;
  const checksum = createHash('sha256')
    .update(JSON.stringify(items.map(({ page, ...row }) => row)))
    .digest('hex');
  return {
    expectedRoutes: manifest.length,
    expectedRows: expected.length,
    currentRows: pages.length,
    summary,
    checksum,
    items,
  };
}

function classifyExisting(row, page) {
  const revisions = page.revisions ?? [];
  const revisionIds = new Set(revisions.map((revision) => revision.id));
  if (
    (page.activeRevisionId && !revisionIds.has(page.activeRevisionId)) ||
    (page.draftRevisionId && !revisionIds.has(page.draftRevisionId))
  ) {
    return item('BLOCKED', row, page, { reason: 'Revision pointer does not reference an existing revision.' });
  }
  if (!revisions.length || (!page.activeRevisionId && !page.draftRevisionId)) {
    return item('BACKFILL_REVISION', row, page);
  }
  return item('KEEP', row, page);
}

function item(action, row, page, extra = {}) {
  return {
    action,
    site: row.site,
    locale: row.locale,
    path: row.path,
    label: row.label ?? page?.internalName ?? row.path,
    pageId: page?.id ?? null,
    page,
    ...extra,
  };
}

function rowKey(site, locale, path) {
  return `${site}:${locale}:${path}`;
}
