import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { HandsHomePage } from '../../../components/hands-home-page';
import { PartnerDetailPage } from '../../../components/partner-detail-page';
import { PartnerDirectoryPage } from '../../../components/partner-directory-page';
import { PartnerRecruitmentPage } from '../../../components/partner-recruitment-page';
import { ReferralIntroPage } from '../../../components/referral-intro-page';
import { PublicDocumentPage, publicDocumentDefinition } from '../../../components/public-document-page';
import { PublicNewsDetailPage, PublicNewsListPage } from '../../../components/public-news-pages';
import { PublicSiteSection } from '../../../components/public-site-section';
import { CmsPreviewStatus } from '../../../components/cms-preview-status';
import { HandsSiteFooter, HandsSiteHeader } from '../../../components/hands-site-chrome';
import { fallbackNewsArticle, newsArticleFromPage } from '../../../lib/public-news';
import {
  fetchPublicPartner,
  fetchPublicPartners,
  publicPartnerArea,
  publicPartnerIdFromPath,
} from '../../../lib/public-partners';
import {
  CMS_PREVIEW_COOKIE,
  fetchManagedPublicSitePage,
  isPublicSiteLocale,
  publicSiteBaseUrl,
  publicSiteKeyForRequest,
} from '../../../lib/site-content';

type PublicPageParams = Promise<{
  locale: string;
  slug?: string[];
}>;

type PublicPageSearchParams = Promise<{
  page?: string | string[];
}>;

export async function generateMetadata({
  params,
}: {
  params: PublicPageParams;
  searchParams: PublicPageSearchParams;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isPublicSiteLocale(locale)) {
    return {};
  }
  const site = await publicSiteKeyForRequest();
  const path = routePath(slug);
  if ((site === 'PARTNER_RECRUITMENT' || path === '/partner-support') && locale !== 'vi') {
    return {
      title: 'Trở thành đối tác HANDS',
      alternates: { canonical: 'https://join.hands.vn/' },
      robots: { index: false, follow: true },
    };
  }
  const { isPreview, page } = await managedPageForRoute(site, locale, path);
  if (!page) {
    if ((site === 'PARTNER_RECRUITMENT' && path === '/') || path === '/partner-support') {
      return {
        title: 'Trở thành đối tác HANDS',
        description: 'Chủ động thời gian, phát triển chuyên môn và kết nối với khách hàng cùng HANDS.',
        alternates: { canonical: 'https://join.hands.vn/' },
      };
    }
    const partnerRoute = parsePartnerRoute(slug);
    if (site === 'MAIN' && partnerRoute?.kind === 'detail') {
      const partner = await fetchPublicPartner(partnerRoute.id);
      if (!partner) return {};
      return {
        title: `${partner.displayName} · HANDS`,
        description: partnerDetailDescription(locale, partner.displayName),
        alternates: { canonical: `${publicSiteBaseUrl(site)}/${locale}${path}` },
      };
    }
    if (site === 'MAIN' && partnerRoute) {
      const area = publicPartnerArea(partnerRoute.citySlug, partnerRoute.districtSlug, locale);
      return {
        title: `${area.label} · HANDS`,
        description: partnerDirectoryDescription(locale, area.label),
        alternates: { canonical: `${publicSiteBaseUrl(site)}/${locale}${path}` },
      };
    }
    if (site === 'MAIN' && path === '/') {
      return homePageMetadata(locale);
    }
    if (site === 'MAIN' && path === '/news') {
      return {
        title: newsPageTitle(locale),
        description: newsPageDescription(locale),
        alternates: { canonical: `${publicSiteBaseUrl(site)}/${locale}/news` },
      };
    }
    if (site === 'MAIN' && path === '/news/welcome-to-hands') {
      const article = fallbackNewsArticle(locale);
      return {
        title: article.title,
        description: article.subtitle,
        alternates: { canonical: `${publicSiteBaseUrl(site)}/${locale}${article.path}` },
      };
    }
    if (site === 'MAIN' && path === '/referrals') {
      const metadata = referralPageMetadata(locale);
      return {
        ...metadata,
        alternates: { canonical: `${publicSiteBaseUrl(site)}/${locale}/referrals` },
      };
    }
    const document = publicDocumentDefinition(path, locale);
    if (document) {
      return {
        title: document.title,
        description: document.intro,
        alternates: { canonical: `${publicSiteBaseUrl(site)}/${locale}${path}` },
      };
    }
    return {};
  }
  const canonicalPath = page.canonicalPath ?? path;
  return {
    title: page.seoTitle ?? undefined,
    description: page.seoDescription ?? undefined,
    alternates: {
      canonical: `${publicSiteBaseUrl(site)}/${locale}${canonicalPath === '/' ? '' : canonicalPath}`,
    },
    robots: {
      index: !isPreview && !page.noIndex,
      follow: !isPreview && !page.noIndex,
    },
  };
}

export default async function PublicManagedPage({
  params,
  searchParams,
}: {
  params: PublicPageParams;
  searchParams: PublicPageSearchParams;
}) {
  const { locale, slug } = await params;
  if (!isPublicSiteLocale(locale)) {
    notFound();
  }
  const site = await publicSiteKeyForRequest();
  const path = routePath(slug);
  if ((site === 'PARTNER_RECRUITMENT' || path === '/partner-support') && locale !== 'vi') {
    redirect(`/vi${path === '/' ? '' : path}`);
  }
  const query = await searchParams;
  const { isPreview, page, previewRecovery } = await managedPageForRoute(site, locale, path);
  const previewStatus = isPreview || previewRecovery
    ? <CmsPreviewStatus invalid={previewRecovery} returnTo={`/${locale}${path === '/' ? '' : path}`} />
    : null;
  if (page && path.startsWith('/news/')) {
    const article = newsArticleFromPage(page);
    if (!article) notFound();
    return <>{previewStatus}<PublicNewsDetailPage article={article} locale={locale} /></>;
  }
  if (!page) {
    if ((site === 'PARTNER_RECRUITMENT' && path === '/') || path === '/partner-support') {
      return <PartnerRecruitmentPage />;
    }
    if (site === 'MAIN' && path === '/') {
      const partners = await fetchPublicPartners({ page: 1, take: 5 });
      return <HandsHomePage locale={locale} partners={partners.items} />;
    }
    if (site === 'MAIN' && path === '/news') {
      return <PublicNewsListPage locale={locale} site={site} />;
    }
    if (site === 'MAIN' && path === '/news/welcome-to-hands') {
      return <PublicNewsDetailPage article={fallbackNewsArticle(locale)} locale={locale} />;
    }
    if (site === 'MAIN' && path === '/referrals') {
      return <ReferralIntroPage locale={locale} />;
    }
    const partnerRoute = parsePartnerRoute(slug);
    if (site === 'MAIN' && partnerRoute?.kind === 'detail') {
      const partner = await fetchPublicPartner(partnerRoute.id);
      if (!partner) notFound();
      return (
        <PartnerDetailPage
          citySlug={partnerRoute.citySlug}
          districtSlug={partnerRoute.districtSlug}
          locale={locale}
          partner={partner}
        />
      );
    }
    if (site === 'MAIN' && partnerRoute?.kind === 'directory') {
      const pageNumber = positivePage(Array.isArray(query.page) ? query.page[0] : query.page);
      return (
        <PartnerDirectoryPage
          citySlug={partnerRoute.citySlug}
          districtSlug={partnerRoute.districtSlug}
          locale={locale}
          page={pageNumber}
        />
      );
    }
    const definition = publicDocumentDefinition(path, locale);
    if (definition) {
      return <PublicDocumentPage definition={definition} locale={locale} path={path} site={site} />;
    }
    notFound();
  }

  return (
    <div className="hands-site public-managed-page">
      {previewStatus}
      <HandsSiteHeader
        currentPath={path}
        locale={locale}
        site={site === 'PARTNER_RECRUITMENT' ? 'recruitment' : 'main'}
      />
      <main data-locale={locale} data-public-site={site}>
        {page.sections.map((section) => (
          <PublicSiteSection key={section.id} section={section} />
        ))}
      </main>
      <HandsSiteFooter locale={locale} site={site === 'PARTNER_RECRUITMENT' ? 'recruitment' : 'main'} />
    </div>
  );
}

async function managedPageForRoute(
  site: Awaited<ReturnType<typeof publicSiteKeyForRequest>>,
  locale: 'vi' | 'ko' | 'en' | 'ja' | 'zh',
  path: string,
) {
  const previewToken = (await cookies()).get(CMS_PREVIEW_COOKIE)?.value;
  return fetchManagedPublicSitePage(previewToken, site, locale, path);
}

function routePath(slug?: string[]) {
  return slug?.length ? `/${slug.join('/')}` : '/';
}

function parsePartnerRoute(slug?: string[]) {
  if (slug?.[0] !== 'partners') return null;
  if (slug.length === 1) {
    return { kind: 'directory' as const };
  }
  if (slug.length === 2) {
    return { kind: 'directory' as const, citySlug: slug[1] };
  }
  if (slug.length === 3) {
    return { kind: 'directory' as const, citySlug: slug[1], districtSlug: slug[2] };
  }
  if (slug.length === 4) {
    return {
      kind: 'detail' as const,
      citySlug: slug[1],
      districtSlug: slug[2],
      id: publicPartnerIdFromPath(slug[3]),
    };
  }
  return null;
}

function positivePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function newsPageTitle(locale: 'vi' | 'ko' | 'en' | 'ja' | 'zh') {
  return {
    ko: 'HANDS 새로운 소식',
    vi: 'Tin mới từ HANDS',
    en: 'Latest HANDS news',
    ja: 'HANDS最新情報',
    zh: 'HANDS最新消息',
  }[locale];
}

function homePageMetadata(locale: 'vi' | 'ko' | 'en' | 'ja' | 'zh') {
  return {
    ko: {
      title: '원하는 곳에서 시작하는 웰니스',
      description: '가까운 전문 마사지 테라피스트를 찾고 원하는 서비스와 시간을 선택하세요.',
    },
    vi: {
      title: 'Dịch vụ wellness tại nơi bạn muốn',
      description: 'Tìm đối tác chuyên nghiệp gần bạn và chọn dịch vụ, thời gian phù hợp.',
    },
    en: {
      title: 'Wellness wherever you choose',
      description: 'Find nearby professional partners and choose the service and time you prefer.',
    },
    ja: {
      title: '好きな場所で始めるウェルネス',
      description: '近くのプロフェッショナルを探し、サービスと時間を選べます。',
    },
    zh: {
      title: '在您选择的地点享受健康服务',
      description: '寻找附近的专业伙伴，并选择适合您的服务和时间。',
    },
  }[locale];
}

function newsPageDescription(locale: 'vi' | 'ko' | 'en' | 'ja' | 'zh') {
  return {
    ko: 'HANDS의 서비스, 마사지 테라피스트와 운영에 관한 새로운 이야기를 확인하세요.',
    vi: 'Cập nhật mới về dịch vụ, đối tác và hoạt động của HANDS.',
    en: 'Updates about HANDS services, partners and operations.',
    ja: 'HANDSのサービス、パートナー、運営に関する最新情報です。',
    zh: '了解HANDS服务、伙伴与运营的最新动态。',
  }[locale];
}

function referralPageMetadata(locale: 'vi' | 'ko' | 'en' | 'ja' | 'zh') {
  return {
    ko: {
      title: 'HANDS 추천 프로그램',
      description: '고객과 마사지 테라피스트 추천 조건, 보상 검토와 월렛 지급 절차를 확인하세요.',
    },
    vi: {
      title: 'Chương trình giới thiệu HANDS',
      description:
        'Tìm hiểu điều kiện, quy trình xét duyệt và ghi thưởng vào ví cho khách hàng và đối tác massage.',
    },
    en: {
      title: 'HANDS Referral Program',
      description: 'Learn how customer and massage therapist referrals qualify, are reviewed and credited.',
    },
    ja: {
      title: 'HANDS 紹介プログラム',
      description: '顧客とマッサージセラピストの紹介条件、審査、ウォレット反映の流れをご案内します。',
    },
    zh: {
      title: 'HANDS 推荐计划',
      description: '了解客户与按摩治疗师推荐的条件、审核及钱包入账流程。',
    },
  }[locale];
}

function partnerDetailDescription(locale: 'vi' | 'ko' | 'en' | 'ja' | 'zh', name: string) {
  return {
    ko: `${name} 마사지 테라피스트의 서비스, 가격과 고객 리뷰를 확인하세요.`,
    vi: `Xem dịch vụ, giá và đánh giá của đối tác ${name}.`,
    en: `View ${name}'s services, prices and customer reviews.`,
    ja: `${name}のサービス、料金、レビューをご確認ください。`,
    zh: `查看${name}的服务、价格与客户评价。`,
  }[locale];
}

function partnerDirectoryDescription(locale: 'vi' | 'ko' | 'en' | 'ja' | 'zh', area: string) {
  return {
    ko: `${area}에서 활동하는 HANDS 마사지 테라피스트의 서비스, 가격과 리뷰를 확인하세요.`,
    vi: `Xem dịch vụ, giá và đánh giá của đối tác HANDS tại ${area}.`,
    en: `Compare HANDS partner services, prices and reviews in ${area}.`,
    ja: `${area}で活動するHANDSパートナーのサービス、料金、レビューをご確認ください。`,
    zh: `查看${area}的HANDS伙伴服务、价格与评价。`,
  }[locale];
}
