import { renderToStaticMarkup } from 'react-dom/server';

import { ReviewActionDropdown } from './review-action-dropdown';

describe('ReviewActionDropdown', () => {
  it('renders a Vuexy action trigger without expanding actions by default', () => {
    const html = renderToStaticMarkup(
      <ReviewActionDropdown
        actions={[
          {
            description: 'Publish this review so it can appear in the app.',
            disabled: false,
            href: '/reviews?confirm=moderate&reviewId=review-1&status=PUBLISHED',
            kind: 'link',
            label: 'Publish',
            tone: 'success',
          },
        ]}
        label="Review actions for review"
      />,
    );

    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Review actions for review');
    expect(html).not.toContain('role="menu"');
  });
});
