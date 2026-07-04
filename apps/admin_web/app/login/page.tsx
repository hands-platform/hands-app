import {
  AdminFormControlButton,
  AdminFormInput,
} from '../../components/admin-form-controls';

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
      <section className="admin-auth-visual" aria-label="Operations control preview">
        <div className="admin-auth-visual-copy">
          <span>HANDS Operations</span>
          <h1>Command center access for trusted operators</h1>
        </div>
        <div className="admin-auth-illustration" aria-hidden="true" />
      </section>

      <section className="admin-auth-card" aria-label="Admin sign in form">
        <div className="admin-auth-brand">
          <strong>HANDS Admin</strong>
          <span>Secure operator workspace</span>
        </div>
        {params?.error ? (
          <p className="form-error admin-auth-error" role="alert">
            Sign in failed. Check your admin credentials and try again.
          </p>
        ) : null}
        <form action={action} className="admin-auth-form" method="post">
          <AdminFormInput
            autoComplete="username"
            className="admin-auth-field"
            label="Email"
            labelVisibility="visible"
            name="email"
            required
            type="email"
          />
          <AdminFormInput
            autoComplete="current-password"
            className="admin-auth-field"
            label="Password"
            labelVisibility="visible"
            name="password"
            required
            type="password"
          />
          <AdminFormControlButton className="button-primary admin-auth-submit" type="submit">
            Sign in
          </AdminFormControlButton>
        </form>
      </section>
    </main>
  );
}

function safeRedirectPath(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}
