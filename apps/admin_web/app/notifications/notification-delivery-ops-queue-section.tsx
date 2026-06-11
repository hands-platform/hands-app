import Link from 'next/link';

export type NotificationDeliveryOpsQueueItem = {
  readonly count: number;
  readonly detail: string;
  readonly href: string;
  readonly key: string;
  readonly label: string;
  readonly tone: string;
};

type NotificationDeliveryOpsQueueSectionProps = {
  readonly items: readonly NotificationDeliveryOpsQueueItem[];
};

export function NotificationDeliveryOpsQueueSection({ items }: NotificationDeliveryOpsQueueSectionProps) {
  return (
    <div className="card soft-card" style={{ marginBottom: 16 }}>
      <div className="toolbar">
        <div>
          <h3>Delivery operations queue</h3>
          <p className="muted">
            Fix disabled tokens and push delivery setup before retrying, so failed alerts do not loop.
          </p>
        </div>
        <span className={`pill ${items.length ? 'pill-warn' : 'pill-success'}`}>
          {items.length ? `${items.length} issue(s)` : 'No delivery blockers'}
        </span>
      </div>
      <div className="grid">
        {items.length ? (
          items.map((item) => (
            <div className="card" key={item.key}>
              <span className={`pill ${item.tone}`}>{item.label}</span>
              <h3 style={{ marginTop: 10 }}>{item.count}</h3>
              <p className="muted">{item.detail}</p>
              <Link className="pill pill-neutral" href={item.href}>
                Open queue
              </Link>
            </div>
          ))
        ) : (
          <div className="card">
            <span className="pill pill-success">Ready</span>
            <h3 style={{ marginTop: 10 }}>Delivery path is clean</h3>
            <p className="muted">
              Keep monitoring failed sends after FCM and production SMS credentials are enabled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
