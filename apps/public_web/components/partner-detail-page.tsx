import Link from 'next/link';

import type { PublicSiteLocale } from '../lib/site-content';
import {
  publicPartnerArea,
  safePublicMediaUrl,
  type PublicPartner,
} from '../lib/public-partners';
import { HandsSiteFooter, HandsSiteHeader } from './hands-site-chrome';
import { PublicPartnerMedia } from './partner-directory-page';

export function PartnerDetailPage({
  partner,
  citySlug,
  districtSlug,
  locale,
}: {
  readonly partner: PublicPartner;
  readonly citySlug: string;
  readonly districtSlug: string;
  readonly locale: PublicSiteLocale;
}) {
  const area = publicPartnerArea(citySlug, districtSlug, locale);
  const services = partner.services ?? [];
  const reviews = partner.reviews ?? [];
  const gallery = partner.galleryImageUrls ?? [];
  const copy = detailCopy[locale];
  const base = `/${locale}/partners`;

  return (
    <div className="hands-site public-partner-detail-page">
      <HandsSiteHeader
        currentPath={`/partners/${citySlug}/${districtSlug}/${partner.id}`}
        locale={locale}
      />
      <main>
        <nav className="partner-breadcrumbs" aria-label={copy.breadcrumb}>
          <Link href={base}>{copy.partner}</Link>
          <Link href={`${base}/${citySlug}`}>{area.cityLabel ?? 'Vietnam'}</Link>
          {area.district ? (
            <Link href={`${base}/${citySlug}/${districtSlug}`}>{area.districtLabel}</Link>
          ) : null}
          <span>{partner.displayName}</span>
        </nav>

        <section className="partner-detail-hero">
          <div className="partner-detail-gallery">
            <PublicPartnerMedia className="partner-detail-main-media" partner={partner} />
            <PartnerGalleryMedia label="GALLERY MEDIA 02" url={gallery[1]} />
            <PartnerGalleryMedia label="GALLERY MEDIA 03" url={gallery[2]} />
          </div>
          <div className="partner-detail-title">
            <div>
              <p className="eyebrow dark">{area.label} HANDS PARTNER</p>
              <h1>{partner.displayName}</h1>
              <p>{translatedBio(partner, locale) || copy.bioFallback}</p>
            </div>
            <div className="partner-detail-rating">
              <strong>{Number(partner.ratingAvg ?? 0).toFixed(1)}</strong>
              <span>{copy.reviewCount(partner.reviewCount ?? 0)}</span>
            </div>
          </div>
        </section>

        <section className="partner-detail-content">
          <div className="partner-detail-main">
            <section>
              <p className="eyebrow dark">PROFILE</p>
              <h2>{copy.profile}</h2>
              <dl className="partner-facts">
                <div>
                  <dt>{copy.area}</dt>
                  <dd>{area.label}</dd>
                </div>
                <div>
                  <dt>{copy.experience}</dt>
                  <dd>{partner.experienceYears ? copy.years(partner.experienceYears) : copy.inProfile}</dd>
                </div>
                <div>
                  <dt>{copy.style}</dt>
                  <dd>{partner.serviceStyle || copy.customWellness}</dd>
                </div>
                <div>
                  <dt>{copy.languages}</dt>
                  <dd>{listLabel(partner.languages, copy.vietnamese)}</dd>
                </div>
              </dl>
            </section>

            <section>
              <p className="eyebrow dark">SERVICES</p>
              <h2>{copy.services}</h2>
              <div className="public-service-list">
                {services.length ? (
                  services.map((service) => (
                    <article key={service.id}>
                      <div>
                        <h3>{service.service.name}</h3>
                        <p>{service.service.description || copy.serviceDetail}</p>
                      </div>
                      <div>
                        <span>{copy.minutes(service.service.durationMin)}</span>
                        <strong>{service.price.toLocaleString('vi-VN')} VND</strong>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="partner-detail-empty-copy">{copy.serviceEmpty}</p>
                )}
              </div>
            </section>

            <section>
              <p className="eyebrow dark">CUSTOMER REVIEWS</p>
              <h2>{copy.reviews}</h2>
              <div className="public-review-list">
                {reviews.length ? (
                  reviews.map((review, index) => (
                    <article key={`${review.createdAt}-${index}`}>
                      <strong>{review.rating.toFixed(1)}</strong>
                      <p>{review.comment || copy.reviewFallback}</p>
                      <span>{new Intl.DateTimeFormat(locale).format(new Date(review.createdAt))}</span>
                    </article>
                  ))
                ) : (
                  <p className="partner-detail-empty-copy">{copy.reviewEmpty}</p>
                )}
              </div>
            </section>
          </div>

          <aside className="partner-app-cta" id="download">
            <p className="eyebrow dark">BOOK IN THE APP</p>
            <h2>{copy.appTitle}</h2>
            <p>{copy.appBody}</p>
            <a className="button button-dark" href="#download">
              {copy.download}
            </a>
            <small>{copy.noWebBooking}</small>
          </aside>
        </section>
      </main>
      <HandsSiteFooter locale={locale} />
    </div>
  );
}

function listLabel(value: unknown, fallback: string) {
  if (!Array.isArray(value)) return fallback;
  const values = value.filter((item): item is string => typeof item === 'string');
  return values.length ? values.join(' · ') : fallback;
}

function PartnerGalleryMedia({
  label,
  url,
}: {
  readonly label: string;
  readonly url?: string;
}) {
  const mediaUrl = safePublicMediaUrl(url);
  return (
    <div
      className={`media-placeholder partner-detail-side-media ${mediaUrl ? 'has-image' : ''}`}
      style={mediaUrl ? { backgroundImage: `url("${mediaUrl.replaceAll('"', '%22')}")` } : undefined}
    >
      {mediaUrl ? null : <span>{label}</span>}
    </div>
  );
}

function translatedBio(partner: PublicPartner, locale: PublicSiteLocale) {
  const translations = partner.bioTranslations;
  return typeof translations?.[locale] === 'string' ? translations[locale] : partner.bio;
}

const detailCopy = {
  ko: {
    breadcrumb: '마사지 테라피스트 경로', partner: '마사지 테라피스트', bioFallback: '편안한 서비스 경험을 제공하는 HANDS 마사지 테라피스트입니다.',
    reviewCount: (count: number) => `고객 리뷰 ${count}개`, profile: '마사지 테라피스트 소개', area: '활동 지역',
    experience: '경력', years: (years: number) => `${years}년`, inProfile: '프로필에서 확인',
    style: '서비스 스타일', customWellness: '맞춤형 웰니스', languages: '언어', vietnamese: '베트남어',
    services: '서비스와 가격', serviceDetail: 'HANDS 앱에서 서비스 상세를 확인하세요.',
    minutes: (minutes: number) => `${minutes}분`, serviceEmpty: '서비스 가격은 HANDS 앱에서 확인할 수 있습니다.',
    reviews: '고객 리뷰', reviewFallback: '만족스러운 서비스였습니다.', reviewEmpty: '아직 공개된 고객 리뷰가 없습니다.',
    appTitle: '이 마사지 테라피스트를 HANDS 앱에서 만나보세요.', appBody: '실시간 이용 가능 여부, 정확한 서비스 시간과 예약은 앱에서 확인합니다.',
    download: '앱 다운로드', noWebBooking: '웹사이트에서는 예약을 받지 않습니다.',
  },
  vi: {
    breadcrumb: 'Đường dẫn đối tác', partner: 'Đối tác', bioFallback: 'Đối tác HANDS mang đến trải nghiệm dịch vụ thoải mái.',
    reviewCount: (count: number) => `${count} đánh giá`, profile: 'Giới thiệu đối tác', area: 'Khu vực',
    experience: 'Kinh nghiệm', years: (years: number) => `${years} năm`, inProfile: 'Xem trong hồ sơ',
    style: 'Phong cách', customWellness: 'Wellness theo nhu cầu', languages: 'Ngôn ngữ', vietnamese: 'Tiếng Việt',
    services: 'Dịch vụ và giá', serviceDetail: 'Xem chi tiết dịch vụ trong ứng dụng HANDS.',
    minutes: (minutes: number) => `${minutes} phút`, serviceEmpty: 'Xem giá dịch vụ trong ứng dụng HANDS.',
    reviews: 'Đánh giá khách hàng', reviewFallback: 'Trải nghiệm dịch vụ hài lòng.', reviewEmpty: 'Chưa có đánh giá công khai.',
    appTitle: 'Gặp đối tác này trong ứng dụng HANDS.', appBody: 'Kiểm tra lịch hoạt động, thời lượng và đặt dịch vụ trong ứng dụng.',
    download: 'Tải ứng dụng', noWebBooking: 'Website không nhận đặt lịch trực tiếp.',
  },
  en: {
    breadcrumb: 'Partner path', partner: 'Partners', bioFallback: 'A HANDS partner focused on a comfortable service experience.',
    reviewCount: (count: number) => `${count} customer reviews`, profile: 'Partner profile', area: 'Service area',
    experience: 'Experience', years: (years: number) => `${years} years`, inProfile: 'See profile',
    style: 'Service style', customWellness: 'Personalised wellness', languages: 'Languages', vietnamese: 'Vietnamese',
    services: 'Services and prices', serviceDetail: 'See full service details in the HANDS app.',
    minutes: (minutes: number) => `${minutes} min`, serviceEmpty: 'Service prices are available in the HANDS app.',
    reviews: 'Customer reviews', reviewFallback: 'A satisfying service experience.', reviewEmpty: 'No public reviews yet.',
    appTitle: 'Meet this partner in the HANDS app.', appBody: 'Check live availability, exact duration and booking in the app.',
    download: 'Download app', noWebBooking: 'Bookings are not accepted on the website.',
  },
  ja: {
    breadcrumb: 'パートナーの階層', partner: 'パートナー', bioFallback: '心地よいサービス体験を提供するHANDSパートナーです。',
    reviewCount: (count: number) => `レビュー${count}件`, profile: 'パートナー紹介', area: '活動エリア',
    experience: '経験', years: (years: number) => `${years}年`, inProfile: 'プロフィールで確認',
    style: 'サービススタイル', customWellness: 'カスタムウェルネス', languages: '言語', vietnamese: 'ベトナム語',
    services: 'サービスと料金', serviceDetail: '詳細はHANDSアプリでご確認ください。',
    minutes: (minutes: number) => `${minutes}分`, serviceEmpty: '料金はHANDSアプリで確認できます。',
    reviews: 'お客様のレビュー', reviewFallback: '満足できるサービスでした。', reviewEmpty: '公開レビューはまだありません。',
    appTitle: 'HANDSアプリでこのパートナーを予約できます。', appBody: '空き状況、正確な時間、予約はアプリで確認してください。',
    download: 'アプリをダウンロード', noWebBooking: 'ウェブサイトでは予約を受け付けていません。',
  },
  zh: {
    breadcrumb: '伙伴路径', partner: '伙伴', bioFallback: '为客户提供舒适服务体验的HANDS伙伴。',
    reviewCount: (count: number) => `${count}条客户评价`, profile: '伙伴介绍', area: '服务地区',
    experience: '经验', years: (years: number) => `${years}年`, inProfile: '资料中查看',
    style: '服务风格', customWellness: '定制健康服务', languages: '语言', vietnamese: '越南语',
    services: '服务与价格', serviceDetail: '请在HANDS应用内查看服务详情。',
    minutes: (minutes: number) => `${minutes}分钟`, serviceEmpty: '服务价格可在HANDS应用内查看。',
    reviews: '客户评价', reviewFallback: '令人满意的服务体验。', reviewEmpty: '暂无公开客户评价。',
    appTitle: '在HANDS应用内找到这位伙伴。', appBody: '请在应用内查看实时可用状态、服务时间并预约。',
    download: '下载应用', noWebBooking: '网站不接受直接预约。',
  },
} satisfies Record<PublicSiteLocale, object>;
