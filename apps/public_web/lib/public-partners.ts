import type { PublicSiteLocale } from './site-content';

const API_BASE_URL = process.env.PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

export const publicPartnerAreas = [
  {
    slug: 'ho-chi-minh',
    label: '호찌민',
    districts: [
      ['district-1', '1군'],
      ['district-2', '2군'],
      ['district-3', '3군'],
      ['district-4', '4군'],
      ['district-5', '5군'],
      ['district-7', '7군'],
      ['binh-thanh', '빈탄군'],
      ['phu-nhuan', '푸뉴언군'],
      ['thu-duc', '투득시'],
    ],
  },
  {
    slug: 'ha-noi',
    label: '하노이',
    districts: [
      ['ba-dinh', '바딘'],
      ['hoan-kiem', '호안끼엠'],
      ['tay-ho', '떠이호'],
      ['cau-giay', '꺼우저이'],
    ],
  },
  {
    slug: 'da-nang',
    label: '다낭',
    districts: [
      ['hai-chau', '하이쩌우'],
      ['son-tra', '선짜'],
    ],
  },
  { slug: 'nha-trang', label: '나트랑', districts: [] },
] as const;

export type PublicPartner = {
  id: string;
  displayName: string;
  bio?: string | null;
  bioTranslations?: Record<string, unknown> | null;
  experienceYears?: number | null;
  specialties?: unknown;
  languages?: unknown;
  serviceStyle?: string | null;
  city?: string | null;
  ratingAvg?: number | string | null;
  reviewCount?: number;
  profileImageUrl?: string | null;
  galleryImageUrls?: string[];
  startingPrice?: number | null;
  startingDurationMin?: number | null;
  location?: {
    citySlug: string;
    cityLabel: string;
    districtSlug: string;
    districtLabel?: string | null;
  };
  services?: Array<{
    id: string;
    price: number;
    bookable?: boolean;
    service: {
      name: string;
      description?: string | null;
      durationMin: number;
    };
  }>;
  reviews?: Array<{
    rating: number;
    comment?: string | null;
    createdAt: string;
  }>;
};

export type PublicPartnerDirectory = {
  items: PublicPartner[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export async function fetchPublicPartners(input: {
  city?: string;
  district?: string;
  page?: number;
  take?: number;
}): Promise<PublicPartnerDirectory> {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    take: String(input.take ?? 24),
  });
  if (input.city && input.city !== 'vietnam') query.set('city', input.city);
  if (input.district && input.district !== 'all') query.set('district', input.district);

  try {
    const response = await fetch(`${API_BASE_URL}/public/partners?${query}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return emptyDirectory(input.page);
    return (await response.json()) as PublicPartnerDirectory;
  } catch {
    return emptyDirectory(input.page);
  }
}

export async function fetchPublicPartner(id: string): Promise<PublicPartner | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/public/partners/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicPartner;
  } catch {
    return null;
  }
}

export function publicPartnerArea(
  citySlug?: string,
  districtSlug?: string,
  locale: PublicSiteLocale = 'ko',
) {
  const city = publicPartnerAreas.find((area) => area.slug === citySlug);
  const district = city?.districts.find(([slug]) => slug === districtSlug);
  const cityLabel = city ? localizedCityLabel(city.slug, locale) : null;
  const districtLabel = district ? localizedDistrictLabel(district[0], district[1], locale) : null;
  return {
    city,
    district,
    cityLabel,
    districtLabel,
    label: districtLabel
      ? `${cityLabel} ${districtLabel}`
      : cityLabel ?? localizedAllVietnamLabel(locale),
  };
}

export function publicPartnerDetailPath(
  partner: PublicPartner,
  locale: PublicSiteLocale = 'ko',
) {
  const city = partner.location?.citySlug ?? 'vietnam';
  const district = partner.location?.districtSlug ?? 'all';
  return `/${locale}/partners/${city}/${district}/${partnerNameSlug(partner.displayName)}--${partner.id}`;
}

export function publicPartnerIdFromPath(value: string) {
  return value.split('--').at(-1) || value;
}

export function safePublicMediaUrl(value?: string | null) {
  if (!value) return null;
  try {
    const publicApiOrigin = API_BASE_URL.replace(/\/api\/?$/u, '/');
    const url = new URL(value, publicApiOrigin);
    return url.protocol === 'https:' || url.hostname === 'localhost' ? url.toString() : null;
  } catch {
    return null;
  }
}

function emptyDirectory(page = 1): PublicPartnerDirectory {
  return {
    items: [],
    pagination: {
      page,
      pageSize: 24,
      total: 0,
      totalPages: 1,
    },
  };
}

function partnerNameSlug(value: string) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'partner'
  );
}

const localizedCityLabels: Record<PublicSiteLocale, Record<string, string>> = {
  ko: { 'ho-chi-minh': '호찌민', 'ha-noi': '하노이', 'da-nang': '다낭', 'nha-trang': '나트랑' },
  vi: { 'ho-chi-minh': 'TP. Hồ Chí Minh', 'ha-noi': 'Hà Nội', 'da-nang': 'Đà Nẵng', 'nha-trang': 'Nha Trang' },
  en: { 'ho-chi-minh': 'Ho Chi Minh City', 'ha-noi': 'Hanoi', 'da-nang': 'Da Nang', 'nha-trang': 'Nha Trang' },
  ja: { 'ho-chi-minh': 'ホーチミン', 'ha-noi': 'ハノイ', 'da-nang': 'ダナン', 'nha-trang': 'ニャチャン' },
  zh: { 'ho-chi-minh': '胡志明市', 'ha-noi': '河内', 'da-nang': '岘港', 'nha-trang': '芽庄' },
};

function localizedCityLabel(citySlug: string, locale: PublicSiteLocale) {
  return localizedCityLabels[locale][citySlug] ?? citySlug;
}

function localizedDistrictLabel(
  districtSlug: string,
  fallback: string,
  locale: PublicSiteLocale,
) {
  const numbered = /^district-(\d+)$/u.exec(districtSlug)?.[1];
  if (numbered) {
    if (locale === 'ko') return `${numbered}군`;
    if (locale === 'vi') return `Quận ${numbered}`;
    if (locale === 'ja') return `${numbered}区`;
    if (locale === 'zh') return `${numbered}郡`;
    return `District ${numbered}`;
  }
  return fallback;
}

function localizedAllVietnamLabel(locale: PublicSiteLocale) {
  return {
    ko: '베트남 전역',
    vi: 'Toàn Việt Nam',
    en: 'Across Vietnam',
    ja: 'ベトナム全域',
    zh: '越南全境',
  }[locale];
}
