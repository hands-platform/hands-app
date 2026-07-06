import { AdminFormControlLink } from '../components/admin-form-controls';
import { AdminPageTemplate } from '../components/admin-page-template';
import { AdminErrorState } from '../components/admin-surface';

export default function NotFound() {
  return (
    <AdminPageTemplate
      description="The requested Admin workspace route is not available in the current navigation policy."
      title="Page not found"
    >
      <AdminErrorState
        action={
          <AdminFormControlLink className="button-primary" href="/">
            Return to Start Shift
          </AdminFormControlLink>
        }
        message="Use the sidebar or return to the command workspace to continue operation review."
        title="Page not found"
      />
    </AdminPageTemplate>
  );
}
