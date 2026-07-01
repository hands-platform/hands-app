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
          <p>
            Review bookings, Partners, finance approvals, notifications, and audit evidence from one protected
            workspace.
          </p>
        </div>
        <div className="admin-auth-illustration" aria-hidden="true" />
      </section>

      <section className="admin-auth-card" aria-label="Admin sign in form">
        <div className="admin-auth-brand">
          <strong>HANDS Admin</strong>
          <span>Secure operator workspace</span>
        </div>
        <div className="admin-auth-heading">
          <h1>Welcome to HANDS Admin</h1>
          <p className="muted">Sign in to continue to the operations console.</p>
        </div>
        {params?.error ? (
          <p className="form-error admin-auth-error" role="alert">
            Sign in failed. Check your admin credentials and try again.
          </p>
        ) : null}
        <form action={action} className="admin-auth-form" method="post">
          <label className="admin-auth-field">
            <span>Email</span>
            <input autoComplete="username" name="email" required type="email" />
          </label>
          <label className="admin-auth-field">
            <span>Password</span>
            <input autoComplete="current-password" name="password" required type="password" />
          </label>
          <button className="button button-primary admin-auth-submit" type="submit">
            Sign in
          </button>
          <p className="muted admin-auth-footnote">
            Master and operator access is controlled by HANDS admin policy. Do not share credentials.
          </p>
        </form>
      </section>
    </main>
  );
}

function safeRedirectPath(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}
