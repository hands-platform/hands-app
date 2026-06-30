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
    <section className="card admin-filter-panel admin-mt-16">
      <div className="admin-filter-panel-heading">
        <div>
          <h1>HANDS Admin Login</h1>
          <p className="muted">Sign in to continue to the operations console.</p>
        </div>
      </div>
      <div className="admin-filter-panel-body">
        {params?.error ? (
          <p className="form-error" role="alert">
            Sign in failed. Check your admin credentials and try again.
          </p>
        ) : null}
        <form action={action} className="admin-form-grid" method="post">
          <label className="form-field">
            <span>Email</span>
            <input autoComplete="username" name="email" required type="email" />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input autoComplete="current-password" name="password" required type="password" />
          </label>
          <div className="admin-form-actions">
            <button className="button button-primary" type="submit">
              Sign in
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function safeRedirectPath(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}
