import { renderToStaticMarkup } from 'react-dom/server';

import NotFound from './not-found';

describe('admin not found page', () => {
  it('renders the 404 state through shared Vuexy Admin atoms', () => {
    const html = renderToStaticMarkup(<NotFound />);

    expect(html).toContain('Page not found');
    expect(html).toContain('admin-state admin-error-state admin-state-danger');
    expect(html).toContain('admin-form-control-link button button-primary');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('<article');
  });
});
