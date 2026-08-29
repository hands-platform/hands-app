import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PublicSiteSection } from './public-site-section';

describe('PublicSiteSection', () => {
  it('escapes managed copy and drops unsafe links', () => {
    const html = renderToStaticMarkup(
      <PublicSiteSection
        section={{
          id: 'section-1',
          key: 'hero',
          kind: 'HERO',
          renderModel: {
            variant: 'hero',
            eyebrow: null,
            title: '<script>alert(1)</script>',
            subtitle: null,
            body: null,
            imageUrl: null,
            imageAlt: null,
            actionLabel: 'Unsafe',
            actionHref: null,
            items: [],
          },
          sortOrder: 0,
          enabled: true,
        }}
      />,
    );

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('href=');
  });

  it.each([
    ['subtitle', { subtitle: 'Visible subtitle' }, 'Visible subtitle'],
    ['image', { imageUrl: '/images/app.jpg', imageAlt: 'HANDS app screen' }, 'HANDS app screen'],
  ])('renders READY-compatible %s-only generic content', (_name, values, expected) => {
    const html = renderToStaticMarkup(
      <PublicSiteSection section={{
        id: 'section-1',
        key: 'overview',
        kind: 'APP_OVERVIEW',
        renderModel: {
          variant: 'content',
          eyebrow: null,
          title: null,
          subtitle: null,
          body: null,
          imageUrl: null,
          imageAlt: null,
          actionLabel: null,
          actionHref: null,
          items: [],
          ...values,
        },
        sortOrder: 0,
        enabled: true,
      }} />,
    );
    expect(html).toContain(expected);
    expect(html).not.toBe('');
  });
});
