import { AdminPageTemplate } from './admin-page-template';
import { AdminLoadingState, AdminSection } from './admin-surface';

export function AdminWorkspaceLoading({ title }: { readonly title: string }) {
  return (
    <AdminPageTemplate description="Loading current operator data and retained records." title={title}>
      <AdminSection title="Priority queue">
        <AdminLoadingState
          message="Loading current exceptions and the next safe operator actions."
          title="Loading priority queue"
        />
      </AdminSection>
      <AdminSection title="Records">
        <AdminLoadingState
          message="Loading supporting records without blocking the priority queue."
          title="Loading records"
        />
      </AdminSection>
    </AdminPageTemplate>
  );
}
