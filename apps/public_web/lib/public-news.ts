import { publicSiteNewsCacheTag } from './site-content';
import type {
  PublicSiteKey,
  PublicSiteLocale,
  PublicSitePage,
} from './site-content';

const API_BASE_URL = process.env.PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

export type PublicNewsArticle = {
  id: string;
  path: string;
  title: string;
  subtitle: string;
  body: string;
  imageUrl?: string | null;
  publishedAt: string;
};

type PublicNewsRow = {
  id: string;
  path: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
  sections: PublicSitePage['sections'];
};

const fallbackCopy: Record<PublicSiteLocale, Omit<PublicNewsArticle, 'id' | 'path' | 'publishedAt'>> = {
  ko: {
    title: '약속한 시간에 시작하는 HANDS',
    subtitle: '마사지 테라피스트가 도착하는 순간부터 서비스 완료까지, 더 분명한 경험을 준비합니다.',
    body:
      'HANDS는 고객이 선택한 장소와 시간에 전문 마사지 테라피스트가 방문하는 웰니스 서비스입니다.\n\n마사지 테라피스트 프로필, 서비스 가격과 실제 고객 리뷰를 확인하고 앱에서 예약할 수 있습니다. 예약 이후에는 채팅과 상태 알림으로 진행 상황을 확인할 수 있습니다.',
    imageUrl: '/images/news/partner-arrival-story.png',
  },
  vi: {
    title: 'HANDS bắt đầu đúng giờ đã hẹn',
    subtitle: 'Một trải nghiệm rõ ràng hơn từ lúc đối tác đến cho đến khi hoàn tất dịch vụ.',
    body:
      'HANDS kết nối khách hàng với đối tác wellness chuyên nghiệp tại địa điểm và thời gian đã chọn.\n\nBạn có thể xem hồ sơ, giá dịch vụ và đánh giá thực tế trước khi đặt lịch trong ứng dụng. Sau khi đặt, trạng thái và trò chuyện giúp bạn theo dõi toàn bộ quá trình.',
    imageUrl: '/images/news/partner-arrival-story.png',
  },
  en: {
    title: 'HANDS starts at the time you choose',
    subtitle: 'A clearer experience from partner arrival through service completion.',
    body:
      'HANDS connects customers with professional wellness partners at the selected place and time.\n\nReview profiles, service prices and customer feedback before booking in the app. After booking, chat and live status updates keep the journey clear.',
    imageUrl: '/images/news/partner-arrival-story.png',
  },
  ja: {
    title: '約束の時間に始まるHANDS',
    subtitle: 'パートナーの到着からサービス完了まで、より分かりやすい体験を提供します。',
    body:
      'HANDSは、指定した場所と時間にプロのウェルネスパートナーをつなぐサービスです。\n\nプロフィール、料金、実際のレビューを確認してアプリから予約できます。予約後はチャットとステータス通知で進行状況を確認できます。',
    imageUrl: '/images/news/partner-arrival-story.png',
  },
  zh: {
    title: 'HANDS，按约定时间开始',
    subtitle: '从伙伴到达至服务完成，为您提供更清晰的体验。',
    body:
      'HANDS会在您选择的地点和时间连接专业健康服务伙伴。\n\n您可以查看伙伴资料、服务价格和真实评价，并在应用内预约。预约后可通过聊天和状态通知了解整个服务进程。',
    imageUrl: '/images/news/partner-arrival-story.png',
  },
};

export async function fetchPublicNews(
  site: PublicSiteKey,
  locale: PublicSiteLocale,
): Promise<PublicNewsArticle[]> {
  const query = new URLSearchParams({ site, locale });
  try {
    const response = await fetch(`${API_BASE_URL}/public/site-pages/news?${query}`, {
      next: { revalidate: 300, tags: [publicSiteNewsCacheTag(site, locale)] },
    });
    if (!response.ok) return [fallbackNewsArticle(locale)];
    const rows = (await response.json()) as PublicNewsRow[];
    const articles = rows.map(newsArticleFromRow).filter(Boolean) as PublicNewsArticle[];
    return mergeFallbackArticle(articles, locale);
  } catch {
    return [fallbackNewsArticle(locale)];
  }
}

export function newsArticleFromPage(page: PublicSitePage): PublicNewsArticle | null {
  const section = page.sections[0];
  if (!section) return null;
  return newsArticleFromContent(
    page.id,
    page.path,
    page.seoTitle,
    page.seoDescription,
    page.updatedAt,
    section.renderModel,
  );
}

export function fallbackNewsArticle(locale: PublicSiteLocale): PublicNewsArticle {
  return {
    id: `fallback-welcome-${locale}`,
    path: '/news/welcome-to-hands',
    publishedAt: '2026-07-30T00:00:00.000Z',
    ...fallbackCopy[locale],
  };
}

export function safeNewsImageUrl(value?: string | null) {
  if (!value) return null;
  const image = value.trim();
  if (image.startsWith('/') && !image.startsWith('//')) return image;
  try {
    const url = new URL(image);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function newsArticleFromRow(row: PublicNewsRow) {
  return newsArticleFromContent(
    row.id,
    row.path,
    row.seoTitle,
    row.seoDescription,
    row.publishedAt ?? row.updatedAt,
    row.sections[0]?.renderModel,
  );
}

function newsArticleFromContent(
  id: string,
  path: string,
  seoTitle: string | null | undefined,
  seoDescription: string | null | undefined,
  publishedAt: string,
  content?: Record<string, unknown>,
) {
  const title = text(content?.title) ?? text(seoTitle);
  if (!title) return null;
  return {
    id,
    path,
    title,
    subtitle: text(content?.subtitle) ?? text(content?.body) ?? text(seoDescription) ?? '',
    body: text(content?.body) ?? text(seoDescription) ?? '',
    imageUrl: safeNewsImageUrl(text(content?.imageUrl)),
    publishedAt,
  } satisfies PublicNewsArticle;
}

function mergeFallbackArticle(articles: PublicNewsArticle[], locale: PublicSiteLocale) {
  const fallback = fallbackNewsArticle(locale);
  return articles.some((article) => article.path === fallback.path)
    ? articles
    : [...articles, fallback];
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
