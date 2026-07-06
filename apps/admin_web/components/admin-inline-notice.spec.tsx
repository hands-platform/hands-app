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

  it('renders the Vuexy alert icon and message slots for each tone', () => {
    const markup = renderToStaticMarkup(
      <>
        <AdminInlineNotice tone="success">Saved</AdminInlineNotice>
        <AdminInlineNotice tone="warning">Review before closing</AdminInlineNotice>
        <AdminInlineNotice tone="info">System note</AdminInlineNotice>
      </>,
    );

    expect(markup).toContain('class="admin-inline-notice-icon"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('class="admin-inline-notice-message"');
    expect(markup).toContain('lucide-circle-check');
    expect(markup).toContain('lucide-triangle-alert');
    expect(markup).toContain('lucide-info');
  });
});
