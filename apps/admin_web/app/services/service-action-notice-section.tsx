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
    <section className={`card admin-mb-16 admin-notice-card ${noticeClassName}`}>
      <div className="ops-section-header">
        <div>
          <h2>{notice.title}</h2>
          <p className="muted">{notice.detail}</p>
        </div>
        <span className={`pill ${isSuccess ? 'pill-success' : 'pill-danger'}`}>
          {isSuccess ? 'Saved' : 'Blocked'}
        </span>
      </div>
    </section>
  );
}
