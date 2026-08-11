import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { headers } from 'next/headers';

import NotFound from './not-found';

vi.mock('next/headers', () => ({ headers: vi.fn() }));

const mockedHeaders = vi.mocked(headers);

describe('admin not found page', () => {
  beforeEach(() => mockedHeaders.mockReset());

  it('renders the generic 404 state through shared Vuexy Admin atoms', async () => {
    mockedHeaders.mockResolvedValue(new Headers({ 'x-admin-pathname': '/missing-route' }));
    const html = renderToStaticMarkup(await NotFound());

    expect(html).toContain('Page not found');
    expect(html).toContain('admin-state admin-error-state admin-state-danger');
    expect(html).toContain('admin-form-control-link button button-primary');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('<article');
  });

  it.each([
    ['/customers/missing', 'Customer not found', '/customers', 'Back to customers'],
    ['/partners/missing', 'Partner not found', '/partners', 'Back to partners'],
    ['/bookings/missing', 'Booking not found', '/bookings', 'Back to bookings'],
    ['/payments/missing', 'Payment not found', '/payments', 'Back to payments'],
  ])('returns missing detail records to their owning list', async (pathname, title, href, label) => {
    mockedHeaders.mockResolvedValue(new Headers({ 'x-admin-pathname': pathname }));
    const html = renderToStaticMarkup(await NotFound());

    expect(html).toContain(title);
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain(label);
    expect(html).not.toContain('Admin workspace route');
  });
});
