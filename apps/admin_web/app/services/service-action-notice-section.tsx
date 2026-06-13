import type { ServiceActionNotice } from '../../lib/service-action-notice';

type ServiceActionNoticeSectionProps = {
  readonly notice: ServiceActionNotice | null;
};

export function ServiceActionNoticeSection({ notice }: ServiceActionNoticeSectionProps) {
  if (!notice) {
    return null;
  }

  const isSuccess = notice.tone === 'success';

  return (
    <section
      className="card admin-mb-16"
      style={{
        borderColor: isSuccess ? '#b8ddb0' : '#f0c7c2',
        background: isSuccess ? '#f4fbf1' : '#fff5f3',
      }}
    >
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
