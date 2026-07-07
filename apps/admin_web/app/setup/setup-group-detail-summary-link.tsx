import { AdminSection } from '../../components/admin-surface';
import { StatusBadgeLink } from '../../components/status-badge';

export function SetupGroupDetailSummaryLink({ groupCount }: { readonly groupCount: number }) {
  return (
    <AdminSection
      actions={
        <StatusBadgeLink tone="neutral" href="/setup?details=all">
          Show {groupCount} setup group(s)
        </StatusBadgeLink>
      }
      className="admin-mt-16"
      description="Full environment notes and command packs are kept out of the default setup payload."
      title="Setup group details"
    />
  );
}
