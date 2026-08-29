/* eslint-disable @next/next/no-img-element -- CMS preview URLs are validated at runtime and cannot be covered by a static Next Image host allowlist. */
import Link from 'next/link';

import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import {
  AdminFormActionRow,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminCard, AdminDisclosure, AdminNoticeCard, AdminSection } from '../../components/admin-surface';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import { adminGetResult, type AdminGetResult } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../lib/admin-operator-access-model';
import { cmsDestructiveLifecycleEnabled } from '../../lib/launch-features';
import {
  createPublicSiteNewsArticleState,
  createPublicSitePageState,
  createPublicSiteSection,
  deletePublicSitePage,
  deletePublicSiteSection,
  discardPublicSiteDraft,
  openPublicSiteDraft,
  publishPublicSiteDraft,
  rollbackPublicSiteRevision,
  retryPublicSiteCacheInvalidation,
  takePublicSitePageOffline,
  updatePublicSiteNewsArticleState,
  updatePublicSitePageState,
  updatePublicSiteSectionState,
} from './actions';
import { WebsiteContentActionForm } from './website-content-action-form';
import { WebsiteContentTableScroll } from './website-content-table-scroll';
import type {
  PublicSiteListResult,
  PublicSiteManifestQueueRow,
  PublicSitePageDetail,
  PublicSitePageSummary,
  PublicSiteOwnership,
  PublicSitePreviewLink,
  PublicSiteRouteGroup,
  PublicSiteSection,
} from './website-content-types';
import {
  publicSiteLocaleOptions,
  publicSiteOptions,
  publicSiteSectionKindOptions,
  readinessIssues,
} from './website-content-types';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type ContentView = 'pages' | 'news';
type Workspace = 'overview' | 'content' | 'publishing' | 'activity';
const publicMainUrl = process.env.PUBLIC_SITE_MAIN_URL ?? 'http://localhost:3200';
const publicRecruitmentUrl = process.env.PUBLIC_SITE_RECRUITMENT_URL ?? 'http://localhost:3200';

const emptyList = <T,>(): PublicSiteListResult<T> => ({
  items: [],
  page: 1,
  take: 20,
  total: 0,
  totalPages: 1,
  summary: {
    viewScope: { routes: 0, live: 0, draftChanges: 0, ready: 0, needsAttention: 0, recentlyPublished: 0, scope: { contentType: 'pages', site: null, locale: null, q: null, status: 'all', readiness: null, ownership: null } },
    manifestHealth: { scope: 'GLOBAL_CANONICAL', expectedRoutes: 0, expectedRows: 0, missingRoutes: 0, missingTranslations: 0, staleTranslations: null, staleTranslationsApplicable: false },
    generatedAt: '',
  },
  summaryAvailable: false,
});

export default async function WebsiteContentPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  const view: ContentView = value(params.view) === 'news' ? 'news' : 'pages';
  const pageId = value(params.pageId);
  const mode = value(params.mode);
  const workspace = workspaceValue(params.workspace);
  const can = await permissions();

  if (pageId) {
    const [detailResult, previewResult] = await Promise.all([
      adminGetResult<PublicSitePageDetail | null>(`/admin/site-pages/${encodeURIComponent(pageId)}`, null),
      adminGetResult<PublicSitePreviewLink | null>(`/admin/site-pages/${encodeURIComponent(pageId)}/preview-link`, null),
    ]);
    return (
      <AdminPageTemplate
        actions={<AdminFormControlLink className="button-secondary" href={listHref(listQuery(params, { view, pageId: undefined, workspace: undefined }))}>Back to {view === 'news' ? 'News' : 'Pages'}</AdminFormControlLink>}
        contentClassName="website-content-workspace"
        description={detailResult.data ? `${siteLabel(detailResult.data.site)}${detailResult.data.path} · ${ownershipLabel(detailResult.data.ownership)} · ${detailResult.data.draftRevision ? 'Draft open' : 'No Draft changes'}` : 'Edit Draft content without interrupting the current Live website.'}
        title={detailResult.data ? `${detailResult.data.manifestLabel ?? detailResult.data.internalName} · ${detailResult.data.locale.toUpperCase()}` : 'Website Content'}
      >
        <CmsLifecycleModeNotice enabled={can.lifecycleEnabled} />
        {notice(value(params.status), detailResult.data?.id, params, view)}
        {!detailResult.ok || !detailResult.data ? (
          <DetailLoadFailure params={params} status={detailResult.status} view={view} />
        ) : (
          <PageWorkspace
            can={can}
            page={detailResult.data}
            params={params}
            previewResult={previewResult}
            view={view}
            workspace={workspace}
          />
        )}
      </AdminPageTemplate>
    );
  }

  if (mode === 'new') {
    return (
      <AdminPageTemplate
        actions={<AdminFormControlLink className="button-secondary" href={listHref(listQuery(params, { view, mode: undefined }))}>Cancel</AdminFormControlLink>}
        contentClassName="website-content-workspace"
        description={view === 'news' ? 'Create a complete article Draft. Publishing is a separate reviewed action.' : 'Create a Draft-only route. It remains unavailable to the public until published.'}
        title={view === 'news' ? 'New article' : 'New page'}
      >
        <CmsLifecycleModeNotice enabled={can.lifecycleEnabled} />
        {view === 'news' ? <NewsDraftForm canEdit={can.edit} returnTo={listHref(listQuery(params, { mode: undefined }))} /> : <NewPageForm canEdit={can.edit} returnTo={listHref(listQuery(params, { mode: undefined }))} />}
      </AdminPageTemplate>
    );
  }

  return ContentDirectory({
    canCreate: can.edit,
    lifecycleEnabled: can.lifecycleEnabled,
    params,
    view,
  });
}

async function ContentDirectory({ canCreate, lifecycleEnabled, params, view }: { canCreate: boolean; lifecycleEnabled: boolean; params: Record<string, string | string[] | undefined>; view: ContentView }) {
  const api = new URLSearchParams({ contentType: view, page: positivePage(value(params.routePage)).toString(), take: '20' });
  for (const key of ['site', 'locale', 'q']) {
    const item = value(params[key]);
    if (item) api.set(key, item);
  }
  const statusFilter = value(params.statusFilter);
  if (['all', 'live', 'draft', 'attention'].includes(statusFilter ?? '')) api.set('status', statusFilter!);
  const readiness = value(params.readiness);
  if (['UNKNOWN', 'READY', 'BLOCKED'].includes(readiness ?? '')) api.set('readiness', readiness!);
  const ownership = value(params.ownership);
  if (['CMS_LIVE', 'CODE_FALLBACK', 'NOT_SERVED', 'OWNERSHIP_CONFLICT'].includes(ownership ?? '')) api.set('ownership', ownership!);
  const queue = view === 'pages' && ['missing-routes', 'missing-translations'].includes(value(params.queue) ?? '')
    ? value(params.queue) as 'missing-routes' | 'missing-translations'
    : undefined;
  if (queue) api.set('queue', queue);
  const fallback = view === 'pages' ? emptyList<PublicSiteRouteGroup | PublicSiteManifestQueueRow>() : emptyList<PublicSitePageSummary>();
  const result = await adminGetResult<typeof fallback>(`/admin/site-pages?${api}`, fallback);
  const summary = result.data.summary;
  const hasFilters = Boolean(value(params.site) || value(params.locale) || value(params.q) || statusFilter || readiness || ownership || queue);
  const scoped = summary?.viewScope;
  const health = summary?.manifestHealth;

  return (
    <AdminPageTemplate
      actions={canCreate ? <AdminFormControlLink className="button-primary" href={listHref(listQuery(params, { view, mode: 'new' }))}>{view === 'news' ? 'New article' : 'New page'}</AdminFormControlLink> : null}
      contentClassName="website-content-directory"
      description="Find pages by name or address, then narrow the workspace by site, language and delivery state."
      metrics={result.ok && scoped && health ? view === 'news' ? [
        { label: 'Live articles', value: scoped.live, scope: 'Current News view', helper: 'Articles with an active revision in the current filter.' },
        { label: 'Draft articles', value: scoped.draftChanges, scope: 'Current News view', helper: 'Articles with unpublished Draft work.' },
        { label: 'Blocked articles', value: scoped.needsAttention, scope: 'Current News view', helper: 'Article Drafts that cannot be published yet.' },
        { label: 'Recently published', value: scoped.recentlyPublished, scope: 'Current News view · 7 days', helper: 'Articles activated during the latest seven days.' },
      ] : [
        { href: listHref(listQuery(params, { queue: undefined, readiness: 'BLOCKED', routePage: undefined })), label: 'Blocked', value: scoped.needsAttention, scope: 'Current view', helper: 'Draft language pages in the current filters that do not pass publishing readiness.' },
        { href: listHref(listQuery(params, { queue: undefined, readiness: 'UNKNOWN', routePage: undefined })), label: 'Needs validation', value: Math.max(0, scoped.draftChanges - scoped.ready - scoped.needsAttention), scope: 'Current view', helper: 'Draft language pages in the current filters whose readiness has not been evaluated.' },
        { href: listHref({ view: 'pages', queue: 'missing-routes' }), label: 'Missing routes', value: health.missingRoutes, scope: 'Global canonical', helper: `Required route groups with no managed language page · ${health.expectedRoutes} expected.` },
        { href: listHref({ view: 'pages', queue: 'missing-translations' }), label: 'Missing translations', value: health.missingTranslations, scope: 'Global canonical', helper: `${health.missingTranslations} missing · stale state not applicable.` },
        { label: 'Recently published', value: scoped.recentlyPublished, scope: 'Current view · 7 days', helper: 'Language pages in the current filters activated during the latest seven days.' },
      ] : []}
      metricsClassName="website-content-summary-grid"
      title="Website Content"
    >
      <CmsLifecycleModeNotice enabled={lifecycleEnabled} />
      {notice(value(params.status))}
      {result.ok && summary?.generatedAt ? <p className="muted website-content-generated">Summary generated <DateTimeText value={summary.generatedAt} />. Work counts use current filters; canonical health is global.</p> : null}
      {result.ok && !summary ? <AdminNoticeCard tone="warning"><strong>Content summary is unavailable</strong><p>The route list is still available. Retry before using summary counts for publishing work.</p></AdminNoticeCard> : null}
      <nav aria-label="Website content type" className="website-content-tabs">
        <Link aria-current={view === 'pages' ? 'page' : undefined} href={listHref({ view: 'pages' })} prefetch={false}>Pages</Link>
        <Link aria-current={view === 'news' ? 'page' : undefined} href={listHref({ view: 'news' })} prefetch={false}>News</Link>
      </nav>
      {queue ? <AdminNoticeCard tone="info"><strong>{queue === 'missing-routes' ? 'Missing canonical routes' : 'Missing canonical translations'}</strong><p>This queue is generated from the canonical manifest even when no database row exists.</p><AdminFormControlLink className="button-secondary" href={listHref({ view: 'pages' })}>Back to managed pages</AdminFormControlLink></AdminNoticeCard> : null}
      <AdminSection className="admin-mb-16" title="Filters" description="Search by page name or address and narrow the current work queue.">
        <AdminFormGrid action="/website-content" className="website-content-filter-grid" method="get">
          <input name="view" type="hidden" value={view} />
          <AdminFormInput defaultValue={value(params.q)} label="Name or route" labelVisibility="visible" name="q" type="search" />
          <AdminFormSelect defaultValue={value(params.site) ?? ''} label="Website" labelVisibility="visible" name="site" options={[{ label: 'All websites', value: '' }, ...publicSiteOptions]} />
          <AdminFormSelect defaultValue={value(params.locale) ?? ''} label="Language" labelVisibility="visible" name="locale" options={[{ label: 'All languages', value: '' }, ...publicSiteLocaleOptions]} />
          <AdminFormSelect defaultValue={statusFilter ?? 'all'} label="Status" labelVisibility="visible" name="statusFilter" options={[{ label: 'All states', value: 'all' }, { label: 'Live', value: 'live' }, { label: 'Draft changes', value: 'draft' }, { label: 'Needs attention', value: 'attention' }]} />
          {view === 'pages' ? <AdminFormSelect defaultValue={readiness ?? ''} label="Readiness" labelVisibility="visible" name="readiness" options={[{ label: 'All readiness states', value: '' }, { label: 'Ready', value: 'READY' }, { label: 'Blocked', value: 'BLOCKED' }, { label: 'Needs validation', value: 'UNKNOWN' }]} /> : null}
          {view === 'pages' ? <AdminFormSelect defaultValue={ownership ?? ''} label="Delivery" labelVisibility="visible" name="ownership" options={[{ label: 'All delivery states', value: '' }, { label: 'CMS Live', value: 'CMS_LIVE' }, { label: 'Code fallback', value: 'CODE_FALLBACK' }, { label: 'Not served', value: 'NOT_SERVED' }, { label: 'Ownership conflict', value: 'OWNERSHIP_CONFLICT' }]} /> : null}
          <AdminFormActionRow className="website-content-filter-actions" wide={false}>
            <AdminFormControlButton className="button-primary" type="submit">Apply</AdminFormControlButton>
            <AdminFormControlLink className="button-secondary" href={listHref({ view })}>Clear filters</AdminFormControlLink>
          </AdminFormActionRow>
        </AdminFormGrid>
      </AdminSection>
      {!result.ok ? (
        <AdminNoticeCard tone="danger"><strong>{view === 'news' ? 'News could not be loaded' : 'Pages could not be loaded'}</strong><p>Retry this view. The result is unavailable, not an empty content library.</p><AdminFormControlLink className="button-secondary" href={listHref(listQuery(params))}>Retry</AdminFormControlLink></AdminNoticeCard>
      ) : (
        <AdminSection statusLabel={`${result.data.total} ${view === 'news' ? 'articles' : queue ? 'queue items' : 'route groups'}`} title={view === 'news' ? 'News articles' : queue ? queue === 'missing-routes' ? 'Missing route queue' : 'Missing translation queue' : 'Managed pages'}>
          {view === 'pages' ? queue ? <ManifestQueueTable rows={result.data.items as PublicSiteManifestQueueRow[]} /> : <PageGroupTable groups={result.data.items as PublicSiteRouteGroup[]} params={params} hasFilters={hasFilters} /> : <NewsTable pages={result.data.items as PublicSitePageSummary[]} params={params} hasFilters={hasFilters} />}
          <AdminTablePaginationFooter
            activePage={result.data.page}
            ariaLabel={`${view === 'news' ? 'News' : 'Page route'} pages`}
            from={result.data.total ? (result.data.page - 1) * result.data.take + 1 : 0}
            hrefForPage={(page) => listHref(listQuery(params, { routePage: page > 1 ? String(page) : undefined }))}
            itemLabel={view === 'news' ? 'articles' : queue ? 'queue items' : 'route groups'}
            to={Math.min(result.data.page * result.data.take, result.data.total)}
            totalPages={result.data.totalPages}
            totalRows={result.data.total}
          />
        </AdminSection>
      )}
    </AdminPageTemplate>
  );
}

function PageGroupTable({ groups, params, hasFilters }: { groups: PublicSiteRouteGroup[]; params: Record<string, string | string[] | undefined>; hasFilters: boolean }) {
  return (
    <WebsiteContentTableScroll ariaLabel="Website route groups" className="website-content-route-table-scroll">
      <AdminDataTable
        className="website-content-route-table"
        emptyMessage={<AdminEmptyState message={hasFilters ? 'Clear filters to return to all managed pages.' : 'Create the first Draft route.'} title={hasFilters ? 'No pages match these filters' : 'No managed pages yet'} />}
        headers={['Page', 'Delivery', 'KO', 'EN', 'VI', 'JA', 'ZH', 'Recent change']}
        rowCount={groups.length}
      >
        {groups.map((group) => <tr key={group.groupKey}><td><strong>{group.label}</strong><span className="muted">{siteLabel(group.site)}</span><code>{group.path}</code></td><td className="website-content-domain"><OwnershipBadge ownership={group.ownership} /></td>{['ko', 'en', 'vi', 'ja', 'zh'].map((locale) => <td key={locale}><LocaleCell label={group.label} locale={locale} page={group.translations.find((item) => item.locale === locale)} params={params} /></td>)}<td><DateTimeText fallback="No managed page" value={latestRouteChange(group)} /></td></tr>)}
      </AdminDataTable>
    </WebsiteContentTableScroll>
  );
}

function ManifestQueueTable({ rows }: { rows: PublicSiteManifestQueueRow[] }) {
  return <WebsiteContentTableScroll ariaLabel="Canonical manifest work queue"><AdminDataTable className="website-content-manifest-queue-table" emptyMessage="No canonical gaps remain in this queue." headers={['Page', 'Website', 'Language', 'Delivery', 'Reason', 'Next action']} rowCount={rows.length}>{rows.map((row) => <tr key={row.key}><td><strong>{row.label}</strong><code>{row.path}</code></td><td>{siteLabel(row.site)}</td><td>{row.locale}</td><td><OwnershipBadge ownership={row.ownership} /></td><td>{row.reason}</td><td>{row.recommendedAction}</td></tr>)}</AdminDataTable></WebsiteContentTableScroll>;
}

function LocaleCell({ label, locale, page, params }: { label: string; locale: string; page?: PublicSitePageSummary; params: Record<string, string | string[] | undefined> }) {
  if (!page) return <span className="muted" aria-label={`${label} · ${locale.toUpperCase()} · Missing`}>Missing</span>;
  const state = localeState(page);
  return <AdminFormControlLink aria-label={`${label} · ${locale.toUpperCase()} · ${state.visitor}; ${state.work}`} className="website-content-locale-link" href={listHref(detailQuery(params, { pageId: page.id, view: 'pages', workspace: 'overview' }))}><span className="website-content-locale-state"><StatusBadge tone={page.activeRevision ? 'success' : 'neutral'}>{state.visitor}</StatusBadge><span className={state.workTone === 'warning' ? 'is-warning' : ''}>{state.work}</span></span></AdminFormControlLink>;
}

function localeState(page: PublicSitePageSummary) {
  const visitor = page.activeRevision ? 'Live' : 'Not live';
  if (!page.draftRevision) return { visitor, work: page.activeRevision ? 'No changes' : 'No Draft', workTone: 'neutral' as const };
  if (page.draftRevision.readinessState === 'READY') return { visitor, work: 'Draft ready', workTone: 'neutral' as const };
  if (page.draftRevision.readinessState === 'BLOCKED') return { visitor, work: 'Draft blocked', workTone: 'warning' as const };
  return { visitor, work: 'Needs review', workTone: 'warning' as const };
}

function NewsTable({ pages, params, hasFilters }: { pages: PublicSitePageSummary[]; params: Record<string, string | string[] | undefined>; hasFilters: boolean }) {
  return (
    <AdminTableScroll ariaLabel="News article list">
      <AdminDataTable emptyMessage={<AdminEmptyState message={hasFilters ? 'Clear filters to return to all articles.' : 'Create the first article Draft.'} title={hasFilters ? 'No news matches these filters' : 'No news articles yet'} />} headers={['Article', 'Website', 'Language', 'Live', 'Draft', 'Updated', 'Action']} rowCount={pages.length}>
        {pages.map((page) => <tr key={page.id}><td><strong>{page.internalName.replace(/^News:\s*/u, '')}</strong><code>{page.path}</code></td><td className="website-content-domain">{siteLabel(page.site)}</td><td>{page.locale.toUpperCase()}</td><td>{page.activeRevision ? <StatusBadge tone="success">Live</StatusBadge> : <span className="muted">Not live</span>}</td><td>{page.draftRevision ? <StatusBadge tone={page.draftRevision.readinessState === 'READY' ? 'neutral' : 'warning'}>{page.draftRevision.readinessState === 'READY' ? 'Ready' : 'Needs content'}</StatusBadge> : <span className="muted">No changes</span>}</td><td><DateTimeText value={page.draftRevision?.updatedAt ?? page.updatedAt} /></td><td><AdminFormControlLink className="button-secondary" href={listHref(detailQuery(params, { pageId: page.id, view: 'news', workspace: 'overview' }))}>Edit article</AdminFormControlLink></td></tr>)}
      </AdminDataTable>
    </AdminTableScroll>
  );
}

function DetailLoadFailure({ params, status, view }: { params: Record<string, string | string[] | undefined>; status: number | null; view: ContentView }) {
  const pageId = value(params.pageId);
  const retryHref = listHref(workspaceQuery(params, { pageId, view, workspace: workspaceValue(params.workspace) }));
  if (status === 403) {
    return <AdminNoticeCard tone="warning"><strong>Page access is not permitted</strong><p>CONTENT_VIEW permission is required. Return to the directory or ask an administrator to review your access.</p></AdminNoticeCard>;
  }
  if (status === 404) {
    return <AdminNoticeCard tone="warning"><strong>This page no longer exists</strong><p>The route may have been removed since the directory was loaded.</p><AdminFormControlLink className="button-secondary" href={listHref({ view })}>Back to {view === 'news' ? 'News' : 'Pages'}</AdminFormControlLink></AdminNoticeCard>;
  }
  return <AdminNoticeCard tone="danger"><strong>Page details could not be loaded</strong><p>{status === null ? 'The content service could not be reached.' : `The content service returned ${status}.`} Retry before editing or publishing this route.</p><AdminFormControlLink className="button-secondary" href={retryHref}>Retry</AdminFormControlLink></AdminNoticeCard>;
}

function PreviewFailureNotice({ result, retryHref }: { result: AdminGetResult<PublicSitePreviewLink | null>; retryHref: string }) {
  const copy = result.status === 403
    ? { tone: 'warning' as const, title: 'Draft preview permission denied', detail: 'CONTENT_VIEW permission is required to create a preview link.' }
    : result.errorCode === 'SITE_CONTENT_PREVIEW_NOT_CONFIGURED'
      ? { tone: 'danger' as const, title: 'Draft preview is not configured', detail: 'Publishing can continue only with explicit awareness that preview verification did not succeed. Ask the service owner to configure preview signing.' }
      : result.status === 404 || result.status === 409
        ? { tone: 'warning' as const, title: 'Draft preview is no longer valid', detail: 'The Draft changed or is no longer available. Reload the current Draft before previewing.' }
        : { tone: 'danger' as const, title: 'Draft preview service is unavailable', detail: 'The Draft remains unchanged. Retry preview before publishing.' };
  return <AdminNoticeCard role="alert" tone={copy.tone}><strong>{copy.title}</strong><p>{copy.detail}</p>{result.status !== 403 ? <AdminFormControlLink className="button-secondary" href={retryHref}>Retry preview</AdminFormControlLink> : null}</AdminNoticeCard>;
}

function PageWorkspace({ can, page, params, previewResult, view, workspace }: { can: Awaited<ReturnType<typeof permissions>>; page: PublicSitePageDetail; params: Record<string, string | string[] | undefined>; previewResult: AdminGetResult<PublicSitePreviewLink | null>; view: ContentView; workspace: Workspace }) {
  const draft = page.draftRevision;
  const live = page.activeRevision;
  const base = listHref(detailQuery(params, {
    ...params,
    pageId: page.id,
    view,
    workspace: undefined,
    confirmPublish: undefined,
    discardDraft: undefined,
    deletePageId: undefined,
    deleteSectionId: undefined,
    rollbackRevisionId: undefined,
    takeOffline: undefined,
    sectionId: undefined,
  }));
  const liveHref = publicUrl(page);
  const preview = previewResult.ok ? previewResult.data : null;
  const previewHref = preview ? `${liveHref}#cmsPreview=${encodeURIComponent(preview.token)}` : null;
  const deletingPage = value(params.deletePageId) === page.id;
  const takingOffline = value(params.takeOffline) === '1';
  const discardingDraft = value(params.discardDraft) === '1';
  const confirmingPublish = value(params.confirmPublish) === '1';
  const deletingSection = draft?.sections.find((section) => section.id === value(params.deleteSectionId));
  const rollback = page.revisions.find((revision) => revision.id === value(params.rollbackRevisionId));
  const section = draft?.sections.find((item) => item.id === value(params.sectionId));
  const changes = draftChangeSummary(page);

  return <>
    {deletingPage && can.delete ? <ConfirmDialog action={deletePublicSitePage} cancelHref={base} confirmLabel="Delete Draft route" description={<div className="website-content-confirm-summary"><p>This permanently removes a Draft-only route with no Live history.</p><dl><div><dt>Website</dt><dd>{siteLabel(page.site)}</dd></div><div><dt>Language</dt><dd>{page.locale.toUpperCase()}</dd></div><div><dt>Current path</dt><dd><code>{page.path}</code></dd></div><div><dt>Draft sections</dt><dd>{draft?.sections.length ?? 0}</dd></div><div><dt>Delivery after deletion</dt><dd>{ownershipLabel(page.ownership)}</dd></div></dl></div>} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'returnTo', value: base }]} id={`delete-page-${page.id}`} requireValidForm textInputs={[{ name: 'confirmationPath', label: `Type ${page.path} to confirm`, required: true }, { name: 'reason', label: 'Deletion reason', minLength: 5, maxLength: 500, required: true }]} title="Delete this Draft route?" /> : null}
    {takingOffline && live && can.publish ? <ConfirmDialog action={takePublicSitePageOffline} cancelHref={base} confirmLabel="Take page offline" description={<div className="website-content-confirm-summary"><p>The CMS revision will stop serving immediately. Visitors will see <strong>{page.offlineVisitorOutcome === 'CODE_FALLBACK' ? 'the code fallback page' : 'a not found response'}</strong>.</p><dl><div><dt>Website</dt><dd>{siteLabel(page.site)}</dd></div><div><dt>Language</dt><dd>{page.locale.toUpperCase()}</dd></div><div><dt>Current path</dt><dd><code>{page.path}</code></dd></div><div><dt>Current Live</dt><dd>Revision {live.revisionNumber}</dd></div></dl></div>} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'returnTo', value: base }]} id={`take-offline-${page.id}`} requireValidForm textInputs={[{ name: 'confirmationPath', label: `Type ${page.path} to confirm`, required: true }, { name: 'reason', label: 'Reason for taking offline', minLength: 5, maxLength: 500, required: true }]} title="Take this page offline?" tone="danger" /> : null}
    {discardingDraft && draft && live && can.edit && can.lifecycleEnabled ? <ConfirmDialog action={discardPublicSiteDraft} cancelHref={`${base}&workspace=${workspace}`} confirmLabel="Discard Draft changes" description={`Discard Draft revision ${draft.revisionNumber}. The current Live revision ${live.revisionNumber} will remain unchanged.`} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'confirmationId', value: page.id }, { name: 'returnTo', value: `${base}&workspace=${workspace}` }]} id={`discard-draft-${page.id}`} title="Discard this Draft?" /> : null}
    {confirmingPublish && draft?.readinessState === 'READY' && can.publish ? <ConfirmDialog action={publishPublicSiteDraft} cancelHref={`${base}&workspace=publishing#publish-draft`} confirmLabel={`Publish revision ${draft.revisionNumber}`} description={<div className="website-content-confirm-summary"><p>Readiness is checked again before the active revision switches.</p>{!previewHref ? <p className="website-content-publish-warning"><strong>Preview not verified:</strong> Draft preview did not succeed in this session. Resolve the preview notice or explicitly continue with this risk.</p> : null}{!live && page.ownership === 'CODE_FALLBACK' ? <p className="website-content-publish-warning"><strong>First CMS publish:</strong> this revision will replace the code fallback for visitors. The fallback source is not deleted.</p> : null}<dl><div><dt>Website</dt><dd>{siteLabel(page.site)}</dd></div><div><dt>Language</dt><dd>{page.locale.toUpperCase()}</dd></div><div><dt>Public URL</dt><dd>{liveHref}</dd></div><div><dt>Revision change</dt><dd>{live ? `${live.revisionNumber} → ${draft.revisionNumber}` : `Not live → ${draft.revisionNumber}`}</dd></div><div><dt>Canonical</dt><dd>{draft.canonicalPath ?? page.path}</dd></div><div><dt>Search indexing</dt><dd>{draft.noIndex ? 'Hidden from search engines' : 'Eligible for search indexing'}</dd></div><div><dt>Translation coverage</dt><dd>Verify the KO/EN/VI/JA/ZH matrix before publishing.</dd></div></dl><strong>Draft changes</strong><ul>{changes.map((change) => <li key={change}>{change}</li>)}</ul></div>} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'revisionId', value: draft.id }, { name: 'expectedVersion', value: draft.version }, { name: 'returnTo', value: `${base}&workspace=publishing` }]} id={`publish-draft-${draft.id}`} title="Publish this Draft?" tone="warning" /> : null}
    {deletingSection && can.delete ? <ConfirmDialog action={deletePublicSiteSection} cancelHref={base} confirmLabel="Delete section" description={`Delete ${deletingSection.key} from this Draft.`} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'sectionId', value: deletingSection.id }, { name: 'confirmationId', value: deletingSection.id }, { name: 'returnTo', value: base }]} id={`delete-section-${deletingSection.id}`} title="Delete Draft section?" /> : null}
    {rollback && can.publish ? <ConfirmDialog action={rollbackPublicSiteRevision} cancelHref={base} confirmLabel={`Restore revision ${rollback.revisionNumber}`} description={<div className="website-content-confirm-summary"><p>The selected previous Live revision will become current. The existing Live revision remains in history.</p><dl><div><dt>Public URL</dt><dd>{liveHref}</dd></div><div><dt>Current Live</dt><dd>{live ? `Revision ${live.revisionNumber}` : 'Not live'}</dd></div><div><dt>Restore</dt><dd>Revision {rollback.revisionNumber}</dd></div><div><dt>Previously published</dt><dd>{rollback.publishedAt ? <DateTimeText value={rollback.publishedAt} /> : 'Not recorded'}</dd></div><div><dt>Original publisher</dt><dd>{rollback.publishedById ?? 'Unknown'}</dd></div><div><dt>SEO title</dt><dd>{rollback.seoTitle ?? 'Not set'}</dd></div></dl></div>} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'revisionId', value: rollback.id }, { name: 'returnTo', value: base }]} id={`rollback-${rollback.id}`} requireValidForm textInputs={[{ name: 'reason', label: 'Rollback reason', minLength: 5, maxLength: 500, required: true }]} title="Restore previous Live revision?" /> : null}
    <AdminCard className="website-content-route-brief" ariaLabel="Route status"><div><span>Website</span><strong>{siteLabel(page.site)}</strong></div><div><span>Language</span><strong>{page.locale.toUpperCase()}</strong></div><div><span>Public URL</span><a href={liveHref} rel="noreferrer" target="_blank">{liveHref}</a></div><div><span>Delivery</span><OwnershipBadge ownership={page.ownership} /></div><div><span>Live</span>{live ? <StatusBadge tone="success">Revision {live.revisionNumber}</StatusBadge> : <StatusBadge tone="neutral">Not live</StatusBadge>}</div><div><span>Draft</span>{draft ? <StatusBadge tone={draft.readinessState === 'READY' ? 'success' : 'warning'}>{draft.readinessState === 'READY' ? `Ready · v${draft.version}` : 'Needs content'}</StatusBadge> : <StatusBadge tone="neutral">No changes</StatusBadge>}</div></AdminCard>
    {draft && !previewResult.ok ? <PreviewFailureNotice result={previewResult} retryHref={`${base}&workspace=${workspace}`} /> : null}
    <div className="website-content-workspace-actions">{!draft && live && can.edit ? <form action={openPublicSiteDraft}><input name="pageId" type="hidden" value={page.id} /><input name="returnTo" type="hidden" value={`${base}&workspace=${workspace}`} /><AdminFormControlButton className="button-secondary" type="submit">Open Draft</AdminFormControlButton></form> : null}{previewHref ? <a className="button-secondary" href={previewHref} rel="noreferrer" target="_blank">Preview Draft</a> : null}{live ? <a className="button-secondary" href={liveHref} rel="noreferrer" target="_blank">Open Live page</a> : null}{draft && can.publish ? <AdminFormControlLink className="button-primary" href={`${base}&workspace=publishing#publish-draft`}>Review Publish</AdminFormControlLink> : null}</div>
    <nav aria-label="Page workspace" className="website-content-tabs">{(['overview', 'content', 'publishing', 'activity'] as Workspace[]).map((item) => <Link aria-current={workspace === item ? 'page' : undefined} href={listHref(workspaceQuery(params, { pageId: page.id, view, workspace: item }))} key={item} prefetch={false}>{item === 'publishing' ? 'SEO & publishing' : titleCase(item)}</Link>)}</nav>
    {!can.edit ? <AdminNoticeCard tone="info"><strong>View-only access</strong><p>CONTENT_EDIT is required to save Draft changes. Publishing and deletion require separate permissions.</p></AdminNoticeCard> : null}
    {workspace === 'overview' ? <Overview canEdit={can.edit && can.lifecycleEnabled} page={page} previewHref={previewHref} liveHref={liveHref} returnTo={base} /> : null}
    {workspace === 'content' ? (page.path.startsWith('/news/') ? <NewsEditor canEdit={can.edit} page={page} returnTo={base} /> : <ContentEditor canDelete={can.delete} canEdit={can.edit} page={page} returnTo={base} selected={section} />) : null}
    {workspace === 'publishing' ? <Publishing canEdit={can.edit} canPublish={can.publish} lifecycleEnabled={can.lifecycleEnabled} page={page} returnTo={base} /> : null}
    {workspace === 'activity' ? <Activity canPublish={can.publish} lifecycleEnabled={can.lifecycleEnabled} page={page} returnTo={base} /> : null}
    {(can.publish && live) || (can.delete && !live && !page.firstPublishedAt) ? <AdminDisclosure className="website-content-danger-zone"><summary>More · risky operations</summary><div className="website-content-inline-actions">{can.publish && live ? <AdminFormControlLink className="button-danger" href={`${base}&takeOffline=1`}>Review take offline</AdminFormControlLink> : null}{can.delete && !live && !page.firstPublishedAt ? <AdminFormControlLink className="button-danger" href={`${base}&deletePageId=${encodeURIComponent(page.id)}`}>Review deletion</AdminFormControlLink> : null}</div></AdminDisclosure> : null}
  </>;
}

function Overview({ canEdit, page, previewHref, liveHref, returnTo }: { canEdit: boolean; page: PublicSitePageDetail; previewHref: string | null; liveHref: string; returnTo: string }) {
  const issues = draftReadinessIssues(page.draftRevision);
  return <div className="website-content-overview-grid"><AdminSection title="Current state" description={page.activeRevision ? 'Live continues serving while Draft changes are edited.' : 'This route remains private until a publisher activates a ready Draft.'}><dl className="website-content-facts"><div><dt>Current Live</dt><dd>{page.activeRevision ? `Revision ${page.activeRevision.revisionNumber}` : 'Not published'}</dd></div><div><dt>Draft changes</dt><dd>{page.draftRevision ? `Revision ${page.draftRevision.revisionNumber} · version ${page.draftRevision.version}` : 'No open Draft'}</dd></div><div><dt>Last published</dt><dd>{page.activeRevision?.publishedAt ? <DateTimeText value={page.activeRevision.publishedAt} /> : 'Never'}</dd></div><div><dt>Draft updated</dt><dd>{page.draftRevision ? <DateTimeText value={page.draftRevision.updatedAt} /> : 'Not applicable'}</dd></div></dl>{page.draftRevision && page.activeRevision && canEdit ? <div className="website-content-inline-actions"><AdminFormControlLink className="button-secondary" href={`${returnTo}&workspace=overview&discardDraft=1`}>Review Draft discard</AdminFormControlLink></div> : null}</AdminSection><AdminSection title="Publishing readiness" statusLabel={page.draftRevision?.readinessState ?? 'NO DRAFT'} statusTone={issues.length ? 'warning' : 'success'}>{issues.length ? <ul className="website-content-issue-list">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>{page.draftRevision ? 'This Draft passes the shared renderer readiness checks.' : 'Open a Draft copied from the current Live revision before editing.'}</p>}<div className="website-content-inline-actions">{previewHref ? <a className="text-link" href={previewHref} rel="noreferrer" target="_blank">Preview Draft</a> : null}{page.activeRevision ? <a className="text-link" href={liveHref} rel="noreferrer" target="_blank">Open Live page</a> : null}</div></AdminSection></div>;
}

function ContentEditor({ canDelete, canEdit, page, returnTo, selected }: { canDelete: boolean; canEdit: boolean; page: PublicSitePageDetail; returnTo: string; selected?: PublicSiteSection }) {
  const draft = page.draftRevision;
  if (!draft) return <AdminNoticeCard tone="info"><strong>No open Draft</strong><p>Use Open Draft above to copy the current Live revision before editing content.</p></AdminNoticeCard>;
  return <div className="website-content-editor-layout"><AdminSection title="Draft sections" description="Choose a section to edit. Sections are shown in their current visitor order."><ol className="website-content-section-list">{draft.sections.map((item) => <li key={item.id}><div><strong>{sectionKindLabel(item.kind)}</strong><span>{item.enabled ? 'Visible in Draft' : 'Hidden in Draft'}</span></div><div><AdminFormControlLink className="button-secondary" href={`${returnTo}&workspace=content&sectionId=${encodeURIComponent(item.id)}`}>Edit</AdminFormControlLink>{canDelete ? <AdminFormControlLink className="button-secondary" href={`${returnTo}&workspace=content&deleteSectionId=${encodeURIComponent(item.id)}`}>Delete</AdminFormControlLink> : null}</div></li>)}</ol>{canEdit ? <AdminDisclosure className="website-content-disclosure"><summary>Add section</summary><AdminFormGrid action={createPublicSiteSection}><input name="pageId" type="hidden" value={page.id} /><input name="returnTo" type="hidden" value={`${returnTo}&workspace=content`} /><input name="sortOrder" type="hidden" value={String(draft.sections.length * 10)} /><AdminFormSelect defaultValue="APP_OVERVIEW" label="Section type" labelVisibility="visible" name="kind" options={publicSiteSectionKindOptions} /><AdminFormActionRow><AdminFormControlButton className="button-primary" type="submit">Add to Draft</AdminFormControlButton></AdminFormActionRow></AdminFormGrid></AdminDisclosure> : null}</AdminSection>{selected ? <SectionEditor canEdit={canEdit} page={page} returnTo={returnTo} section={selected} /> : <AdminSection title="Section editor" description="Choose a Draft section to edit its visible fields."><AdminEmptyState title="No section selected" message="Select Edit beside a section." /></AdminSection>}</div>;
}

function SectionEditor({ canEdit, page, returnTo, section }: { canEdit: boolean; page: PublicSitePageDetail; returnTo: string; section: PublicSiteSection }) {
  const content = section.content;
  const fields = sectionEditorFields(section.kind);
  const imageUrl = text(content.imageUrl);
  const imagePreviewUrl = safeContentPreviewUrl(imageUrl);
  const imageAlt = text(content.imageAlt);
  const items = Array.isArray(content.items) ? content.items : [];
  const faqItems = items.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const question = text(record.question) || text(record.title);
    const answer = text(record.answer) || text(record.body);
    return question && answer ? [`${question} | ${answer}`] : [];
  }).join('\n');
  return (
    <AdminSection
      title={`Edit ${sectionKindLabel(section.kind)}`}
      statusLabel={page.draftRevision?.readinessState ?? 'UNKNOWN'}
      statusTone={page.draftRevision?.readinessState === 'READY' ? 'success' : 'warning'}
    >
      <WebsiteContentActionForm action={updatePublicSiteSectionState} disabled={!canEdit} fieldsClassName="website-content-section-fields" submitLabel="Save Draft section">
        <input name="pageId" type="hidden" value={page.id} />
        <input name="sectionId" type="hidden" value={section.id} />
        <input name="expectedVersion" type="hidden" value={page.draftRevision?.version} />
        <input name="returnTo" type="hidden" value={`${returnTo}&workspace=content&sectionId=${encodeURIComponent(section.id)}`} />
        {section.kind !== 'FAQ' && items.length ? <input name="itemsJson" type="hidden" value={JSON.stringify(items)} /> : null}
        <input name="key" type="hidden" value={section.key} />
        <AdminFormSelect className="website-content-field-kind" defaultValue={section.kind} disabled={!canEdit} label="Section type" labelVisibility="visible" name="kind" options={publicSiteSectionKindOptions} />
        {fields.eyebrow ? <AdminFormInput className="website-content-field-eyebrow" defaultValue={text(content.eyebrow)} disabled={!canEdit} label="Eyebrow" labelVisibility="visible" name="eyebrow" /> : null}
        <AdminFormInput className="website-content-field-title" defaultValue={text(content.title)} disabled={!canEdit} label="Title" labelVisibility="visible" name="title" />
        {fields.subtitle ? <AdminFormTextarea className="website-content-field-subtitle" defaultValue={text(content.subtitle)} disabled={!canEdit} label="Subtitle" labelVisibility="visible" name="subtitle" rows={2} /> : null}
        {fields.body ? <AdminFormTextarea className="website-content-field-body" defaultValue={text(content.body)} disabled={!canEdit} label="Body" labelVisibility="visible" name="body" rows={8} /> : null}
        {fields.faq ? <AdminFormTextarea className="website-content-field-faq" defaultValue={faqItems} disabled={!canEdit} label="Questions and answers · one Question | Answer pair per line" labelVisibility="visible" name="faqItems" rows={10} required /> : null}
        {fields.media ? <><AdminFormInput className="website-content-field-image-url" defaultValue={imageUrl} disabled={!canEdit} label="Image URL · relative path or HTTPS" labelVisibility="visible" name="imageUrl" placeholder="/images/example.jpg or https://..." /><AdminFormInput className="website-content-field-image-alt" defaultValue={imageAlt} disabled={!canEdit} label="Image description" labelVisibility="visible" maxLength={320} name="imageAlt" />{imagePreviewUrl ? <figure className="website-content-image-preview"><img alt={imageAlt || 'Draft image preview without a saved description'} decoding="async" src={imagePreviewUrl} /><figcaption>{imageAlt || 'Add an image description before publishing.'}</figcaption></figure> : null}</> : null}
        {fields.action ? <><AdminFormInput className="website-content-field-action-label" defaultValue={text(content.actionLabel)} disabled={!canEdit} label="Action label" labelVisibility="visible" name="actionLabel" /><AdminFormInput className="website-content-field-action-href" defaultValue={text(content.actionHref)} disabled={!canEdit} label="Action URL · relative path or HTTPS" labelVisibility="visible" name="actionHref" placeholder="/path or https://..." /></> : null}
        <input name="sortOrder" type="hidden" value={String(section.sortOrder)} />
        <AdminFormCheckbox defaultChecked={section.enabled} disabled={!canEdit} label="Draft visibility" name="enabled">Show this section in the Draft</AdminFormCheckbox>
        <AdminDisclosure className="website-content-disclosure form-grid-wide">
          <summary>Advanced JSON</summary>
          <p className="muted">Select the override only when the field editor cannot represent the required structure.</p>
          <dl className="website-content-section-internals"><div><dt>Internal section ID</dt><dd><code>{section.key}</code></dd></div><div><dt>Current order</dt><dd>{section.sortOrder}</dd></div></dl>
          <AdminFormCheckbox disabled={!canEdit} label="Advanced mode" name="useAdvancedJson">Replace the field values above with this JSON</AdminFormCheckbox>
          <AdminFormTextarea defaultValue={JSON.stringify(content, null, 2)} disabled={!canEdit} label="Section JSON" labelVisibility="visible" name="advancedContentJson" rows={14} />
        </AdminDisclosure>
      </WebsiteContentActionForm>
    </AdminSection>
  );
}

function sectionEditorFields(kind: PublicSiteSection['kind']) {
  if (kind === 'FAQ') return { eyebrow: true, subtitle: true, body: false, faq: true, media: false, action: false };
  if (kind === 'LEGAL_DOCUMENT') return { eyebrow: false, subtitle: false, body: true, faq: false, media: false, action: false };
  if (kind === 'CTA') return { eyebrow: true, subtitle: true, body: true, faq: false, media: false, action: true };
  return { eyebrow: true, subtitle: true, body: true, faq: false, media: true, action: true };
}

function safeContentPreviewUrl(value: string) {
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function Publishing({ canEdit, canPublish, lifecycleEnabled, page, returnTo }: { canEdit: boolean; canPublish: boolean; lifecycleEnabled: boolean; page: PublicSitePageDetail; returnTo: string }) {
  const draft = page.draftRevision;
  const issues = draftReadinessIssues(draft);
  return <div className="website-content-publishing-grid"><AdminSection title="SEO & indexing" description={page.activeRevision ? 'Route identity is locked while this URL is Live. SEO edits update the Draft only.' : 'The route remains Draft-only until a publisher activates it.'}>{draft ? <WebsiteContentActionForm action={updatePublicSitePageState} submitLabel="Save Draft changes"><input name="pageId" type="hidden" value={page.id} /><input name="expectedVersion" type="hidden" value={draft.version} /><input name="returnTo" type="hidden" value={`${returnTo}&workspace=publishing`} /><AdminFormInput defaultValue={page.internalName} disabled={!canEdit} label="Operator label" labelVisibility="visible" name="internalName" required /><AdminFormInput defaultValue={draft.seoTitle ?? ''} disabled={!canEdit} label="SEO title" labelVisibility="visible" maxLength={160} name="seoTitle" /><AdminFormTextarea defaultValue={draft.seoDescription ?? ''} disabled={!canEdit} label="SEO description" labelVisibility="visible" maxLength={320} name="seoDescription" rows={3} /><AdminFormInput defaultValue={draft.canonicalPath ?? page.path} disabled={!canEdit} label="Canonical path" labelVisibility="visible" name="canonicalPath" /><AdminFormCheckbox defaultChecked={draft.noIndex} disabled={!canEdit} label="Search indexing" name="noIndex">Ask search engines not to show this live page in results.</AdminFormCheckbox></WebsiteContentActionForm> : <p>No Draft is open. Use Open Draft above before changing SEO.</p>}</AdminSection><AdminSection id="publish-draft" title="Publish Draft" description="Publishing validates readiness and switches the active revision in one transaction." statusLabel={draft?.readinessState ?? 'NO DRAFT'} statusTone={issues.length ? 'warning' : 'success'}>{issues.length ? <ul className="website-content-issue-list">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>{draft ? `Draft revision ${draft.revisionNumber}, version ${draft.version}, is ready for review.` : 'There is no Draft to publish.'}</p>}{draft && canPublish ? issues.length ? <AdminFormControlButton className="button-secondary" disabled type="button">Publishing blocked · resolve {issues.length} issue{issues.length === 1 ? '' : 's'}</AdminFormControlButton> : <AdminFormControlLink className="button-primary" href={`${returnTo}&workspace=publishing&confirmPublish=1#publish-draft`}>Review and publish revision {draft.revisionNumber}</AdminFormControlLink> : draft ? <p className="muted">{lifecycleEnabled ? 'CONTENT_PUBLISH permission is required.' : 'Publishing is manual-only for the current launch.'}</p> : null}</AdminSection></div>;
}

function Activity({ canPublish, lifecycleEnabled, page, returnTo }: { canPublish: boolean; lifecycleEnabled: boolean; page: PublicSitePageDetail; returnTo: string }) {
  const revisions = page.revisions;
  const activity = page.activity ?? [];
  return <div className="website-content-activity"><AdminSection title="Content activity" description="Successful publishing, rollback, offline, deletion and cache refresh actions are recorded with operator evidence.">{activity.length ? <ol className="website-content-activity-list">{activity.map((event) => <li key={event.id}><div><strong>{auditActionLabel(event.action)}</strong><span>{event.actor?.label ?? 'System or unavailable operator'} · <DateTimeText value={event.createdAt} /></span></div><dl><div><dt>Reason</dt><dd>{auditMetadata(event.metadata, 'reason') ?? 'No reason recorded'}</dd></div><div><dt>Event ID</dt><dd><code>{auditMetadata(event.metadata, 'requestId') ?? event.id}</code></dd></div></dl></li>)}</ol> : <AdminEmptyState message="Successful publishing and high-risk content actions will appear here." title="No content activity recorded" />}</AdminSection><AdminSection title="Revision history" description="Only revisions that were previously Live are eligible for rollback."><AdminTableScroll ariaLabel="Website revision history"><AdminDataTable emptyMessage="No published revision history." headers={['Revision', 'State', 'Readiness', 'Published', 'Original publisher', 'Action']} rowCount={revisions.length}>{revisions.map((revision) => <tr key={revision.id}><td><strong>Revision {revision.revisionNumber}</strong><span className="muted">Version {revision.version}</span></td><td><StatusBadge tone={revision.state === 'ACTIVE' ? 'success' : 'neutral'}>{revision.state === 'ACTIVE' ? 'Current Live' : 'Previous Live'}</StatusBadge></td><td>{readinessLabel(revision.readinessState)}</td><td>{revision.publishedAt ? <DateTimeText value={revision.publishedAt} /> : 'Not recorded'}</td><td>{revision.publishedByLabel ?? 'Unavailable operator'}</td><td>{revision.state === 'ARCHIVED' ? canPublish ? <AdminFormControlLink className="button-secondary" href={`${returnTo}&workspace=activity&rollbackRevisionId=${encodeURIComponent(revision.id)}`}>Review rollback</AdminFormControlLink> : <span className="muted">{lifecycleEnabled ? 'CONTENT_PUBLISH required' : 'Manual-only'}</span> : <span className="muted">Current</span>}</td></tr>)}</AdminDataTable></AdminTableScroll></AdminSection></div>;
}

function NewsDraftForm({ canEdit, returnTo }: { canEdit: boolean; returnTo: string }) {
  return <AdminSection title="Article Draft" description="Slug uses lowercase letters, numbers and hyphens. Final URL: hands.vn/{language}/news/{slug}">{canEdit ? <WebsiteContentActionForm action={createPublicSiteNewsArticleState} submitLabel="Save article Draft"><input name="returnTo" type="hidden" value={returnTo} /><AdminFormSelect defaultValue="vi" label="Language" labelVisibility="visible" name="locale" options={publicSiteLocaleOptions} /><AdminFormInput label="URL slug" labelVisibility="visible" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="welcome-to-hands" required /><AdminFormInput label="Title" labelVisibility="visible" maxLength={160} name="title" required /><AdminFormTextarea label="Subtitle" labelVisibility="visible" maxLength={320} name="subtitle" required rows={3} /><AdminFormInput label="Thumbnail URL" labelVisibility="visible" name="imageUrl" placeholder="/images/news/article.jpg" /><AdminFormInput label="Thumbnail description" labelVisibility="visible" maxLength={320} name="imageAlt" /><AdminFormTextarea className="website-content-long-field" label="Article body" labelVisibility="visible" maxLength={50000} name="body" required rows={14} /></WebsiteContentActionForm> : <p className="muted">CONTENT_EDIT permission is required.</p>}</AdminSection>;
}

function NewsEditor({ canEdit, page, returnTo }: { canEdit: boolean; page: PublicSitePageDetail; returnTo: string }) {
  const draft = page.draftRevision;
  const article = draft?.sections.find((section) => section.key === 'article');
  if (!draft || !article) return <AdminNoticeCard tone="warning"><strong>Article Draft is unavailable</strong><p>The current Live article remains unchanged. Open or repair the Draft before editing.</p></AdminNoticeCard>;
  const content = article.content;
  return <AdminSection title="Article content" description="Saving edits only the Draft. Use SEO & publishing to review and publish."><WebsiteContentActionForm action={updatePublicSiteNewsArticleState} submitLabel="Save article Draft"><input name="pageId" type="hidden" value={page.id} /><input name="revisionId" type="hidden" value={draft.id} /><input name="expectedVersion" type="hidden" value={draft.version} /><input name="returnTo" type="hidden" value={`${returnTo}&workspace=content`} /><AdminFormSelect defaultValue={page.locale} disabled={!canEdit || Boolean(page.activeRevision)} label="Language" labelVisibility="visible" name="locale" options={publicSiteLocaleOptions} /><AdminFormInput defaultValue={page.path.replace(/^\/news\//u, '')} disabled={!canEdit || Boolean(page.activeRevision)} label="URL slug" labelVisibility="visible" name="slug" required /><AdminFormInput defaultValue={text(content.title)} disabled={!canEdit} label="Title" labelVisibility="visible" maxLength={160} name="title" required /><AdminFormTextarea defaultValue={text(content.subtitle)} disabled={!canEdit} label="Subtitle" labelVisibility="visible" maxLength={320} name="subtitle" required rows={3} /><AdminFormInput defaultValue={text(content.imageUrl)} disabled={!canEdit} label="Thumbnail URL" labelVisibility="visible" name="imageUrl" /><AdminFormInput defaultValue={text(content.imageAlt)} disabled={!canEdit} label="Thumbnail description" labelVisibility="visible" maxLength={320} name="imageAlt" /><AdminFormTextarea defaultValue={text(content.body)} disabled={!canEdit} label="Article body" labelVisibility="visible" maxLength={50000} name="body" required rows={16} /></WebsiteContentActionForm></AdminSection>;
}

function NewPageForm({ canEdit, returnTo }: { canEdit: boolean; returnTo: string }) {
  return <AdminSection title="Route identity" description="New routes start as Draft and stay hidden from search. Add content, verify preview, then publish separately.">{canEdit ? <WebsiteContentActionForm action={createPublicSitePageState} submitLabel="Create Draft route"><input name="returnTo" type="hidden" value={returnTo} /><AdminFormInput className="website-content-identity-field" label="Management page name · not shown to visitors" labelVisibility="visible" name="internalName" required /><AdminFormSelect defaultValue="MAIN" label="Website" labelVisibility="visible" name="site" options={publicSiteOptions} /><AdminFormSelect defaultValue="vi" label="Language" labelVisibility="visible" name="locale" options={publicSiteLocaleOptions} /><AdminFormInput label="Route path" labelVisibility="visible" name="path" pattern="/(?:[a-z0-9-]+|\[(?:city|district|slug)\])(?:/(?:[a-z0-9-]+|\[(?:city|district|slug)\]))*|/" placeholder="/about" required /><AdminFormInput label="SEO title" labelVisibility="visible" maxLength={160} name="seoTitle" /><AdminFormTextarea className="website-content-long-field" label="SEO description" labelVisibility="visible" maxLength={320} name="seoDescription" rows={3} /><AdminFormInput label="Canonical path" labelVisibility="visible" name="canonicalPath" placeholder="/about" /></WebsiteContentActionForm> : <p className="muted">CONTENT_EDIT permission is required.</p>}</AdminSection>;
}

async function permissions() {
  const access = await getCurrentAdminOperatorAccess();
  const lifecycleEnabled = cmsDestructiveLifecycleEnabled();
  return {
    view: hasAdminOperatorCategory(access, 'CONTENT_VIEW'),
    edit: hasAdminOperatorCategory(access, 'CONTENT_EDIT'),
    publish: lifecycleEnabled && hasAdminOperatorCategory(access, 'CONTENT_PUBLISH'),
    delete: lifecycleEnabled && hasAdminOperatorCategory(access, 'CONTENT_DELETE'),
    lifecycleEnabled,
  };
}

function CmsLifecycleModeNotice({ enabled }: { enabled: boolean }) {
  if (enabled) return null;
  return (
    <AdminNoticeCard className="admin-mb-16" tone="warning">
      <strong>Manual publication only</strong>
      <p>
        Draft editing and preview remain available. Publish, rollback, take offline, Draft discard,
        and route or section deletion are not active in this Admin launch; use the approved
        deployment runbook.
      </p>
    </AdminNoticeCard>
  );
}

function notice(status?: string, pageId?: string, params: Record<string, string | string[] | undefined> = {}, view: ContentView = 'pages') {
  const copy: Record<string, { tone: 'danger' | 'info' | 'success' | 'warning'; title: string; detail: string }> = {
    created: { tone: 'success', title: 'Draft route created', detail: 'Add content and review readiness before publishing.' },
    'draft-saved': { tone: 'success', title: 'Draft saved', detail: 'The current Live revision was not changed.' },
    'section-created': { tone: 'success', title: 'Draft section added', detail: 'Complete the section fields before publishing.' },
    'section-updated': { tone: 'success', title: 'Draft section saved', detail: 'The current Live revision was not changed.' },
    'news-draft-created': { tone: 'success', title: 'Article Draft created', detail: 'Review the preview before publishing.' },
    'news-draft-saved': { tone: 'success', title: 'Article Draft saved', detail: 'The Live article remains available.' },
    'draft-opened': { tone: 'success', title: 'Draft opened', detail: 'Edits now apply to a copy of the current Live revision.' },
    'draft-discarded': { tone: 'success', title: 'Draft discarded', detail: 'The current Live revision was not changed.' },
    published: { tone: 'success', title: 'Draft published', detail: 'The selected revision is now Live.' },
    'offline-fallback': { tone: 'warning', title: 'CMS page taken offline', detail: 'Visitors now receive the code fallback for this route.' },
    'offline-not-served': { tone: 'warning', title: 'CMS page taken offline', detail: 'Visitors now receive a not found response for this route.' },
    deleted: { tone: 'success', title: 'Draft route deleted', detail: 'The Draft-only route was permanently removed.' },
    'lifecycle-manual-only': { tone: 'warning', title: 'Manual publication only', detail: 'The destructive CMS lifecycle is not active in this Admin launch. No content state was changed.' },
    'rolled-back': { tone: 'success', title: 'Previous revision restored', detail: 'The restored revision is now Live.' },
    'cache-refreshed': { tone: 'success', title: 'Public cache refreshed', detail: 'The latest visitor state is available from every configured Public Web host.' },
    'cache-refresh-pending': { tone: 'danger', title: 'Public cache refresh still pending', detail: 'The content state is unchanged. Retry the cache refresh after checking Public Web availability.' },
    'draft-conflict': { tone: 'warning', title: 'Draft changed', detail: 'Reload and compare before saving again.' },
    'permission-denied': { tone: 'warning', title: 'Action not permitted', detail: 'Your operator role does not include this content action.' },
    'session-expired': { tone: 'warning', title: 'Session expired', detail: 'Sign in again before changing content.' },
    'validation-failed': { tone: 'warning', title: 'Content validation failed', detail: 'Review the entered values before trying again.' },
    'not-found': { tone: 'warning', title: 'Content changed or no longer exists', detail: 'Reload the current page before continuing.' },
    'rate-limited': { tone: 'warning', title: 'Too many requests', detail: 'Wait before trying this content action again.' },
    'temporary-failure': { tone: 'danger', title: 'Content service unavailable', detail: 'Reload the current state before retrying; the mutation result is uncertain.' },
    'invalid-content': { tone: 'warning', title: 'Content is invalid', detail: 'Correct the section fields or Advanced JSON and try again.' },
    failed: { tone: 'danger', title: 'Website content action failed', detail: 'No success was recorded. Reload the Draft before retrying.' },
  };
  if (status?.endsWith('-cache-pending')) {
    const completed = status.replace(/-cache-pending$/u, '');
    const completedCopy = copy[completed];
    const returnTo = listHref(workspaceQuery(params, { pageId, view, workspace: workspaceValue(params.workspace) }));
    return <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger"><strong>{completedCopy?.title ?? 'Content change saved'}; public cache refresh pending</strong><p>The database change succeeded, but one or more configured Public Web hosts did not confirm cache invalidation. Visitors may still see the prior state.</p>{pageId ? <form action={retryPublicSiteCacheInvalidation}><input name="pageId" type="hidden" value={pageId} /><input name="returnTo" type="hidden" value={returnTo} /><AdminFormControlButton className="button-secondary" type="submit">Retry cache refresh only</AdminFormControlButton></form> : null}</AdminNoticeCard>;
  }
  const item = status ? copy[status] : null;
  return item ? <AdminNoticeCard className="admin-mb-16" role="status" tone={item.tone}><strong>{item.title}</strong><p>{item.detail}</p></AdminNoticeCard> : null;
}

function publicUrl(page: PublicSitePageDetail) { const base = page.site === 'PARTNER_RECRUITMENT' ? publicRecruitmentUrl : publicMainUrl; return `${base.replace(/\/$/u, '')}/${page.locale}${page.path === '/' ? '' : page.path}`; }
function siteLabel(site: string) { return site === 'PARTNER_RECRUITMENT' ? 'join.hands.vn' : 'hands.vn'; }
function ownershipLabel(ownership: PublicSiteOwnership) { return ({ CMS_LIVE: 'CMS Live', CODE_FALLBACK: 'Code fallback', NOT_SERVED: 'Not served', OWNERSHIP_CONFLICT: 'Ownership conflict' } as const)[ownership]; }
function OwnershipBadge({ ownership }: { ownership: PublicSiteOwnership }) { return <StatusBadge tone={ownership === 'CMS_LIVE' ? 'success' : ownership === 'OWNERSHIP_CONFLICT' ? 'danger' : ownership === 'NOT_SERVED' ? 'warning' : 'neutral'}>{ownershipLabel(ownership)}</StatusBadge>; }
function sectionKindLabel(kind: string) { return publicSiteSectionKindOptions.find((option) => option.value === kind)?.label ?? kind; }
function draftReadinessIssues(draft: PublicSitePageDetail['draftRevision']) {
  const issues = readinessIssues(draft?.readinessIssues);
  if (draft && draft.readinessState !== 'READY' && issues.length === 0) {
    return ['Readiness has not been evaluated for this legacy Draft. Save the Draft before publishing.'];
  }
  return issues;
}
function draftChangeSummary(page: PublicSitePageDetail) {
  const draft = page.draftRevision;
  const live = page.activeRevision;
  if (!draft) return ['No Draft is open.'];
  if (!live) return [`New route with ${draft.sections.length} Draft sections.`, 'SEO and indexing will become Live for the first time.'];
  const changes: string[] = [];
  if (draft.seoTitle !== live.seoTitle) changes.push('SEO title changed.');
  if (draft.seoDescription !== live.seoDescription) changes.push('SEO description changed.');
  if (draft.canonicalPath !== live.canonicalPath) changes.push('Canonical path changed.');
  if (draft.noIndex !== live.noIndex) changes.push('Search indexing setting changed.');
  const liveSections = new Map(live.sections.map((section) => [section.key, section]));
  for (const section of draft.sections) {
    const previous = liveSections.get(section.key);
    if (!previous) {
      changes.push(`${section.key}: section added.`);
      continue;
    }
    const sectionChanges: string[] = [];
    if (previous.kind !== section.kind) sectionChanges.push('type');
    if (previous.enabled !== section.enabled) sectionChanges.push(section.enabled ? 'enabled' : 'disabled');
    if (previous.sortOrder !== section.sortOrder) sectionChanges.push('order');
    sectionChanges.push(...changedContentFields(previous.content, section.content));
    if (sectionChanges.length) changes.push(`${section.key}: ${sectionChanges.join(', ')} changed.`);
  }
  const removedSections = live.sections.filter((section) => !draft.sections.some((draftSection) => draftSection.key === section.key));
  for (const removed of removedSections) changes.push(`${removed.key}: section removed.`);
  return changes.length ? changes : ['No content or SEO differences detected.'];
}
function changedContentFields(previous: Record<string, unknown>, next: Record<string, unknown>) {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  return [...keys].filter((key) => stableJson(previous[key]) !== stableJson(next[key]));
}
function stableJson(input: unknown): string {
  if (Array.isArray(input)) return `[${input.map(stableJson).join(',')}]`;
  if (input && typeof input === 'object') return `{${Object.entries(input as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  return JSON.stringify(input) ?? 'undefined';
}
function latestRouteChange(group: PublicSiteRouteGroup) {
  return group.translations.reduce<string | null>((latest, page) => !latest || page.updatedAt > latest ? page.updatedAt : latest, null);
}
function auditActionLabel(action: string) {
  return ({ PUBLIC_SITE_DRAFT_PUBLISHED: 'Draft published', PUBLIC_SITE_REVISION_ROLLED_BACK: 'Previous revision restored', PUBLIC_SITE_PAGE_TAKEN_OFFLINE: 'Page taken offline', PUBLIC_SITE_PAGE_DELETED: 'Draft route deleted', PUBLIC_SITE_CACHE_INVALIDATION: 'Public cache refreshed' } as Record<string, string>)[action] ?? action.toLowerCase().replaceAll('_', ' ');
}
function auditMetadata(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const item = (metadata as Record<string, unknown>)[key];
  return typeof item === 'string' ? item : null;
}
function readinessLabel(state: string) { return state === 'UNKNOWN' ? 'Needs validation' : state === 'BLOCKED' ? 'Blocked' : 'Ready'; }
function titleCase(input: string) { return input.charAt(0).toUpperCase() + input.slice(1); }
function text(input: unknown) { return typeof input === 'string' ? input : ''; }
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input; }
function positivePage(input?: string) { const parsed = Number.parseInt(input ?? '', 10); return Number.isInteger(parsed) && parsed > 0 ? parsed : 1; }
function workspaceValue(input: string | string[] | undefined): Workspace { const item = value(input); return item === 'content' || item === 'publishing' || item === 'activity' ? item : 'overview'; }
function listHref(values: Record<string, string | string[] | undefined>) { const params = new URLSearchParams(); for (const [key, raw] of Object.entries(values)) { const item = value(raw); if (item) params.set(key, item); } const query = params.toString(); return `/website-content${query ? `?${query}` : ''}`; }
const listQueryKeys = ['view', 'site', 'locale', 'q', 'statusFilter', 'readiness', 'ownership', 'queue', 'routePage', 'mode'] as const;
const detailQueryKeys = ['view', 'pageId', 'workspace', 'sectionId', 'deleteSectionId', 'confirmPublish', 'discardDraft', 'deletePageId', 'rollbackRevisionId', 'takeOffline'] as const;
function listQuery(source: Record<string, string | string[] | undefined>, overrides: Record<string, string | undefined> = {}) { return allowedQuery(source, listQueryKeys, overrides); }
function detailQuery(source: Record<string, string | string[] | undefined>, overrides: Record<string, string | undefined> = {}) { return allowedQuery(source, detailQueryKeys, overrides); }
function workspaceQuery(source: Record<string, string | string[] | undefined>, overrides: { pageId?: string; view?: string; workspace: Workspace }) {
  const keys = overrides.workspace === 'content'
    ? ['view', 'pageId', 'workspace', 'sectionId', 'deleteSectionId', 'status'] as const
    : overrides.workspace === 'publishing'
      ? ['view', 'pageId', 'workspace', 'confirmPublish', 'status'] as const
      : overrides.workspace === 'activity'
        ? ['view', 'pageId', 'workspace', 'rollbackRevisionId', 'status'] as const
        : ['view', 'pageId', 'workspace', 'discardDraft', 'deletePageId', 'takeOffline', 'status'] as const;
  return allowedQuery(source, keys, overrides);
}
function allowedQuery(source: Record<string, string | string[] | undefined>, keys: readonly string[], overrides: Record<string, string | undefined>) {
  const result: Record<string, string | undefined> = {};
  for (const key of keys) result[key] = value(source[key]);
  return { ...result, ...overrides };
}
