import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminLoadingState, AdminSection } from '../../components/admin-surface';

export default function SetupLoading() {
  return (
    <AdminPageTemplate
      contentClassName="setup-page"
      description="Active service health and launch configuration status."
      title="External Services"
    >
      <AdminSection title="Runtime health">
        <AdminLoadingState
          message="Checking configuration and safe runtime evidence without sending messages, payments, or uploads."
          title="Loading external service status"
        />
      </AdminSection>
    </AdminPageTemplate>
  );
}
