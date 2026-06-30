import { renderToStaticMarkup } from 'react-dom/server';
import LoginPage from './page';

describe('LoginPage', () => {
  it('renders the admin login form without exposing secrets', async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({ redirectTo: '/bookings?view=matching' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('HANDS Admin Login');
    expect(markup).toContain('action="/api/admin/session/login?redirectTo=%2Fbookings%3Fview%3Dmatching"');
    expect(markup).toContain('name="email"');
    expect(markup).toContain('name="password"');
    expect(markup).not.toContain('ADMIN_ACCESS_TOKEN');
    expect(markup).not.toContain('ADMIN_WEB_SESSION_COOKIE_SECRET');
  });
});
