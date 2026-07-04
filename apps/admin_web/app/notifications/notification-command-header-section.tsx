import { AdminSectionHeader } from '../../components/admin-page-template';
import { StatusBadge, StatusBadgeLink } from '../../components/status-badge';

export function NotificationCommandHeaderSection() {
  return (
    <AdminSectionHeader
      description="Delivery board for push retries, disabled devices, and last-mile alert confidence."
      status={
        <>
          <StatusBadge tone="success">Current failures first</StatusBadge>
          <StatusBadge tone="info">Delivery signal</StatusBadge>
          <StatusBadge tone="warning">Retry readiness</StatusBadge>
          <StatusBadgeLink href="/setup#notifications" tone="neutral">
            FCM setup
          </StatusBadgeLink>
        </>
      }
      title="Notification delivery command"
    />
  );
}
