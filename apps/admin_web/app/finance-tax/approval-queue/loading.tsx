import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminLoadingState, AdminSection } from '../../../components/admin-surface';

export default function FinanceApprovalQueueLoading() {
  return (
    <AdminPageTemplate
      description="Loading current Finance approval evidence and operator controls."
      title="Finance Approval Queue"
    >
      <AdminSection title="Approval workspaces">
        <AdminLoadingState
          message="Classifying ready decisions and repair exceptions before showing bounded queue rows."
          title="Loading Finance approvals"
        />
      </AdminSection>
    </AdminPageTemplate>
  );
}
