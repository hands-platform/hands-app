import { AdminSection } from '../../components/admin-surface';
import type { ServiceActionNotice } from '../../lib/service-action-notice';

type ServiceActionNoticeSectionProps = {
  readonly notice: ServiceActionNotice | null;
};

export function ServiceActionNoticeSection({ notice }: ServiceActionNoticeSectionProps) {
  if (!notice) {
    return null;
  }

  const isSuccess = notice.tone === 'success';
  const noticeClassName = isSuccess ? 'admin-notice-success' : 'admin-notice-danger';

  return (
    <AdminSection
      className={`admin-mb-16 admin-notice-card ${noticeClassName}`}
      description={notice.detail}
      statusLabel={isSuccess ? 'Saved' : 'Blocked'}
      statusTone={isSuccess ? 'success' : 'danger'}
      title={notice.title}
    />
  );
}
