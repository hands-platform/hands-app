import { renderToStaticMarkup } from 'react-dom/server';
import LoginPage from './page';

describe('LoginPage', () => {
  it('renders the admin login form without exposing secrets', async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({ redirectTo: '/bookings?view=matching' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Welcome to HANDS Admin');
    expect(markup).toContain('action="/api/admin/session/login?redirectTo=%2Fbookings%3Fview%3Dmatching"');
    expect(markup).toContain('name="email"');
    expect(markup).toContain('name="password"');
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
    expect(markup).toContain('admin-auth-card');
    expect(markup).toContain('Welcome to HANDS Admin');
    expect(markup).toContain('Sign in failed. Check your admin credentials and try again.');
    expect(markup).toContain('action="/api/admin/session/login?redirectTo=%2Fvietnam-overview"');
    expect(markup).not.toContain('card admin-filter-panel');
    expect(markup).not.toContain('admin-filter-panel-body');
  });
});
