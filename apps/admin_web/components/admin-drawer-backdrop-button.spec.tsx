import { renderToStaticMarkup } from 'react-dom/server';

import { AdminDrawerBackdropButton } from './admin-drawer-backdrop-button';

describe('AdminDrawerBackdropButton', () => {
  it('renders the shared Vuexy drawer backdrop action with stable close semantics', () => {
    const html = renderToStaticMarkup(
      <AdminDrawerBackdropButton
        aria-label="Close editor"
        className="review-edit-drawer-backdrop calendar-drawer-backdrop"
      />,
    );

    expect(html).toContain('aria-label="Close editor"');
    expect(html).toContain('class="calendar-drawer-backdrop review-edit-drawer-backdrop"');
    expect(html).toContain('type="button"');
  });
});
