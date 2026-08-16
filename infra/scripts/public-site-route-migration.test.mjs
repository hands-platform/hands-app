import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPublicSiteRouteMigration } from './lib/public-site-route-migration.mjs';

const manifest = [{
  site: 'MAIN',
  path: '/',
  label: 'Home',
  requiredLocales: ['vi', 'ko'],
  sectionKinds: ['HERO'],
}];

test('classifies missing, revision backfill, keep, and stale rows without mutation', () => {
  const pages = [
    { id: 'vi', site: 'MAIN', locale: 'vi', path: '/', activeRevisionId: null, draftRevisionId: null, revisions: [], sections: [{ kind: 'HERO' }] },
    { id: 'stale', site: 'MAIN', locale: 'vi', path: '/old', activeRevisionId: null, draftRevisionId: null, revisions: [] },
  ];
  const before = structuredClone(pages);
  const result = classifyPublicSiteRouteMigration(manifest, pages);
  assert.equal(result.summary.BACKFILL_REVISION, 1);
  assert.equal(result.summary.CREATE, 1);
  assert.equal(result.summary.STALE_ROUTE, 1);
  assert.deepEqual(pages, before);
});

test('is idempotent after every expected row has a revision-backed draft', () => {
  const pages = manifest[0].requiredLocales.map((locale) => ({
    id: locale,
    site: 'MAIN',
    locale,
    path: '/',
    activeRevisionId: null,
    draftRevisionId: `draft-${locale}`,
    revisions: [{ id: `draft-${locale}` }],
  }));
  const result = classifyPublicSiteRouteMigration(manifest, pages);
  assert.equal(result.summary.KEEP, 2);
  assert.equal(result.summary.CREATE + result.summary.BACKFILL_REVISION + result.summary.MOVE_ROUTE, 0);
});

test('blocks broken revision pointers', () => {
  const result = classifyPublicSiteRouteMigration(manifest, [{
    id: 'vi', site: 'MAIN', locale: 'vi', path: '/', activeRevisionId: 'missing', draftRevisionId: null, revisions: [],
  }]);
  assert.equal(result.summary.BLOCKED, 1);
});
