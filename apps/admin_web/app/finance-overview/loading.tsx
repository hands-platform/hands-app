import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminLoadingState, AdminSection } from '../../components/admin-surface';

export default function FinanceOverviewLoading() {
  return (
    <AdminPageTemplate
      description="Loading current finance snapshot."
      title="Finance Overview"
    >
      <AdminSection title="Finance snapshot">
        <AdminLoadingState
          message="Refreshing balances, money movement, and open Finance controls."
          title="Loading current finance snapshot."
        />
      </AdminSection>
    </AdminPageTemplate>
  );
}
