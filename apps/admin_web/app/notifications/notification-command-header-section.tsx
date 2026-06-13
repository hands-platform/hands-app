import Link from 'next/link';

export function NotificationCommandHeaderSection() {
  return (
    <div className="toolbar">
      <div>
        <p className="muted">
          Delivery board for push retries, disabled devices, and last-mile alert confidence.
        </p>
      </div>
      <div className="participant-list">
        <span className="pill pill-success">Current failures first</span>
        <span className="pill pill-info">Delivery signal</span>
        <span className="pill pill-warn">Retry readiness</span>
        <Link className="pill pill-neutral" href="/setup#notifications">
          FCM setup
        </Link>
      </div>
    </div>
  );
}
