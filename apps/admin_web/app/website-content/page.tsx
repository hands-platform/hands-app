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
import { adminGetResult } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../lib/admin-operator-access-model';
import {
  createPublicSiteNewsArticle,
  createPublicSitePage,
  createPublicSiteSection,
  deletePublicSitePage,
  deletePublicSiteSection,
  discardPublicSiteDraft,
  openPublicSiteDraft,
  publishPublicSiteDraft,
  rollbackPublicSiteRevision,
  updatePublicSiteNewsArticle,
  updatePublicSitePage,
  updatePublicSiteSection,
} from './actions';
import type {
  PublicSiteListResult,
  PublicSitePageDetail,
  PublicSitePageSummary,
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
  summary: { routes: 0, live: 0, draftChanges: 0, needsAttention: 0, missingTranslations: 0, recentlyPublished: 0 },
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
        actions={<AdminFormControlLink className="button-secondary" href={listHref({ ...params, pageId: undefined, workspace: undefined })}>Back to {view === 'news' ? 'News' : 'Pages'}</AdminFormControlLink>}
        contentClassName="website-content-workspace"
        description="Edit Draft content without interrupting the current Live website."
        title="Website Content"
      >
        {notice(value(params.status))}
        {!detailResult.ok || !detailResult.data ? (
          <AdminNoticeCard tone="danger"><strong>Page details could not be loaded.</strong><p>Retry before editing or publishing this route.</p></AdminNoticeCard>
        ) : (
          <PageWorkspace
            can={can}
            page={detailResult.data}
            params={params}
            preview={previewResult.ok ? previewResult.data : null}
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
        actions={<AdminFormControlLink className="button-secondary" href={listHref({ ...params, mode: undefined })}>Cancel</AdminFormControlLink>}
        contentClassName="website-content-workspace"
        description={view === 'news' ? 'Create a complete article Draft. Publishing is a separate reviewed action.' : 'Create a Draft-only route. It remains unavailable to the public until published.'}
        title={view === 'news' ? 'New article' : 'New page'}
      >
        {view === 'news' ? <NewsDraftForm canEdit={can.edit} returnTo={listHref(params)} /> : <NewPageForm canEdit={can.edit} returnTo={listHref(params)} />}
      </AdminPageTemplate>
    );
  }

  return ContentDirectory({ canCreate: can.edit, params, view });
}

async function ContentDirectory({ canCreate, params, view }: { canCreate: boolean; params: Record<string, string | string[] | undefined>; view: ContentView }) {
  const api = new URLSearchParams({ contentType: view, page: positivePage(value(params.routePage)).toString(), take: '20' });
  for (const key of ['site', 'locale', 'q']) {
    const item = value(params[key]);
    if (item) api.set(key, item);
  }
  const statusFilter = value(params.statusFilter);
  if (['all', 'live', 'draft', 'attention'].includes(statusFilter ?? '')) api.set('status', statusFilter!);
  const fallback = view === 'pages' ? emptyList<PublicSiteRouteGroup>() : emptyList<PublicSitePageSummary>();
  const result = await adminGetResult<typeof fallback>(`/admin/site-pages?${api}`, fallback);
  const summary = result.data.summary;
  const hasFilters = Boolean(value(params.site) || value(params.locale) || value(params.q) || statusFilter);

  return (
    <AdminPageTemplate
      actions={canCreate ? <AdminFormControlLink className="button-primary" href={listHref({ ...params, view, mode: 'new' })}>{view === 'news' ? 'New article' : 'New page'}</AdminFormControlLink> : null}
      contentClassName="website-content-directory"
      description="Operate Live routes, Draft changes, publishing readiness and translation coverage."
      metrics={result.ok && summary ? [
        { label: 'Live', value: summary.live, scope: 'Active revisions', helper: 'Routes currently available to the public.' },
        { label: 'Draft changes', value: summary.draftChanges, scope: 'Unpublished work', helper: 'Routes with an editable Draft revision.' },
        { label: 'Needs attention', value: summary.needsAttention, scope: 'Blocked Drafts', helper: 'Drafts that do not pass publishing readiness.' },
        { label: 'Missing translations', value: summary.missingTranslations, scope: 'Required languages', helper: 'Page routes missing one or more KO, EN, VI, JA or ZH versions.' },
        { label: 'Recently published', value: summary.recentlyPublished, scope: 'Last 7 days', helper: 'Routes activated during the latest seven days.' },
      ] : []}
      metricsClassName="website-content-summary-grid"
      title="Website Content"
    >
      {notice(value(params.status))}
      {result.ok && !summary ? <AdminNoticeCard tone="warning"><strong>Content summary is unavailable</strong><p>The route list is still available. Retry before using summary counts for publishing work.</p></AdminNoticeCard> : null}
      <nav aria-label="Website content type" className="website-content-tabs">
        <Link aria-current={view === 'pages' ? 'page' : undefined} href={listHref({ view: 'pages' })} prefetch={false}>Pages</Link>
        <Link aria-current={view === 'news' ? 'page' : undefined} href={listHref({ view: 'news' })} prefetch={false}>News</Link>
      </nav>
      <AdminSection className="admin-mb-16" title="Filters" description="Search and pagination run on the server; section content is loaded only after opening a route.">
        <form action="/website-content" className="website-content-filter-grid">
          <input name="view" type="hidden" value={view} />
          <AdminFormInput defaultValue={value(params.q)} label="Name or route" labelVisibility="visible" name="q" type="search" />
          <AdminFormSelect defaultValue={value(params.site) ?? ''} label="Website" labelVisibility="visible" name="site" options={[{ label: 'All websites', value: '' }, ...publicSiteOptions]} />
          <AdminFormSelect defaultValue={value(params.locale) ?? ''} label="Language" labelVisibility="visible" name="locale" options={[{ label: 'All languages', value: '' }, ...publicSiteLocaleOptions]} />
          <AdminFormSelect defaultValue={statusFilter ?? 'all'} label="Status" labelVisibility="visible" name="statusFilter" options={[{ label: 'All states', value: 'all' }, { label: 'Live', value: 'live' }, { label: 'Draft changes', value: 'draft' }, { label: 'Needs attention', value: 'attention' }]} />
          <AdminFormActionRow className="website-content-filter-actions" wide={false}>
            <AdminFormControlButton className="button-primary" type="submit">Apply</AdminFormControlButton>
            <AdminFormControlLink className="button-secondary" href={listHref({ view })}>Clear filters</AdminFormControlLink>
          </AdminFormActionRow>
        </form>
      </AdminSection>
      {!result.ok ? (
        <AdminNoticeCard tone="danger"><strong>{view === 'news' ? 'News could not be loaded' : 'Pages could not be loaded'}</strong><p>Retry this view. The result is unavailable, not an empty content library.</p><AdminFormControlLink className="button-secondary" href={listHref(params)}>Retry</AdminFormControlLink></AdminNoticeCard>
      ) : (
        <AdminSection statusLabel={`${result.data.total} ${view === 'news' ? 'articles' : 'route groups'}`} title={view === 'news' ? 'News articles' : 'Managed pages'}>
          {view === 'pages' ? <PageGroupTable groups={result.data.items as PublicSiteRouteGroup[]} params={params} hasFilters={hasFilters} /> : <NewsTable pages={result.data.items as PublicSitePageSummary[]} params={params} hasFilters={hasFilters} />}
          <AdminTablePaginationFooter
            activePage={result.data.page}
            ariaLabel={`${view === 'news' ? 'News' : 'Page route'} pages`}
            from={result.data.total ? (result.data.page - 1) * result.data.take + 1 : 0}
            hrefForPage={(page) => listHref({ ...params, routePage: page > 1 ? String(page) : undefined })}
            itemLabel={view === 'news' ? 'articles' : 'route groups'}
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
    <AdminTableScroll ariaLabel="Website route groups">
      <AdminDataTable
        className="website-content-route-table"
        emptyMessage={<AdminEmptyState message={hasFilters ? 'Clear filters to return to all managed pages.' : 'Create the first Draft route.'} title={hasFilters ? 'No pages match these filters' : 'No managed pages yet'} />}
        headers={['Route', 'Website', 'KO', 'EN', 'VI', 'JA', 'ZH']}
        rowCount={groups.length}
      >
        {groups.map((group) => <tr key={group.groupKey}><td><strong>{group.translations[0]?.internalName ?? group.path}</strong><code>{group.path}</code></td><td className="website-content-domain">{siteLabel(group.site)}</td>{['ko', 'en', 'vi', 'ja', 'zh'].map((locale) => <td key={locale}><LocaleCell page={group.translations.find((item) => item.locale === locale)} params={params} /></td>)}</tr>)}
      </AdminDataTable>
    </AdminTableScroll>
  );
}

function LocaleCell({ page, params }: { page?: PublicSitePageSummary; params: Record<string, string | string[] | undefined> }) {
  if (!page) return <span className="muted">Missing</span>;
  const state = page.draftRevision?.readinessState !== 'READY' ? 'Needs content' : page.draftRevision ? 'Draft changes' : page.activeRevision ? 'Live' : 'Draft';
  return <AdminFormControlLink className="website-content-locale-link" href={listHref({ ...params, pageId: page.id, workspace: 'overview' })}><StatusBadge tone={state === 'Live' ? 'success' : state === 'Needs content' ? 'warning' : 'neutral'}>{state}</StatusBadge></AdminFormControlLink>;
}

function NewsTable({ pages, params, hasFilters }: { pages: PublicSitePageSummary[]; params: Record<string, string | string[] | undefined>; hasFilters: boolean }) {
  return (
    <AdminTableScroll ariaLabel="News article list">
      <AdminDataTable emptyMessage={<AdminEmptyState message={hasFilters ? 'Clear filters to return to all articles.' : 'Create the first article Draft.'} title={hasFilters ? 'No news matches these filters' : 'No news articles yet'} />} headers={['Article', 'Website', 'Language', 'Live', 'Draft', 'Updated', 'Action']} rowCount={pages.length}>
        {pages.map((page) => <tr key={page.id}><td><strong>{page.internalName.replace(/^News:\s*/u, '')}</strong><code>{page.path}</code></td><td className="website-content-domain">{siteLabel(page.site)}</td><td>{page.locale.toUpperCase()}</td><td>{page.activeRevision ? <StatusBadge tone="success">Live</StatusBadge> : <span className="muted">Not live</span>}</td><td>{page.draftRevision ? <StatusBadge tone={page.draftRevision.readinessState === 'READY' ? 'neutral' : 'warning'}>{page.draftRevision.readinessState === 'READY' ? 'Ready' : 'Needs content'}</StatusBadge> : <span className="muted">No changes</span>}</td><td><DateTimeText value={page.draftRevision?.updatedAt ?? page.updatedAt} /></td><td><AdminFormControlLink className="button-secondary" href={listHref({ ...params, pageId: page.id, workspace: 'overview' })}>Edit article</AdminFormControlLink></td></tr>)}
      </AdminDataTable>
    </AdminTableScroll>
  );
}

function PageWorkspace({ can, page, params, preview, view, workspace }: { can: Awaited<ReturnType<typeof permissions>>; page: PublicSitePageDetail; params: Record<string, string | string[] | undefined>; preview: PublicSitePreviewLink | null; view: ContentView; workspace: Workspace }) {
  const draft = page.draftRevision;
  const live = page.activeRevision;
  const base = listHref({
    ...params,
    pageId: page.id,
    view,
    workspace: undefined,
    confirmPublish: undefined,
    discardDraft: undefined,
    deletePageId: undefined,
    deleteSectionId: undefined,
    rollbackRevisionId: undefined,
    sectionId: undefined,
  });
  const liveHref = publicUrl(page);
  const previewHref = preview ? `${liveHref}${liveHref.includes('?') ? '&' : '?'}cmsPreview=${encodeURIComponent(preview.token)}` : null;
  const deletingPage = value(params.deletePageId) === page.id;
  const discardingDraft = value(params.discardDraft) === '1';
  const confirmingPublish = value(params.confirmPublish) === '1';
  const deletingSection = draft?.sections.find((section) => section.id === value(params.deleteSectionId));
  const rollback = page.revisions.find((revision) => revision.id === value(params.rollbackRevisionId));
  const section = draft?.sections.find((item) => item.id === value(params.sectionId));
  const publishIssues = draftReadinessIssues(draft);
  const changes = draftChangeSummary(page);

  return <>
    {deletingPage ? <ConfirmDialog action={deletePublicSitePage} cancelHref={base} confirmLabel="Delete Draft route" description={`Delete ${page.internalName}. Live routes cannot be deleted.`} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'confirmationId', value: page.id }, { name: 'returnTo', value: base }]} id={`delete-page-${page.id}`} title="Delete Draft route?" /> : null}
    {discardingDraft && draft && live && can.edit ? <ConfirmDialog action={discardPublicSiteDraft} cancelHref={`${base}&workspace=${workspace}`} confirmLabel="Discard Draft changes" description={`Discard Draft revision ${draft.revisionNumber}. The current Live revision ${live.revisionNumber} will remain unchanged.`} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'confirmationId', value: page.id }, { name: 'returnTo', value: `${base}&workspace=${workspace}` }]} id={`discard-draft-${page.id}`} title="Discard this Draft?" /> : null}
    {confirmingPublish && draft && can.publish ? <ConfirmDialog action={publishPublicSiteDraft} cancelHref={`${base}&workspace=publishing#publish-draft`} confirmLabel={`Publish revision ${draft.revisionNumber}`} description={<div className="website-content-confirm-summary"><p>Readiness is checked again before the active revision switches.</p><dl><div><dt>Website</dt><dd>{siteLabel(page.site)}</dd></div><div><dt>Language</dt><dd>{page.locale.toUpperCase()}</dd></div><div><dt>Public URL</dt><dd>{liveHref}</dd></div><div><dt>Revision change</dt><dd>{live ? `${live.revisionNumber} → ${draft.revisionNumber}` : `Not live → ${draft.revisionNumber}`}</dd></div><div><dt>Canonical</dt><dd>{draft.canonicalPath ?? page.path}</dd></div><div><dt>Search indexing</dt><dd>{draft.noIndex ? 'Hidden from search engines' : 'Eligible for search indexing'}</dd></div><div><dt>Translation coverage</dt><dd>Verify the KO/EN/VI/JA/ZH matrix before publishing.</dd></div></dl><strong>Draft changes</strong><ul>{changes.map((change) => <li key={change}>{change}</li>)}</ul>{publishIssues.length ? <><strong>Blocking issues</strong><ul>{publishIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></> : null}</div>} disabled={draft.readinessState !== 'READY'} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'revisionId', value: draft.id }, { name: 'expectedVersion', value: draft.version }, { name: 'returnTo', value: `${base}&workspace=publishing` }]} id={`publish-draft-${draft.id}`} title="Publish this Draft?" tone="warning" /> : null}
    {deletingSection ? <ConfirmDialog action={deletePublicSiteSection} cancelHref={base} confirmLabel="Delete section" description={`Delete ${deletingSection.key} from this Draft.`} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'sectionId', value: deletingSection.id }, { name: 'confirmationId', value: deletingSection.id }, { name: 'returnTo', value: base }]} id={`delete-section-${deletingSection.id}`} title="Delete Draft section?" /> : null}
    {rollback && can.publish ? <ConfirmDialog action={rollbackPublicSiteRevision} cancelHref={base} confirmLabel={`Restore revision ${rollback.revisionNumber}`} description={<div className="website-content-confirm-summary"><p>The selected previous Live revision will become current. The existing Live revision remains in history.</p><dl><div><dt>Public URL</dt><dd>{liveHref}</dd></div><div><dt>Current Live</dt><dd>{live ? `Revision ${live.revisionNumber}` : 'Not live'}</dd></div><div><dt>Restore</dt><dd>Revision {rollback.revisionNumber}</dd></div><div><dt>Previously published</dt><dd>{rollback.publishedAt ? <DateTimeText value={rollback.publishedAt} /> : 'Not recorded'}</dd></div><div><dt>Publisher</dt><dd>{rollback.publishedById ?? 'Unknown'}</dd></div><div><dt>SEO title</dt><dd>{rollback.seoTitle ?? 'Not set'}</dd></div></dl></div>} hiddenInputs={[{ name: 'pageId', value: page.id }, { name: 'revisionId', value: rollback.id }, { name: 'returnTo', value: base }]} id={`rollback-${rollback.id}`} title="Restore previous Live revision?" /> : null}
    <AdminCard className="website-content-route-brief" ariaLabel="Route status"><div><span>Website</span><strong>{siteLabel(page.site)}</strong></div><div><span>Language</span><strong>{page.locale.toUpperCase()}</strong></div><div><span>Public URL</span><a href={liveHref} rel="noreferrer" target="_blank">{liveHref}</a></div><div><span>Live</span>{live ? <StatusBadge tone="success">Revision {live.revisionNumber}</StatusBadge> : <StatusBadge tone="neutral">Not live</StatusBadge>}</div><div><span>Draft</span>{draft ? <StatusBadge tone={draft.readinessState === 'READY' ? 'success' : 'warning'}>{draft.readinessState === 'READY' ? `Ready · v${draft.version}` : 'Needs content'}</StatusBadge> : <StatusBadge tone="neutral">No changes</StatusBadge>}</div></AdminCard>
    <div className="website-content-workspace-actions">{!draft && live && can.edit ? <form action={openPublicSiteDraft}><input name="pageId" type="hidden" value={page.id} /><input name="returnTo" type="hidden" value={`${base}&workspace=${workspace}`} /><AdminFormControlButton className="button-secondary" type="submit">Open Draft</AdminFormControlButton></form> : null}{previewHref ? <a className="button-secondary" href={previewHref} rel="noreferrer" target="_blank">Preview Draft</a> : null}{live ? <a className="button-secondary" href={liveHref} rel="noreferrer" target="_blank">Open Live page</a> : null}{draft && can.publish ? <AdminFormControlLink className="button-primary" href={`${base}&workspace=publishing#publish-draft`}>Review Publish</AdminFormControlLink> : null}</div>
    <nav aria-label="Page workspace" className="website-content-tabs">{(['overview', 'content', 'publishing', 'activity'] as Workspace[]).map((item) => <Link aria-current={workspace === item ? 'page' : undefined} href={listHref({ ...params, pageId: page.id, workspace: item })} key={item} prefetch={false}>{item === 'publishing' ? 'SEO & publishing' : titleCase(item)}</Link>)}</nav>
    {!can.edit ? <AdminNoticeCard tone="info"><strong>View-only access</strong><p>CONTENT_EDIT is required to save Draft changes. Publishing and deletion require separate permissions.</p></AdminNoticeCard> : null}
    {workspace === 'overview' ? <Overview canEdit={can.edit} page={page} previewHref={previewHref} liveHref={liveHref} returnTo={base} /> : null}
    {workspace === 'content' ? (page.path.startsWith('/news/') ? <NewsEditor canEdit={can.edit} page={page} returnTo={base} /> : <ContentEditor canDelete={can.delete} canEdit={can.edit} page={page} returnTo={base} selected={section} />) : null}
    {workspace === 'publishing' ? <Publishing canEdit={can.edit} canPublish={can.publish} page={page} returnTo={base} /> : null}
    {workspace === 'activity' ? <Activity canPublish={can.publish} page={page} returnTo={base} /> : null}
    {can.delete && !live ? <AdminSection className="website-content-danger-zone" title="Delete Draft route" description="Only routes that have never been Live can be deleted."><AdminFormControlLink className="button-danger" href={`${base}&deletePageId=${encodeURIComponent(page.id)}`}>Review deletion</AdminFormControlLink></AdminSection> : null}
  </>;
}

function Overview({ canEdit, page, previewHref, liveHref, returnTo }: { canEdit: boolean; page: PublicSitePageDetail; previewHref: string | null; liveHref: string; returnTo: string }) {
  const issues = draftReadinessIssues(page.draftRevision);
  return <div className="website-content-overview-grid"><AdminSection title="Current state" description={page.activeRevision ? 'Live continues serving while Draft changes are edited.' : 'This route remains private until a publisher activates a ready Draft.'}><dl className="website-content-facts"><div><dt>Current Live</dt><dd>{page.activeRevision ? `Revision ${page.activeRevision.revisionNumber}` : 'Not published'}</dd></div><div><dt>Draft changes</dt><dd>{page.draftRevision ? `Revision ${page.draftRevision.revisionNumber} · version ${page.draftRevision.version}` : 'No open Draft'}</dd></div><div><dt>Last published</dt><dd>{page.activeRevision?.publishedAt ? <DateTimeText value={page.activeRevision.publishedAt} /> : 'Never'}</dd></div><div><dt>Draft updated</dt><dd>{page.draftRevision ? <DateTimeText value={page.draftRevision.updatedAt} /> : 'Not applicable'}</dd></div></dl>{page.draftRevision && page.activeRevision && canEdit ? <div className="website-content-inline-actions"><AdminFormControlLink className="button-secondary" href={`${returnTo}&workspace=overview&discardDraft=1`}>Review Draft discard</AdminFormControlLink></div> : null}</AdminSection><AdminSection title="Publishing readiness" statusLabel={page.draftRevision?.readinessState ?? 'NO DRAFT'} statusTone={issues.length ? 'warning' : 'success'}>{issues.length ? <ul className="website-content-issue-list">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>{page.draftRevision ? 'This Draft passes the shared renderer readiness checks.' : 'Open a Draft copied from the current Live revision before editing.'}</p>}<div className="website-content-inline-actions">{previewHref ? <a className="text-link" href={previewHref} rel="noreferrer" target="_blank">Preview Draft</a> : null}{page.activeRevision ? <a className="text-link" href={liveHref} rel="noreferrer" target="_blank">Open Live page</a> : null}</div></AdminSection></div>;
}

function ContentEditor({ canDelete, canEdit, page, returnTo, selected }: { canDelete: boolean; canEdit: boolean; page: PublicSitePageDetail; returnTo: string; selected?: PublicSiteSection }) {
  const draft = page.draftRevision;
  if (!draft) return <AdminNoticeCard tone="info"><strong>No open Draft</strong><p>Use Open Draft above to copy the current Live revision before editing content.</p></AdminNoticeCard>;
  return <div className="website-content-editor-layout"><AdminSection title="Draft sections" description="Edit one section at a time. Move order with numeric sort order; raw JSON is optional."><ol className="website-content-section-list">{draft.sections.map((item) => <li key={item.id}><div><strong>{item.key}</strong><span>{sectionKindLabel(item.kind)} · {item.enabled ? 'Visible in Draft' : 'Hidden in Draft'}</span></div><div><AdminFormControlLink className="button-secondary" href={`${returnTo}&workspace=content&sectionId=${encodeURIComponent(item.id)}`}>Edit</AdminFormControlLink>{canDelete ? <AdminFormControlLink className="button-secondary" href={`${returnTo}&workspace=content&deleteSectionId=${encodeURIComponent(item.id)}`}>Delete</AdminFormControlLink> : null}</div></li>)}</ol>{canEdit ? <AdminDisclosure className="website-content-disclosure"><summary>Add section</summary><AdminFormGrid action={createPublicSiteSection}><input name="pageId" type="hidden" value={page.id} /><input name="returnTo" type="hidden" value={`${returnTo}&workspace=content`} /><AdminFormInput label="Section key" labelVisibility="visible" name="key" placeholder="hero" required /><AdminFormSelect defaultValue="APP_OVERVIEW" label="Section type" labelVisibility="visible" name="kind" options={publicSiteSectionKindOptions} /><AdminFormInput defaultValue={String(draft.sections.length * 10)} label="Sort order" labelVisibility="visible" name="sortOrder" type="number" /><AdminFormActionRow><AdminFormControlButton className="button-primary" type="submit">Add to Draft</AdminFormControlButton></AdminFormActionRow></AdminFormGrid></AdminDisclosure> : null}</AdminSection>{selected ? <SectionEditor canEdit={canEdit} page={page} returnTo={returnTo} section={selected} /> : <AdminSection title="Section editor" description="Choose a Draft section to edit its visible fields."><AdminEmptyState title="No section selected" message="Select Edit beside a section." /></AdminSection>}</div>;
}

function SectionEditor({ canEdit, page, returnTo, section }: { canEdit: boolean; page: PublicSitePageDetail; returnTo: string; section: PublicSiteSection }) {
  const content = section.content;
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
      title={`Edit ${section.key}`}
      statusLabel={page.draftRevision?.readinessState ?? 'UNKNOWN'}
      statusTone={page.draftRevision?.readinessState === 'READY' ? 'success' : 'warning'}
    >
      <AdminFormGrid action={updatePublicSiteSection}>
        <input name="pageId" type="hidden" value={page.id} />
        <input name="sectionId" type="hidden" value={section.id} />
        <input name="expectedVersion" type="hidden" value={page.draftRevision?.version} />
        <input name="returnTo" type="hidden" value={`${returnTo}&workspace=content&sectionId=${encodeURIComponent(section.id)}`} />
        {section.kind !== 'FAQ' && items.length ? <input name="itemsJson" type="hidden" value={JSON.stringify(items)} /> : null}
        <AdminFormInput defaultValue={section.key} disabled={!canEdit} label="Section key" labelVisibility="visible" name="key" required />
        <AdminFormSelect defaultValue={section.kind} disabled={!canEdit} label="Section type" labelVisibility="visible" name="kind" options={publicSiteSectionKindOptions} />
        <AdminFormInput defaultValue={text(content.eyebrow)} disabled={!canEdit} label="Eyebrow" labelVisibility="visible" name="eyebrow" />
        <AdminFormInput defaultValue={text(content.title)} disabled={!canEdit} label="Title" labelVisibility="visible" name="title" />
        <AdminFormTextarea defaultValue={text(content.subtitle)} disabled={!canEdit} label="Subtitle" labelVisibility="visible" name="subtitle" rows={2} />
        <AdminFormTextarea defaultValue={text(content.body)} disabled={!canEdit} label="Body" labelVisibility="visible" name="body" rows={8} />
        {section.kind === 'FAQ' ? <AdminFormTextarea defaultValue={faqItems} disabled={!canEdit} label="Questions and answers · one Question | Answer pair per line" labelVisibility="visible" name="faqItems" rows={10} required /> : null}
        <AdminFormInput defaultValue={text(content.imageUrl)} disabled={!canEdit} label="Image URL · relative path or HTTPS" labelVisibility="visible" name="imageUrl" placeholder="/images/example.jpg or https://..." />
        <AdminFormInput defaultValue={text(content.actionLabel)} disabled={!canEdit} label="Action label" labelVisibility="visible" name="actionLabel" />
        <AdminFormInput defaultValue={text(content.actionHref)} disabled={!canEdit} label="Action URL · relative path or HTTPS" labelVisibility="visible" name="actionHref" placeholder="/path or https://..." />
        <AdminFormInput defaultValue={String(section.sortOrder)} disabled={!canEdit} label="Sort order" labelVisibility="visible" name="sortOrder" type="number" />
        <AdminFormCheckbox defaultChecked={section.enabled} disabled={!canEdit} label="Draft visibility" name="enabled">Show this section in the Draft</AdminFormCheckbox>
        <AdminDisclosure className="website-content-disclosure form-grid-wide">
          <summary>Advanced JSON</summary>
          <p className="muted">Select the override only when the field editor cannot represent the required structure.</p>
          <AdminFormCheckbox disabled={!canEdit} label="Advanced mode" name="useAdvancedJson">Replace the field values above with this JSON</AdminFormCheckbox>
          <AdminFormTextarea defaultValue={JSON.stringify(content, null, 2)} disabled={!canEdit} label="Section JSON" labelVisibility="visible" name="advancedContentJson" rows={14} />
        </AdminDisclosure>
        {canEdit ? <AdminFormActionRow><AdminFormControlButton className="button-primary" type="submit">Save Draft section</AdminFormControlButton></AdminFormActionRow> : null}
      </AdminFormGrid>
    </AdminSection>
  );
}

function Publishing({ canEdit, canPublish, page, returnTo }: { canEdit: boolean; canPublish: boolean; page: PublicSitePageDetail; returnTo: string }) {
  const draft = page.draftRevision;
  const issues = draftReadinessIssues(draft);
  return <div className="website-content-publishing-grid"><AdminSection title="SEO & indexing" description={page.activeRevision ? 'Route identity is locked while this URL is Live. SEO edits update the Draft only.' : 'The route remains Draft-only until a publisher activates it.'}>{draft ? <AdminFormGrid action={updatePublicSitePage}><input name="pageId" type="hidden" value={page.id} /><input name="expectedVersion" type="hidden" value={draft.version} /><input name="returnTo" type="hidden" value={`${returnTo}&workspace=publishing`} /><AdminFormInput defaultValue={page.internalName} disabled={!canEdit} label="Operator label" labelVisibility="visible" name="internalName" required /><AdminFormInput defaultValue={draft.seoTitle ?? ''} disabled={!canEdit} label="SEO title" labelVisibility="visible" maxLength={160} name="seoTitle" /><AdminFormTextarea defaultValue={draft.seoDescription ?? ''} disabled={!canEdit} label="SEO description" labelVisibility="visible" maxLength={320} name="seoDescription" rows={3} /><AdminFormInput defaultValue={draft.canonicalPath ?? page.path} disabled={!canEdit} label="Canonical path" labelVisibility="visible" name="canonicalPath" /><AdminFormCheckbox defaultChecked={draft.noIndex} disabled={!canEdit} label="Search indexing" name="noIndex">Ask search engines not to show this live page in results.</AdminFormCheckbox>{canEdit ? <AdminFormActionRow><AdminFormControlButton className="button-primary" type="submit">Save Draft changes</AdminFormControlButton></AdminFormActionRow> : null}</AdminFormGrid> : <p>No Draft is open. Use Open Draft above before changing SEO.</p>}</AdminSection><AdminSection id="publish-draft" title="Publish Draft" description="Publishing validates readiness and switches the active revision in one transaction." statusLabel={draft?.readinessState ?? 'NO DRAFT'} statusTone={issues.length ? 'warning' : 'success'}>{issues.length ? <ul className="website-content-issue-list">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>{draft ? `Draft revision ${draft.revisionNumber}, version ${draft.version}, is ready for review.` : 'There is no Draft to publish.'}</p>}{draft && canPublish ? <AdminFormControlLink className="button-primary" aria-disabled={issues.length > 0 ? 'true' : undefined} href={issues.length > 0 ? `${returnTo}&workspace=publishing#publish-draft` : `${returnTo}&workspace=publishing&confirmPublish=1#publish-draft`}>Review and publish revision {draft.revisionNumber}</AdminFormControlLink> : draft ? <p className="muted">CONTENT_PUBLISH permission is required.</p> : null}</AdminSection></div>;
}

function Activity({ canPublish, page, returnTo }: { canPublish: boolean; page: PublicSitePageDetail; returnTo: string }) {
  const revisions = page.revisions;
  return <AdminSection title="Revision history" description="Only revisions that were previously Live are eligible for rollback."><AdminTableScroll ariaLabel="Website revision history"><AdminDataTable emptyMessage="No published revision history." headers={['Revision', 'State', 'Readiness', 'Published', 'Publisher', 'Action']} rowCount={revisions.length}>{revisions.map((revision) => <tr key={revision.id}><td><strong>Revision {revision.revisionNumber}</strong><span className="muted">Version {revision.version}</span></td><td><StatusBadge tone={revision.state === 'ACTIVE' ? 'success' : 'neutral'}>{revision.state === 'ACTIVE' ? 'Current Live' : 'Previous Live'}</StatusBadge></td><td>{revision.readinessState}</td><td>{revision.publishedAt ? <DateTimeText value={revision.publishedAt} /> : 'Not recorded'}</td><td><code>{revision.publishedById ?? 'Unknown'}</code></td><td>{revision.state === 'ARCHIVED' && canPublish ? <AdminFormControlLink className="button-secondary" href={`${returnTo}&workspace=activity&rollbackRevisionId=${encodeURIComponent(revision.id)}`}>Review rollback</AdminFormControlLink> : <span className="muted">Current</span>}</td></tr>)}</AdminDataTable></AdminTableScroll></AdminSection>;
}

function NewsDraftForm({ canEdit, returnTo }: { canEdit: boolean; returnTo: string }) {
  return <AdminSection title="Article Draft" description="Slug uses lowercase letters, numbers and hyphens. Final URL: hands.vn/{language}/news/{slug}"><AdminFormGrid action={createPublicSiteNewsArticle}><input name="returnTo" type="hidden" value={returnTo} /><AdminFormSelect defaultValue="vi" disabled={!canEdit} label="Language" labelVisibility="visible" name="locale" options={publicSiteLocaleOptions} /><AdminFormInput disabled={!canEdit} label="URL slug" labelVisibility="visible" name="slug" placeholder="welcome-to-hands" required /><AdminFormInput disabled={!canEdit} label="Title" labelVisibility="visible" maxLength={160} name="title" required /><AdminFormTextarea disabled={!canEdit} label="Subtitle" labelVisibility="visible" maxLength={320} name="subtitle" required rows={3} /><AdminFormInput disabled={!canEdit} label="Thumbnail URL" labelVisibility="visible" name="imageUrl" placeholder="/images/news/article.jpg" /><AdminFormTextarea disabled={!canEdit} label="Article body" labelVisibility="visible" maxLength={50000} name="body" required rows={14} />{canEdit ? <AdminFormActionRow><AdminFormControlButton className="button-primary" type="submit">Save article Draft</AdminFormControlButton></AdminFormActionRow> : null}</AdminFormGrid></AdminSection>;
}

function NewsEditor({ canEdit, page, returnTo }: { canEdit: boolean; page: PublicSitePageDetail; returnTo: string }) {
  const draft = page.draftRevision;
  const article = draft?.sections.find((section) => section.key === 'article');
  if (!draft || !article) return <AdminNoticeCard tone="warning"><strong>Article Draft is unavailable</strong><p>The current Live article remains unchanged. Open or repair the Draft before editing.</p></AdminNoticeCard>;
  const content = article.content;
  return <AdminSection title="Article content" description="Saving edits only the Draft. Use SEO & publishing to review and publish."><AdminFormGrid action={updatePublicSiteNewsArticle}><input name="pageId" type="hidden" value={page.id} /><input name="revisionId" type="hidden" value={draft.id} /><input name="expectedVersion" type="hidden" value={draft.version} /><input name="returnTo" type="hidden" value={`${returnTo}&workspace=content`} /><AdminFormSelect defaultValue={page.locale} disabled={!canEdit || Boolean(page.activeRevision)} label="Language" labelVisibility="visible" name="locale" options={publicSiteLocaleOptions} /><AdminFormInput defaultValue={page.path.replace(/^\/news\//u, '')} disabled={!canEdit || Boolean(page.activeRevision)} label="URL slug" labelVisibility="visible" name="slug" required /><AdminFormInput defaultValue={text(content.title)} disabled={!canEdit} label="Title" labelVisibility="visible" maxLength={160} name="title" required /><AdminFormTextarea defaultValue={text(content.subtitle)} disabled={!canEdit} label="Subtitle" labelVisibility="visible" maxLength={320} name="subtitle" required rows={3} /><AdminFormInput defaultValue={text(content.imageUrl)} disabled={!canEdit} label="Thumbnail URL" labelVisibility="visible" name="imageUrl" /><AdminFormTextarea defaultValue={text(content.body)} disabled={!canEdit} label="Article body" labelVisibility="visible" maxLength={50000} name="body" required rows={16} />{canEdit ? <AdminFormActionRow><AdminFormControlButton className="button-primary" type="submit">Save article Draft</AdminFormControlButton></AdminFormActionRow> : null}</AdminFormGrid></AdminSection>;
}

function NewPageForm({ canEdit, returnTo }: { canEdit: boolean; returnTo: string }) {
  return <AdminSection title="Route identity" description="New routes start as Draft and stay hidden from search. Add content, verify preview, then publish separately."><AdminFormGrid action={createPublicSitePage}><input name="returnTo" type="hidden" value={returnTo} /><AdminFormSelect defaultValue="MAIN" disabled={!canEdit} label="Website" labelVisibility="visible" name="site" options={publicSiteOptions} /><AdminFormSelect defaultValue="vi" disabled={!canEdit} label="Language" labelVisibility="visible" name="locale" options={publicSiteLocaleOptions} /><AdminFormInput disabled={!canEdit} label="Route path" labelVisibility="visible" name="path" placeholder="/about" required /><AdminFormInput disabled={!canEdit} label="Operator label" labelVisibility="visible" name="internalName" required /><AdminFormInput disabled={!canEdit} label="SEO title" labelVisibility="visible" name="seoTitle" /><AdminFormTextarea disabled={!canEdit} label="SEO description" labelVisibility="visible" name="seoDescription" rows={3} /><AdminFormInput disabled={!canEdit} label="Canonical path" labelVisibility="visible" name="canonicalPath" />{canEdit ? <AdminFormActionRow><AdminFormControlButton className="button-primary" type="submit">Create Draft route</AdminFormControlButton></AdminFormActionRow> : null}</AdminFormGrid></AdminSection>;
}

async function permissions() {
  const access = await getCurrentAdminOperatorAccess();
  return { view: hasAdminOperatorCategory(access, 'CONTENT_VIEW'), edit: hasAdminOperatorCategory(access, 'CONTENT_EDIT'), publish: hasAdminOperatorCategory(access, 'CONTENT_PUBLISH'), delete: hasAdminOperatorCategory(access, 'CONTENT_DELETE') };
}

function notice(status?: string) {
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
    'rolled-back': { tone: 'success', title: 'Previous revision restored', detail: 'The restored revision is now Live.' },
    'draft-conflict': { tone: 'warning', title: 'Draft changed', detail: 'Reload and compare before saving again.' },
    'permission-denied': { tone: 'warning', title: 'Action not permitted', detail: 'Your operator role does not include this content action.' },
    'invalid-content': { tone: 'warning', title: 'Content is invalid', detail: 'Correct the section fields or Advanced JSON and try again.' },
    failed: { tone: 'danger', title: 'Website content action failed', detail: 'No success was recorded. Reload the Draft before retrying.' },
  };
  const item = status ? copy[status] : null;
  return item ? <AdminNoticeCard className="admin-mb-16" role="status" tone={item.tone}><strong>{item.title}</strong><p>{item.detail}</p></AdminNoticeCard> : null;
}

function publicUrl(page: PublicSitePageDetail) { const base = page.site === 'PARTNER_RECRUITMENT' ? publicRecruitmentUrl : publicMainUrl; return `${base.replace(/\/$/u, '')}/${page.locale}${page.path === '/' ? '' : page.path}`; }
function siteLabel(site: string) { return site === 'PARTNER_RECRUITMENT' ? 'join.hands.vn' : 'hands.vn'; }
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
  const changedSections = draft.sections.filter((section) => {
    const previous = liveSections.get(section.key);
    return !previous || previous.kind !== section.kind || previous.enabled !== section.enabled || previous.sortOrder !== section.sortOrder || JSON.stringify(previous.content) !== JSON.stringify(section.content);
  });
  const removedSections = live.sections.filter((section) => !draft.sections.some((draftSection) => draftSection.key === section.key));
  if (changedSections.length) changes.push(`${changedSections.length} section${changedSections.length === 1 ? '' : 's'} added or changed.`);
  if (removedSections.length) changes.push(`${removedSections.length} section${removedSections.length === 1 ? '' : 's'} removed.`);
  return changes.length ? changes : ['No content or SEO differences detected.'];
}
function titleCase(input: string) { return input.charAt(0).toUpperCase() + input.slice(1); }
function text(input: unknown) { return typeof input === 'string' ? input : ''; }
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input; }
function positivePage(input?: string) { const parsed = Number.parseInt(input ?? '', 10); return Number.isInteger(parsed) && parsed > 0 ? parsed : 1; }
function workspaceValue(input: string | string[] | undefined): Workspace { const item = value(input); return item === 'content' || item === 'publishing' || item === 'activity' ? item : 'overview'; }
function listHref(values: Record<string, string | string[] | undefined>) { const params = new URLSearchParams(); for (const [key, raw] of Object.entries(values)) { const item = value(raw); if (item) params.set(key, item); } const query = params.toString(); return `/website-content${query ? `?${query}` : ''}`; }
