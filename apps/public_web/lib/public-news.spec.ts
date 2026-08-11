import { describe, expect, it } from 'vitest';

import {
  fallbackNewsArticle,
  newsArticleFromPage,
  safeNewsImageUrl,
} from './public-news';

describe('public news helpers', () => {
  it('maps managed article content without accepting unsafe images', () => {
    const article = newsArticleFromPage({
      id: 'page-1',
      site: 'MAIN',
      locale: 'ko',
      path: '/news/first-story',
      status: 'PUBLISHED',
      revisionId: 'revision-1',
      revisionNumber: 1,
      version: 1,
      seoTitle: 'SEO title',
      seoDescription: 'SEO description',
      noIndex: false,
      updatedAt: '2026-07-30T00:00:00.000Z',
      sections: [
        {
          id: 'section-1',
          key: 'article',
          kind: 'APP_OVERVIEW',
          renderModel: {
            variant: 'content',
            eyebrow: null,
            title: 'Article title',
            subtitle: 'Article subtitle',
            body: 'Article body',
            imageUrl: '/images/news/story.jpg',
            actionLabel: null,
            actionHref: null,
            items: [],
          },
          sortOrder: 0,
          enabled: true,
        },
      ],
    });

    expect(article).toMatchObject({
      title: 'Article title',
      imageUrl: '/images/news/story.jpg',
    });
    expect(safeNewsImageUrl('javascript:alert(1)')).toBeNull();
    expect(fallbackNewsArticle('ja').path).toBe('/news/welcome-to-hands');
  });
});
