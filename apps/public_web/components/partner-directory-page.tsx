import Link from 'next/link';

import type { PublicSiteLocale } from '../lib/site-content';
import {
  fetchPublicPartners,
  publicPartnerArea,
  publicPartnerAreas,
  publicPartnerDetailPath,
  safePublicMediaUrl,
  type PublicPartner,
} from '../lib/public-partners';
import { HandsSiteFooter, HandsSiteHeader } from './hands-site-chrome';

export async function PartnerDirectoryPage({
  citySlug,
  districtSlug,
  locale,
  page,
}: {
  readonly citySlug?: string;
  readonly districtSlug?: string;
  readonly locale: PublicSiteLocale;
  readonly page: number;
}) {
  const directory = await fetchPublicPartners({
    city: citySlug,
    district: districtSlug,
    page,
    take: 25,
  });
  const area = publicPartnerArea(citySlug, districtSlug, locale);
  const selectedCity = area.city;
  const copy = directoryCopy[locale];
  const base = `/${locale}/partners`;

  return (
    <div className="hands-site public-directory-page">
      <HandsSiteHeader
        currentPath={`/partners${citySlug ? `/${citySlug}` : ''}${districtSlug ? `/${districtSlug}` : ''}`}
        locale={locale}
      />
      <main>
        <section className="directory-hero">
          <p className="eyebrow dark">HANDS PARTNER DIRECTORY</p>
          <h1>{copy.title(area.label)}</h1>
          <p>{copy.intro}</p>
          <strong>{copy.count(directory.pagination.total.toLocaleString(locale))}</strong>
        </section>

        <section className="directory-regions" aria-label={copy.regionLabel}>
          <div className="directory-city-links">
            <Link className={!citySlug ? 'is-active' : ''} href={base}>
              {copy.all}
            </Link>
            {publicPartnerAreas.map((city) => (
              <Link
                className={city.slug === citySlug ? 'is-active' : ''}
                href={`${base}/${city.slug}`}
                key={city.slug}
              >
                {publicPartnerArea(city.slug, undefined, locale).cityLabel}
              </Link>
            ))}
          </div>
          {selectedCity?.districts.length ? (
            <div className="directory-district-links">
              <Link
                className={!districtSlug || districtSlug === 'all' ? 'is-active' : ''}
                href={`${base}/${selectedCity.slug}`}
              >
                {copy.all}
              </Link>
              {selectedCity.districts.map(([slug]) => (
                <Link
                  className={slug === districtSlug ? 'is-active' : ''}
                  href={`${base}/${selectedCity.slug}/${slug}`}
                  key={slug}
                >
                  {publicPartnerArea(selectedCity.slug, slug, locale).districtLabel}
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        <section className="directory-results">
          <div className="directory-results-heading">
            <div>
              <p className="eyebrow dark">AVAILABLE PROFILES</p>
              <h2>{copy.resultsTitle(area.label)}</h2>
            </div>
            <span>{copy.sortLabel}</span>
          </div>

          {directory.items.length ? (
            <div className="public-partner-grid">
              {directory.items.map((partner) => (
                <Link
                  className="public-partner-card"
                  href={publicPartnerDetailPath(partner, locale)}
                  key={partner.id}
                >
                  <PublicPartnerMedia partner={partner} />
                  <div className="public-partner-card-copy">
                    <div>
                      <h3>{partner.displayName}</h3>
                      <p>{partnerAreaLabel(partner, locale)}</p>
                    </div>
                    <span>{ratingLabel(partner, copy)}</span>
                  </div>
                  <div className="public-partner-card-footer">
                    <span>{specialtyLabel(partner.specialties, copy)}</span>
                    <strong>{priceLabel(partner.startingPrice, copy)}</strong>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="directory-empty">
              <span>HANDS</span>
              <h3>{copy.emptyTitle}</h3>
              <p>{copy.emptyBody}</p>
            </div>
          )}

          <Pagination
            citySlug={citySlug}
            districtSlug={districtSlug}
            locale={locale}
            page={directory.pagination.page}
            totalPages={directory.pagination.totalPages}
          />
        </section>

        <section className="directory-download" id="download">
          <p className="eyebrow">CONTINUE IN THE HANDS APP</p>
          <h2>{copy.downloadTitle}</h2>
          <div className="download-actions">
            <a className="store-button" href="#download">
              <small>Download on the</small>
              <strong>App Store</strong>
            </a>
            <a className="store-button" href="#download">
              <small>GET IT ON</small>
              <strong>Google Play</strong>
            </a>
          </div>
        </section>
      </main>
      <HandsSiteFooter locale={locale} />
    </div>
  );
}

export function PublicPartnerMedia({
  partner,
  className = '',
}: {
  readonly partner: PublicPartner;
  readonly className?: string;
}) {
  const mediaUrl = safePublicMediaUrl(partner.profileImageUrl);

  return (
    <div
      className={`media-placeholder public-partner-media ${mediaUrl ? 'has-image' : ''} ${className}`}
      style={mediaUrl ? { backgroundImage: `url("${mediaUrl.replaceAll('"', '%22')}")` } : undefined}
      aria-label={`${partner.displayName} 프로필 이미지`}
    >
      {mediaUrl ? null : <span>PARTNER MEDIA</span>}
    </div>
  );
}

function Pagination({
  citySlug,
  districtSlug,
  locale,
  page,
  totalPages,
}: {
  readonly citySlug?: string;
  readonly districtSlug?: string;
  readonly locale: PublicSiteLocale;
  readonly page: number;
  readonly totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const path = `/${locale}/partners${citySlug ? `/${citySlug}` : ''}${districtSlug ? `/${districtSlug}` : ''}`;
  const copy = directoryCopy[locale];

  return (
    <nav className="directory-pagination" aria-label={copy.paginationLabel}>
      {page > 1 ? <Link href={`${path}?page=${page - 1}`}>{copy.previous}</Link> : <span />}
      <strong>
        {page} / {totalPages}
      </strong>
      {page < totalPages ? <Link href={`${path}?page=${page + 1}`}>{copy.next}</Link> : <span />}
    </nav>
  );
}

function ratingLabel(partner: PublicPartner, copy: DirectoryCopy) {
  const rating = Number(partner.ratingAvg ?? 0);
  return rating > 0 ? copy.rating(rating.toFixed(1), partner.reviewCount ?? 0) : copy.newPartner;
}

function partnerAreaLabel(partner: PublicPartner, locale: PublicSiteLocale) {
  return publicPartnerArea(
    partner.location?.citySlug,
    partner.location?.districtSlug,
    locale,
  ).label;
}

function priceLabel(value: number | null | undefined, copy: DirectoryCopy) {
  return value ? copy.price(value.toLocaleString('vi-VN')) : copy.priceInApp;
}

function specialtyLabel(value: unknown, copy: DirectoryCopy) {
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === 'string').slice(0, 2);
    if (items.length) return items.join(' · ');
  }
  return copy.wellness;
}

type DirectoryCopy = (typeof directoryCopy)[PublicSiteLocale];

const directoryCopy = {
  ko: {
    title: (area: string) => `${area} HANDS 마사지 테라피스트`,
    intro: '지역별 마사지 테라피스트의 서비스, 가격과 고객 리뷰를 확인하세요. 예약은 HANDS 앱에서 진행됩니다.',
    count: (count: string) => `${count}명`,
    regionLabel: '마사지 테라피스트 지역',
    all: '전체',
    resultsTitle: (area: string) => `${area}에서 만날 수 있는 마사지 테라피스트`,
    sortLabel: '평점과 리뷰 기준',
    emptyTitle: '현재 이 지역의 공개 마사지 테라피스트를 준비하고 있습니다.',
    emptyBody: '다른 지역을 선택하거나 HANDS 앱에서 가까운 마사지 테라피스트를 확인해 주세요.',
    downloadTitle: '실시간 이용 가능 여부와 예약은 HANDS 앱에서 확인하세요.',
    paginationLabel: '마사지 테라피스트 목록 페이지',
    previous: '이전',
    next: '다음',
    rating: (rating: string, count: number) => `${rating} · 리뷰 ${count}`,
    newPartner: '새 마사지 테라피스트',
    price: (price: string) => `${price} VND부터`,
    priceInApp: '앱에서 가격 확인',
    wellness: '웰니스 서비스',
  },
  vi: {
    title: (area: string) => `Đối tác HANDS tại ${area}`,
    intro: 'Xem dịch vụ, giá và đánh giá theo từng khu vực. Đặt lịch trong ứng dụng HANDS.',
    count: (count: string) => `${count} đối tác`,
    regionLabel: 'Khu vực đối tác',
    all: 'Tất cả',
    resultsTitle: (area: string) => `Đối tác tại ${area}`,
    sortLabel: 'Theo đánh giá',
    emptyTitle: 'HANDS đang cập nhật đối tác tại khu vực này.',
    emptyBody: 'Chọn khu vực khác hoặc mở ứng dụng HANDS để tìm đối tác gần bạn.',
    downloadTitle: 'Xem lịch hoạt động và đặt dịch vụ trong ứng dụng HANDS.',
    paginationLabel: 'Trang danh sách đối tác',
    previous: 'Trước',
    next: 'Sau',
    rating: (rating: string, count: number) => `${rating} · ${count} đánh giá`,
    newPartner: 'Đối tác mới',
    price: (price: string) => `Từ ${price} VND`,
    priceInApp: 'Xem giá trong ứng dụng',
    wellness: 'Dịch vụ wellness',
  },
  en: {
    title: (area: string) => `HANDS partners in ${area}`,
    intro: 'Compare services, prices and customer reviews by area. Booking continues in the HANDS app.',
    count: (count: string) => `${count} partners`,
    regionLabel: 'Partner area',
    all: 'All',
    resultsTitle: (area: string) => `Partners available in ${area}`,
    sortLabel: 'By rating and reviews',
    emptyTitle: 'Public partner profiles are coming to this area.',
    emptyBody: 'Choose another area or open HANDS to find nearby partners.',
    downloadTitle: 'Check live availability and book in the HANDS app.',
    paginationLabel: 'Partner directory pages',
    previous: 'Previous',
    next: 'Next',
    rating: (rating: string, count: number) => `${rating} · ${count} reviews`,
    newPartner: 'New partner',
    price: (price: string) => `From ${price} VND`,
    priceInApp: 'See price in app',
    wellness: 'Wellness services',
  },
  ja: {
    title: (area: string) => `${area}のHANDSパートナー`,
    intro: '地域別にサービス、料金、レビューを比較できます。予約はHANDSアプリで行います。',
    count: (count: string) => `${count}名`,
    regionLabel: 'パートナーの地域',
    all: 'すべて',
    resultsTitle: (area: string) => `${area}で利用できるパートナー`,
    sortLabel: '評価・レビュー順',
    emptyTitle: 'この地域のパートナー情報を準備中です。',
    emptyBody: '別の地域を選ぶか、HANDSアプリで近くのパートナーをご確認ください。',
    downloadTitle: 'リアルタイムの空き状況と予約はHANDSアプリでご確認ください。',
    paginationLabel: 'パートナー一覧',
    previous: '前へ',
    next: '次へ',
    rating: (rating: string, count: number) => `${rating} · レビュー${count}件`,
    newPartner: '新しいパートナー',
    price: (price: string) => `${price} VNDから`,
    priceInApp: 'アプリで料金を確認',
    wellness: 'ウェルネスサービス',
  },
  zh: {
    title: (area: string) => `${area} HANDS伙伴`,
    intro: '按地区查看服务、价格和客户评价。预约请在HANDS应用内完成。',
    count: (count: string) => `${count}位`,
    regionLabel: '伙伴地区',
    all: '全部',
    resultsTitle: (area: string) => `${area}可选伙伴`,
    sortLabel: '按评分与评价',
    emptyTitle: '该地区的公开伙伴资料正在准备中。',
    emptyBody: '请选择其他地区，或在HANDS应用内查找附近伙伴。',
    downloadTitle: '实时可用状态与预约请在HANDS应用内查看。',
    paginationLabel: '伙伴列表分页',
    previous: '上一页',
    next: '下一页',
    rating: (rating: string, count: number) => `${rating} · ${count}条评价`,
    newPartner: '新伙伴',
    price: (price: string) => `${price} VND起`,
    priceInApp: '在应用内查看价格',
    wellness: '健康服务',
  },
} satisfies Record<PublicSiteLocale, object>;
