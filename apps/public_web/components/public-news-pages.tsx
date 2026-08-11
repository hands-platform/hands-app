import Link from 'next/link';

import {
  fetchPublicNews,
  safeNewsImageUrl,
  type PublicNewsArticle,
} from '../lib/public-news';
import type { PublicSiteKey, PublicSiteLocale } from '../lib/site-content';
import { HandsSiteFooter, HandsSiteHeader } from './hands-site-chrome';

const newsCopy = {
  ko: { eyebrow: 'HANDS NEWS', title: '새로운 소식', intro: 'HANDS의 서비스, 마사지 테라피스트와 운영에 관한 새로운 이야기를 전합니다.', read: '자세히 보기', back: '새로운 소식으로 돌아가기' },
  vi: { eyebrow: 'TIN MỚI TỪ HANDS', title: 'Tin mới', intro: 'Cập nhật câu chuyện mới về dịch vụ, đối tác và hoạt động của HANDS.', read: 'Đọc thêm', back: 'Quay lại tin mới' },
  en: { eyebrow: 'HANDS NEWS', title: 'Latest news', intro: 'New stories about HANDS services, partners and operations.', read: 'Read story', back: 'Back to news' },
  ja: { eyebrow: 'HANDS NEWS', title: '最新情報', intro: 'HANDSのサービス、パートナー、運営に関する最新情報をお届けします。', read: '詳しく見る', back: '最新情報へ戻る' },
  zh: { eyebrow: 'HANDS NEWS', title: '最新消息', intro: '了解HANDS服务、伙伴与运营的最新动态。', read: '查看详情', back: '返回最新消息' },
} as const;

export async function PublicNewsListPage({
  locale,
  site,
}: {
  readonly locale: PublicSiteLocale;
  readonly site: PublicSiteKey;
}) {
  const articles = await fetchPublicNews(site, locale);
  const copy = newsCopy[locale];

  return (
    <div className="hands-site public-news-page">
      <HandsSiteHeader currentPath="/news" locale={locale} />
      <main>
        <section className="public-news-heading">
          <p className="eyebrow dark">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </section>
        <section className="public-news-grid" aria-label={copy.title}>
          {articles.map((article, index) => (
            <Link className="public-news-card" href={`/${locale}${article.path}`} key={article.id}>
              <NewsImage article={article} />
              <div className="public-news-card-overlay" aria-hidden="true" />
              <div className="public-news-card-copy">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{article.title}</h2>
                  <p>{article.subtitle}</p>
                  <strong>{copy.read} ↗</strong>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </main>
      <HandsSiteFooter locale={locale} />
    </div>
  );
}

export function PublicNewsDetailPage({
  article,
  locale,
}: {
  readonly article: PublicNewsArticle;
  readonly locale: PublicSiteLocale;
}) {
  const copy = newsCopy[locale];
  const imageUrl = safeNewsImageUrl(article.imageUrl);

  return (
    <div className="hands-site public-news-detail-page">
      <HandsSiteHeader currentPath={article.path} locale={locale} theme="overlay" />
      <main>
        <section className="public-news-detail-hero">
          <div
            className="public-news-detail-image"
            role="img"
            aria-label={article.title}
            style={imageUrl ? { backgroundImage: `url("${imageUrl.replaceAll('"', '%22')}")` } : undefined}
          />
          <div className="public-news-card-overlay" aria-hidden="true" />
          <div className="public-news-detail-title">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{article.title}</h1>
            <p>{article.subtitle}</p>
            <time dateTime={article.publishedAt}>
              {new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(article.publishedAt))}
            </time>
          </div>
        </section>
        <article className="public-news-article">
          {article.body.split(/\n{2,}/u).filter(Boolean).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <Link className="text-button dark-link" href={`/${locale}/news`}>
            ← {copy.back}
          </Link>
        </article>
      </main>
      <HandsSiteFooter locale={locale} />
    </div>
  );
}

function NewsImage({ article }: { readonly article: PublicNewsArticle }) {
  const imageUrl = safeNewsImageUrl(article.imageUrl);
  return (
    <div
      className="public-news-card-image"
      role="img"
      aria-label={article.title}
      style={imageUrl ? { backgroundImage: `url("${imageUrl.replaceAll('"', '%22')}")` } : undefined}
    />
  );
}
