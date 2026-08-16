import type { Metadata } from 'next';

import { AdminCard } from '../../components/admin-surface';
import { OperatorSetupForm } from './operator-setup-form';

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Operator setup · HANDS Admin',
};

export default function OperatorSetupPage() {
  return (
    <main aria-label="HANDS Admin operator setup" className="admin-auth-page">
      <AdminCard ariaLabel="HANDS Admin access security" className="admin-auth-visual">
        <div aria-hidden="true" className="admin-auth-illustration" />
      </AdminCard>
      <AdminCard ariaLabel="Operator setup form" className="admin-auth-card operator-setup-card">
        <div className="admin-auth-brand"><strong>HANDS Admin</strong><span>Secure operator setup</span></div>
        <div className="admin-auth-heading">
          <h1>Create your operator access</h1>
          <p className="muted">Confirm the invitation by choosing a password. Roles and permissions were assigned by a Master Admin.</p>
        </div>
        <OperatorSetupForm />
      </AdminCard>
    </main>
  );
}
