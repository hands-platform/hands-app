import {
  adminGetResult,
  type AdminNotificationTemplateCatalog,
} from '../../../lib/admin-api';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminNoticeCard, AdminSection } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import { notificationTemplateBrowserFixture } from './notification-template-browser-fixtures';
import { NotificationTemplateEditor } from './notification-template-editor';

type NotificationTemplatesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const EMPTY_CATALOG: AdminNotificationTemplateCatalog = {
  health: { complete: false, contractIssues: [], missingKeys: [], unexpectedKeys: [] },
  lastChange: null,
  statusCounts: {},
  templates: [],
};

export default async function NotificationTemplatesPage({ searchParams }: { searchParams?: NotificationTemplatesPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const browserFixture = notificationTemplateBrowserFixture(readSearchParam(params.fixture));
  const loadedResult = browserFixture === 'permission-denied'
    ? { data: EMPTY_CATALOG, ok: false as const, status: 403 }
    : browserFixture === 'load-error'
      ? { data: EMPTY_CATALOG, ok: false as const, requestId: 'fixture-request', status: 503 }
      : await adminGetResult<AdminNotificationTemplateCatalog>(
          '/admin/notifications/templates?take=50',
          EMPTY_CATALOG,
          {
            freshness: 'stable',
            revalidateSeconds: 300,
            tags: ['notification-template-catalog'],
          },
        );
  const result = browserFixture === 'catalog-incomplete' && loadedResult.ok
    ? {
        ...loadedResult,
        data: {
          ...loadedResult.data,
          health: {
            complete: false,
            contractIssues: ['fixture.missing.route: runtime route mismatch'],
            missingKeys: ['fixture.missing.route'],
            unexpectedKeys: loadedResult.data.health.unexpectedKeys,
          },
        },
      }
    : loadedResult;

  return (
    <AdminPageTemplate
      contentClassName="stack notification-template-page"
      description="Manage reviewed customer and Partner copy without changing delivery policy."
      title="Notification Templates"
    >
      {!result.ok ? (
        <AdminNoticeCard tone="danger">
          <AdminSectionHeader
            actions={<StatusBadge tone="danger">Unavailable</StatusBadge>}
            description={result.status === 401
              ? 'Your admin session expired. Sign in again before loading managed notification copy.'
              : result.status === 403
                ? 'Your operator account cannot read or update managed notification copy.'
              : `The template catalog could not be loaded${result.requestId ? ` · Request ${result.requestId}` : ''}. Reload before editing.`}
            title={result.status === 401 ? 'Admin session expired' : result.status === 403 ? 'Notification copy access denied' : 'Notification copy is unavailable'}
          />
          <AdminFormControlLink href="/notifications/templates">
            Retry loading templates
          </AdminFormControlLink>
        </AdminNoticeCard>
      ) : !result.data.health.complete ? (
        <AdminNoticeCard tone="danger">
          <AdminSectionHeader
            actions={<StatusBadge tone="danger">Setup required</StatusBadge>}
            description={result.data.health.contractIssues?.join(' · ') || [
              ...result.data.health.missingKeys.map((key) => `Missing catalog key: ${key}`),
              ...result.data.health.unexpectedKeys.map((key) => `Unexpected database key: ${key}`),
            ].join(' · ') || 'The managed catalog contract could not be verified.'}
            title="Notification contract issues"
          />
        </AdminNoticeCard>
      ) : null}

      {result.ok && result.data.templates.length > 0 ? (
        <AdminSection
          description="Choose an event, review its language readiness, preview the real channels, and save all changed languages together."
          statusLabel={`${result.data.templates.length} managed events`}
          title="Managed copy catalog"
        >
          <NotificationTemplateEditor
            browserSaveFixture={browserFixture === 'save-failure' || browserFixture === 'save-success' || browserFixture === 'slow-save'
              ? browserFixture
              : undefined}
            catalog={result.data}
            initialActionState={browserActionState(browserFixture, result.data.templates[0])}
            initialLocale={readSearchParam(params.locale)}
            initialTemplateKey={readSearchParam(params.template)}
          />
        </AdminSection>
      ) : null}
    </AdminPageTemplate>
  );
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function browserActionState(
  fixture: ReturnType<typeof notificationTemplateBrowserFixture>,
  template: AdminNotificationTemplateCatalog['templates'][number] | undefined,
) {
  if (!template) return undefined;
  const messages = {
    conflict: ['Another operator saved this template first. Your draft is still available.', 'conflict'],
    'server-error': ['The update could not be saved. Your draft is still here.', 'server-error'],
    'session-expired': ['Your session expired. Copy your draft, sign in again, and review the latest version.', 'session-expired'],
    'source-unavailable': ['The template source is unavailable. Copy your draft and load the latest version before retrying.', 'source-unavailable'],
  } as const;
  const state = fixture && fixture in messages ? messages[fixture as keyof typeof messages] : undefined;
  return state ? {
    ...(state[1] === 'conflict' ? { latest: template } : {}),
    message: state[0],
    status: state[1],
    templateKey: template.key,
  } : undefined;
}
