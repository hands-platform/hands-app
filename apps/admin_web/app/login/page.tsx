import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormShell,
} from '../../components/admin-form-light-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminCard } from '../../components/admin-surface';

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    redirectTo?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = safeRedirectPath(params?.redirectTo);
  const action = `/api/admin/session/login?redirectTo=${encodeURIComponent(redirectTo)}`;

  return (
    <main className="admin-auth-page" aria-label="HANDS Admin login">
      <AdminCard className="admin-auth-visual" ariaLabel="Operations control preview">
        <div className="admin-auth-illustration" aria-hidden="true" />
      </AdminCard>

      <AdminCard className="admin-auth-card" ariaLabel="Admin sign in form">
        <div className="admin-auth-brand">
          <strong>HANDS Admin</strong>
        </div>
        {params?.error ? (
          <AdminInlineNotice className="admin-auth-notice" role="alert" tone="danger">
            Sign in failed. Check your admin credentials and try again.
          </AdminInlineNotice>
        ) : null}
        <AdminFormShell action={action} className="admin-auth-form" method="post">
          <AdminFormInput autoComplete="username" className="admin-form-control-fluid" label="Email" labelVisibility="visible" name="email" required type="email" />
          <AdminFormInput autoComplete="current-password" className="admin-form-control-fluid" label="Password" labelVisibility="visible" name="password" required type="password" />
          <AdminFormInput
            autoComplete="one-time-code"
            className="admin-form-control-fluid"
            inputMode="numeric"
            label="Authenticator or recovery code"
            labelVisibility="visible"
            maxLength={32}
            name="mfaCode"
            placeholder="Required after MFA enrollment"
          />
          <AdminFormControlButton className="button-primary admin-auth-submit" type="submit">
            Sign in
          </AdminFormControlButton>
        </AdminFormShell>
      </AdminCard>
    </main>
  );
}

function safeRedirectPath(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}
