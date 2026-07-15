import { AdminSectionHeader } from '../../components/admin-page-template';
import { StatusBadge, StatusBadgeLink } from '../../components/status-badge';

type NotificationCommandHeaderSectionProps = {
  readonly canViewDiagnostics?: boolean;
};

export function NotificationCommandHeaderSection({
  canViewDiagnostics = false,
}: NotificationCommandHeaderSectionProps = {}) {
  return (
    <AdminSectionHeader
      description="Delivery board for push retries, disabled devices, and last-mile alert confidence."
      status={
        <>
          <StatusBadge tone="success">Current failures first</StatusBadge>
          <StatusBadge tone="info">Delivery signal</StatusBadge>
          <StatusBadge tone="warning">Retry checks</StatusBadge>
          {canViewDiagnostics ? (
            <StatusBadgeLink href="/setup?commands=all#notifications" tone="neutral">
              FCM setup
            </StatusBadgeLink>
          ) : null}
        </>
      }
      title="Notification delivery command"
    />
  );
}
