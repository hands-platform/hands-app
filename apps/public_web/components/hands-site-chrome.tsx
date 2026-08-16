import Link from 'next/link';

import type { PublicSiteLocale } from '../lib/site-content';

type HandsSiteChromeProps = {
  readonly currentPath?: string;
  readonly locale?: PublicSiteLocale;
  readonly theme?: 'overlay' | 'solid';
  readonly site?: 'main' | 'recruitment';
};

const mainChromeCopy = {
  ko: {
    menu: ['HANDS 마사지 테라피스트', '새로운 소식', '마사지 테라피스트 지원'],
    language: '언어',
    download: '앱 다운로드',
  },
  vi: {
    menu: ['Đối tác HANDS', 'Tin mới', 'Đăng ký đối tác'],
    language: 'Ngôn ngữ',
    download: 'Tải ứng dụng',
  },
  en: {
    menu: ['HANDS Partners', 'News', 'Partner with us'],
    language: 'Language',
    download: 'Download app',
  },
  ja: {
    menu: ['HANDSパートナー', '最新情報', 'パートナー募集'],
    language: '言語',
    download: 'アプリをダウンロード',
  },
  zh: {
    menu: ['HANDS伙伴', '最新消息', '加入伙伴'],
    language: '语言',
    download: '下载应用',
  },
} as const;

const languageLinks: Array<[PublicSiteLocale, string]> = [
  ['ko', '한국어'],
  ['vi', 'Tiếng Việt'],
  ['en', 'English'],
  ['ja', '日本語'],
  ['zh', '中文'],
];

const footerGroupPaths = [
  ['/company', '/service-areas', '/contact'],
  ['/support/faq', '/safety', '/support/disputes'],
  ['https://join.hands.vn', '/partner-policy', '/legal/partner-terms'],
  ['/legal/privacy', '/legal/terms', '/legal/cookies', '/company-info'],
] as const;

const footerCopy = {
  ko: {
    groups: [
      ['HANDS', ['회사 소개', '서비스 지역', '문의하기']],
      ['고객지원', ['자주 묻는 질문', '안전과 신뢰', '신고 및 분쟁 처리']],
      ['파트너', ['파트너 지원', '파트너 운영정책', '파트너 이용약관']],
      ['법적 정보', ['개인정보처리방침', '서비스 이용약관', '쿠키 정책', '사업자 정보']],
    ],
    utility: ['이용 방법', '안전과 신뢰', '파트너 지원'],
    language: '한국어',
    download: '앱 다운로드',
    navigation: '푸터 메뉴',
  },
  vi: {
    groups: [
      ['HANDS', ['Giới thiệu HANDS', 'Khu vực dịch vụ', 'Liên hệ']],
      ['Hỗ trợ khách hàng', ['Câu hỏi thường gặp', 'An toàn và tin cậy', 'Báo cáo và tranh chấp']],
      ['Đối tác', ['Đăng ký đối tác', 'Chính sách hoạt động đối tác', 'Điều khoản đối tác']],
      [
        'Thông tin pháp lý',
        ['Chính sách quyền riêng tư', 'Điều khoản dịch vụ', 'Chính sách cookie', 'Thông tin doanh nghiệp'],
      ],
    ],
    utility: ['Cách hoạt động', 'An toàn và tin cậy', 'Đăng ký đối tác'],
    language: 'Tiếng Việt',
    download: 'Tải ứng dụng',
    navigation: 'Menu chân trang',
  },
  en: {
    groups: [
      ['HANDS', ['About HANDS', 'Service areas', 'Contact']],
      ['Customer support', ['Frequently asked questions', 'Safety and trust', 'Reports and disputes']],
      ['Partners', ['Partner with us', 'Partner operating policy', 'Partner terms']],
      ['Legal information', ['Privacy policy', 'Terms of service', 'Cookie policy', 'Company information']],
    ],
    utility: ['How it works', 'Safety and trust', 'Partner with us'],
    language: 'English',
    download: 'Download app',
    navigation: 'Footer menu',
  },
  ja: {
    groups: [
      ['HANDS', ['会社紹介', 'サービスエリア', 'お問い合わせ']],
      ['カスタマーサポート', ['よくある質問', '安全と信頼', '通報・紛争対応']],
      ['パートナー', ['パートナー募集', 'パートナー運営ポリシー', 'パートナー規約']],
      ['法的情報', ['プライバシーポリシー', '利用規約', 'Cookieポリシー', '事業者情報']],
    ],
    utility: ['ご利用方法', '安全と信頼', 'パートナー募集'],
    language: '日本語',
    download: 'アプリをダウンロード',
    navigation: 'フッターメニュー',
  },
  zh: {
    groups: [
      ['HANDS', ['公司介绍', '服务地区', '联系我们']],
      ['客户支持', ['常见问题', '安全与信赖', '举报与争议处理']],
      ['伙伴', ['加入伙伴', '伙伴运营政策', '伙伴条款']],
      ['法律信息', ['隐私政策', '服务条款', 'Cookie政策', '企业信息']],
    ],
    utility: ['使用方法', '安全与信赖', '加入伙伴'],
    language: '中文',
    download: '下载应用',
    navigation: '页脚菜单',
  },
} as const;

export function HandsSiteHeader({
  currentPath = '/',
  locale = 'ko',
  theme = 'solid',
  site = 'main',
}: HandsSiteChromeProps) {
  const recruitment = site === 'recruitment';
  const copy = mainChromeCopy[locale];
  const localized = (path: string) => `/${locale}${path === '/' ? '' : path}`;

  return (
    <header className={`hands-header ${theme === 'solid' ? 'is-solid' : ''}`}>
      <Link
        className="hands-logo"
        href={recruitment ? 'https://join.hands.vn/' : localized('/')}
        aria-label="HANDS"
      >
        HANDS
      </Link>
      <nav
        aria-hidden={recruitment || undefined}
        aria-label={recruitment ? undefined : copy.menu.join(', ')}
        className="hands-nav"
      >
        {!recruitment && (
          <>
            <Link href={localized('/partners')}>{copy.menu[0]}</Link>
            <Link href={localized('/news')}>{copy.menu[1]}</Link>
            <a href="https://join.hands.vn">{copy.menu[2]}</a>
          </>
        )}
      </nav>
      <details className="mobile-nav">
        <summary aria-label={recruitment ? 'Mở menu' : '메뉴 열기'}>
          <span aria-hidden="true" />
        </summary>
        <div className="mobile-nav-panel">
          {recruitment ? (
            <nav aria-label="Menu đối tác">
              <a href="https://join.hands.vn/">Đăng ký đối tác</a>
            </nav>
          ) : (
            <>
              <nav aria-label="모바일 메뉴">
                <Link href={localized('/partners')}>{copy.menu[0]}</Link>
                <Link href={localized('/news')}>{copy.menu[1]}</Link>
                <a href="https://join.hands.vn">{copy.menu[2]}</a>
              </nav>
              <div className="mobile-language-menu">
                <strong>{copy.language}</strong>
                <div>
                  {languageLinks.map(([nextLocale, label]) => (
                    <Link
                      aria-current={nextLocale === locale ? 'page' : undefined}
                      href={`/${nextLocale}${currentPath === '/' ? '' : currentPath}`}
                      key={nextLocale}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
          <a
            className="button button-dark"
            href={recruitment ? 'https://join.hands.vn/' : localized('/partners#download')}
          >
            {recruitment ? 'Tải ứng dụng' : copy.download}
          </a>
        </div>
      </details>
      <div className="hands-header-actions">
        {!recruitment && (
          <details className="language-menu">
            <summary>{copy.language}</summary>
            <div>
              {languageLinks.map(([nextLocale, label]) => (
                <Link
                  aria-current={nextLocale === locale ? 'page' : undefined}
                  href={`/${nextLocale}${currentPath === '/' ? '' : currentPath}`}
                  key={nextLocale}
                >
                  {label}
                </Link>
              ))}
            </div>
          </details>
        )}
        <a
          className="button button-light"
          href={recruitment ? 'https://join.hands.vn/' : localized('/partners#download')}
        >
          {recruitment ? 'Tải ứng dụng' : copy.download}
        </a>
      </div>
    </header>
  );
}

export function HandsSiteFooter({
  locale = 'ko',
  site = 'main',
}: Pick<HandsSiteChromeProps, 'locale' | 'site'>) {
  const recruitment = site === 'recruitment';
  const copy = footerCopy[locale];
  const localized = (path: string) => `/${locale}${path === '/' ? '' : path}`;
  const footerHref = (path: string) =>
    recruitment && !path.startsWith('http') ? `https://join.hands.vn${path}` : path;
  const utilityPaths = ['/#how', '/safety', 'https://join.hands.vn'] as const;

  return (
    <footer className="hands-footer" role="contentinfo">
      <div className="hands-footer-brand">
        {recruitment ? (
          <a className="hands-footer-wordmark" href="https://join.hands.vn/" aria-label="HANDS">
            HANDS
          </a>
        ) : (
          <Link className="hands-footer-wordmark" href={localized('/')} aria-label="HANDS">
            HANDS
          </Link>
        )}
        <p>{recruitment ? 'Wellness tại nơi bạn cần.' : 'Wellness, wherever you are.'}</p>
      </div>

      <nav className="hands-footer-menu" aria-label={copy.navigation}>
        {copy.groups.map(([title, links], groupIndex) => (
          <div className="hands-footer-group" key={title}>
            <h2>{title}</h2>
            {links.map((label, linkIndex) => {
              const path = footerGroupPaths[groupIndex]?.[linkIndex];
              if (!path) return null;
              const href = footerHref(path);
              return href.startsWith('http') ? (
                <a href={href} key={label}>
                  {label}
                </a>
              ) : (
                <Link href={localized(href)} key={label}>
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="hands-footer-bottom">
        <p>© 2026 HANDS</p>
        <nav aria-label={copy.navigation}>
          {copy.utility.map((label, index) => {
            const href = footerHref(utilityPaths[index]);
            return href.startsWith('http') ? (
              <a href={href} key={label}>
                {label}
              </a>
            ) : (
              <Link href={localized(href)} key={label}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div>
          <span>{copy.language}</span>
          {recruitment ? (
            <a href="https://join.hands.vn/">{copy.download}</a>
          ) : (
            <Link href={localized('/partners#download')}>{copy.download}</Link>
          )}
        </div>
      </div>
    </footer>
  );
}
