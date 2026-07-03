import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';

export function NotificationCommandHeaderSection() {
  return (
    <AdminSectionHeader
      description="Delivery board for push retries, disabled devices, and last-mile alert confidence."
      status={
        <>
        <span className="pill pill-success">Current failures first</span>
        <span className="pill pill-info">Delivery signal</span>
        <span className="pill pill-warn">Retry readiness</span>
        <Link className="pill pill-neutral" href="/setup#notifications">
          FCM setup
        </Link>
        </>
      }
      title="Notification delivery command"
    />
  );
}
