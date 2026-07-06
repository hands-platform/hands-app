import type { AdminNotificationTemplate } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormInput,
  AdminFormShell,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminCard, AdminCardHeader, AdminNoticeCard } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import { compactValue } from '../../../lib/admin-format';
import { updateNotificationTemplate } from './actions';

type NotificationTemplatesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const TEMPLATE_LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
] as const;
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
  const enabledCount = templates.filter((template) => template.enabled).length;
  const customerCount = templates.filter((template) => template.audience === 'CUSTOMER').length;
  const partnerCount = templates.filter((template) => template.audience === 'PROVIDER').length;

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink href="/notifications">Delivery board</AdminFormControlLink>
          <AdminFormControlLink href="/notifications/push-send">Push send</AdminFormControlLink>
        </>
      }
      contentClassName="stack notification-template-page"
      description="Notification copy catalog for in-app and push messages across supported app languages."
      metrics={[
        { label: 'Templates', value: templates.length, helper: 'Managed notification events' },
        { label: 'Enabled', value: enabledCount, helper: 'Available to operating flows' },
        { label: 'Customers', value: customerCount, helper: 'Customer-facing templates' },
        { label: 'Partners', value: partnerCount, helper: 'Partner-facing templates' },
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

      <AdminFilterPanel
        description="Edit the copy operators expect to see before automatic notification flows are wired through the catalog."
        resultLabel={`${templates.length} templates`}
        title="Template catalog"
      >
        <div className="notification-template-grid">
          {templates.map((template) => (
            <AdminCard
              className="notification-template-card"
              id={`template-${template.key}`}
              key={template.key}
            >
              <AdminCardHeader
                actions={
                  <>
                  <StatusBadge tone={template.enabled ? 'success' : 'neutral'}>
                    {template.enabled ? 'Enabled' : 'Paused'}
                  </StatusBadge>
                  <StatusBadge tone={template.audience === 'PROVIDER' ? 'info' : 'warning'}>
                    {template.audience === 'PROVIDER' ? 'Partner' : 'Customer'}
                  </StatusBadge>
                  <StatusBadge tone="neutral">{template.channel}</StatusBadge>
                  </>
                }
                description={template.description}
                title={template.key}
              />

              <div className="notification-template-variable-row">
                <span className="muted">Variables</span>
                <code>{compactValue(template.variables ?? {}, 220)}</code>
              </div>

              <div className="notification-template-copy-grid">
                {TEMPLATE_LOCALES.map((locale) => {
                  const translation = template.translations.find((item) => item.locale === locale.value);
                  return (
                    <AdminFormShell
                      action={updateNotificationTemplate}
                      className="notification-template-copy-form"
                      key={`${template.key}-${locale.value}`}
                    >
                      <input name="key" type="hidden" value={template.key} />
                      <input name="locale" type="hidden" value={locale.value} />
                      <input name="enabled" type="hidden" value="false" />
                      <div className="notification-template-copy-form-header">
                        <h4>{locale.label}</h4>
                        <AdminFormCheckbox
                          className="notification-template-enabled-toggle"
                          defaultChecked={template.enabled}
                          label={`${locale.label} notification template enabled`}
                          name="enabled"
                          value="true"
                        >
                          <span>Enabled</span>
                        </AdminFormCheckbox>
                      </div>
                      <AdminFormInput
                        defaultValue={translation?.title ?? ''}
                        label={`${locale.label} title`}
                        maxLength={120}
                        name="title"
                        placeholder="Push title"
                        required
                      />
                      <AdminFormTextarea
                        defaultValue={translation?.body ?? ''}
                        label={`${locale.label} body`}
                        maxLength={500}
                        name="body"
                        placeholder="Push body"
                        required
                        rows={3}
                      />
                      <AdminFormControlButton>Save {locale.value.toUpperCase()}</AdminFormControlButton>
                    </AdminFormShell>
                  );
                })}
              </div>
            </AdminCard>
          ))}
        </div>
      </AdminFilterPanel>
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
