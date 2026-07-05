import { renderToStaticMarkup } from 'react-dom/server';
import LoginPage from './page';

describe('LoginPage', () => {
  it('renders the admin login form without exposing secrets', async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({ redirectTo: '/bookings?view=matching' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('action="/api/admin/session/login?redirectTo=%2Fbookings%3Fview%3Dmatching"');
    expect(markup).toContain('name="email"');
    expect(markup).toContain('name="password"');
    expect(markup).not.toContain('class="admin-auth-field"');
    expect(markup).toContain('class="admin-form-input admin-form-control-labeled admin-form-control-fluid"');
    expect(markup).toContain('class="admin-form-control-button button button-primary admin-auth-submit"');
    expect(markup).not.toContain('Review bookings, Partners, finance approvals, notifications, and audit evidence');
    expect(markup).not.toContain('Welcome to HANDS Admin');
    expect(markup).not.toContain('Sign in to continue to the operations console.');
    expect(markup).not.toContain('Master and operator access is controlled by HANDS admin policy.');
    expect(markup).not.toContain('HANDS Operations');
    expect(markup).not.toContain('Command center access for trusted operators');
    expect(markup).not.toContain('Secure operator workspace');
    expect(markup).not.toContain('ADMIN_ACCESS_TOKEN');
    expect(markup).not.toContain('ADMIN_WEB_SESSION_COOKIE_SECRET');
  });

  it('uses a Vuexy auth split layout instead of an operations card', async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({ error: '1', redirectTo: '/vietnam-overview' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-auth-page');
    expect(markup).toContain('admin-auth-visual');
    expect(markup).not.toContain('admin-auth-visual-copy');
    expect(markup).toContain('card admin-card admin-auth-card');
    expect(markup).not.toContain('Welcome to HANDS Admin');
    expect(markup).toContain('Sign in failed. Check your admin credentials and try again.');
    expect(markup).toContain('class="admin-inline-notice admin-inline-notice-danger admin-auth-notice"');
    expect(markup).toContain('action="/api/admin/session/login?redirectTo=%2Fvietnam-overview"');
    expect(markup).not.toContain('card admin-filter-panel');
    expect(markup).not.toContain('admin-filter-panel-body');
  });
});
