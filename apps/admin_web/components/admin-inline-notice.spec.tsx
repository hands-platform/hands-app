import { renderToStaticMarkup } from 'react-dom/server';

import { AdminInlineNotice } from './admin-inline-notice';

describe('AdminInlineNotice', () => {
  it('renders compact Vuexy inline notices with a stable tone contract', () => {
    const markup = renderToStaticMarkup(
      <AdminInlineNotice className="calendar-error-banner" role="alert" tone="danger">
        Calendar event could not be saved.
      </AdminInlineNotice>,
    );

    expect(markup).toContain(
      'class="admin-inline-notice admin-inline-notice-danger calendar-error-banner"',
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Calendar event could not be saved.');
  });
});
