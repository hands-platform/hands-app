import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminNoticeCard } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import type { ServiceActionNotice } from '../../lib/service-action-notice';

type ServiceActionNoticeSectionProps = {
  readonly notice: ServiceActionNotice | null;
};

export function ServiceActionNoticeSection({ notice }: ServiceActionNoticeSectionProps) {
  if (!notice) {
    return null;
  }

  return (
    <AdminNoticeCard
      className="admin-mb-16"
      role="status"
      tone={notice.tone === 'success' ? 'success' : 'danger'}
    >
      <AdminSectionHeader
        actions={
          notice.actionHref && notice.actionLabel ? (
            <AdminFormControlLink className="button-secondary" href={notice.actionHref}>
              {notice.actionLabel}
            </AdminFormControlLink>
          ) : null
        }
        description={notice.detail}
        status={
          <StatusBadge tone={notice.tone === 'success' ? 'success' : 'danger'}>
            {notice.tone === 'success' ? 'Saved' : 'Blocked'}
          </StatusBadge>
        }
        title={notice.title}
      />
    </AdminNoticeCard>
  );
}
