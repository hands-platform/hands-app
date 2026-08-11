import type { AdminNotificationTemplate } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminNoticeCard, AdminSection } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import { NotificationTemplateEditor } from './notification-template-editor';

type NotificationTemplatesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const NOTIFICATION_TEMPLATE_LIST_TAKE = 50;

export default async function NotificationTemplatesPage({
  searchParams,
}: {
  searchParams?: NotificationTemplatesPageSearchParams;
}) {
  const params = (await searchParams) ?? {};
  const templates = await adminGet<AdminNotificationTemplate[]>(
    `/admin/notifications/templates?take=${NOTIFICATION_TEMPLATE_LIST_TAKE}`,
    [],
  );
  const notice = notificationTemplateNotice(readSearchParam(params.notice), readSearchParam(params.template));
  const initialTemplateKey = readSearchParam(params.template);
  const initialLocale = readSearchParam(params.locale);
  const enabledCount = templates.filter((template) => template.enabled).length;
  const customerCount = templates.filter((template) => template.audience === 'CUSTOMER').length;
  const partnerCount = templates.filter((template) => template.audience === 'PROVIDER').length;

  return (
    <AdminPageTemplate
      contentClassName="stack notification-template-page"
      description="Notification copy catalog for in-app and push messages across supported app languages."
      metrics={[
        {
          helper: 'Notification event records in the bounded catalog.',
          kind: 'record',
          label: 'Templates',
          scope: 'Template records',
          value: templates.length,
        },
        {
          helper: 'Templates currently available to operating flows.',
          kind: 'live',
          label: 'Enabled',
          scope: 'Live',
          value: enabledCount,
        },
        {
          helper: 'Customer-facing templates with language copy.',
          kind: 'record',
          label: 'Customers',
          scope: 'Audience coverage',
          value: customerCount,
        },
        {
          helper: 'Partner-facing templates with language copy.',
          kind: 'record',
          label: 'Partners',
          scope: 'Audience coverage',
          value: partnerCount,
        },
      ]}
      title="Notification Templates"
    >
      {notice ? (
        <AdminNoticeCard
          tone={notice.tone === 'success' ? 'success' : 'danger'}
        >
          <AdminSectionHeader
            actions={<StatusBadge tone={notice.tone}>{notice.badge}</StatusBadge>}
            description={notice.detail}
            title={notice.title}
          />
        </AdminNoticeCard>
      ) : null}

      <AdminSection
        description="Select one template, review every language, preview the message, then save the editing session atomically."
        statusLabel={`${templates.length} templates`}
        title="Template catalog"
      >
        <NotificationTemplateEditor
          initialLocale={initialLocale}
          initialTemplateKey={initialTemplateKey}
          templates={templates}
        />
      </AdminSection>
    </AdminPageTemplate>
  );
}

function notificationTemplateNotice(notice: string, templateKey: string) {
  if (notice === 'saved') {
    return {
      badge: 'Saved',
      detail: templateKey ? `${templateKey} copy was updated.` : 'Notification template copy was updated.',
      title: 'Notification template saved',
      tone: 'success' as const,
    };
  }
  if (notice === 'failed') {
    return {
      badge: 'Blocked',
      detail: 'No copy was saved. Check required fields and try again.',
      title: 'Notification template update failed',
      tone: 'danger' as const,
    };
  }
  return null;
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
