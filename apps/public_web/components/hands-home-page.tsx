import Link from 'next/link';

import {
  publicPartnerDetailPath,
  safePublicMediaUrl,
  type PublicPartner,
} from '../lib/public-partners';
import type { PublicSiteLocale } from '../lib/site-content';
import { CustomerStoriesSection } from './customer-stories-section';
import { HandsSiteFooter, HandsSiteHeader } from './hands-site-chrome';
import { HeroVideoCard } from './hero-video-card';
import { HomeEditorialSections } from './home-editorial-sections';
import { HowStepsShowcase } from './how-steps-showcase';

const faqs = [
  {
    question: 'HANDS는 어떤 서비스인가요?',
    answer:
      '고객이 원하는 장소와 시간에 검증된 웰니스 마사지 테라피스트를 찾고 예약할 수 있는 온디맨드 플랫폼입니다.',
  },
  {
    question: '마사지 테라피스트 정보는 어떻게 확인하나요?',
    answer:
      '프로필, 제공 서비스, 이용 가격, 고객 리뷰와 운영 검증 상태를 한 화면에서 확인할 수 있습니다.',
  },
  {
    question: '예약 후에는 어떻게 진행되나요?',
    answer:
      '마사지 테라피스트가 예약을 수락하면 채팅과 실시간 상태를 통해 이동부터 서비스 완료까지 확인할 수 있습니다.',
  },
  {
    question: '안전 문제가 생기면 어떻게 하나요?',
    answer:
      '예약 기록과 채팅, 위치 기록을 기반으로 HANDS 고객지원이 신고와 분쟁 처리를 지원합니다.',
  },
];

const howSteps = [
  {
    title: '주소를 선택하세요',
    body: '서비스를 받을 위치를 정하면 가까운 마사지 테라피스트를 우선 보여드립니다.',
    image: '/images/how/how-anywhere.webp',
    imagePosition: 'center bottom',
  },
  {
    title: '마사지 테라피스트와 서비스를 고르세요',
    body: '프로필, 가격과 리뷰를 비교하고 원하는 서비스를 선택합니다.',
    image: '/images/recruitment/partner-recruitment-hero.png',
    imagePosition: 'center 34%',
  },
  {
    title: '예약하고 편안하게 기다리세요',
    body: '매칭 이후 채팅과 예약 상태를 확인하며 마사지 테라피스트를 기다립니다.',
    image: '/images/news/partner-arrival-story.png',
    imagePosition: 'center 36%',
  },
] as const;

const localizedFaqs: Record<Exclude<PublicSiteLocale, 'ko'>, typeof faqs> = {
  vi: [
    {
      question: 'HANDS là dịch vụ gì?',
      answer: 'HANDS giúp bạn tìm và đặt lịch với đối tác wellness đã được xác minh tại địa điểm và thời gian mong muốn.',
    },
    {
      question: 'Tôi kiểm tra thông tin đối tác ở đâu?',
      answer: 'Hồ sơ, dịch vụ, giá và đánh giá của khách hàng được hiển thị trước khi đặt lịch.',
    },
    {
      question: 'Sau khi đặt lịch sẽ diễn ra như thế nào?',
      answer: 'Khi đối tác chấp nhận, bạn có thể theo dõi trạng thái và trò chuyện cho đến khi dịch vụ hoàn tất.',
    },
  ],
  en: [
    {
      question: 'What is HANDS?',
      answer: 'HANDS helps you find and book verified wellness partners at the place and time you choose.',
    },
    {
      question: 'How can I review a partner?',
      answer: 'Profiles, services, prices and customer reviews are available before you book.',
    },
    {
      question: 'What happens after booking?',
      answer: 'Once a partner accepts, live status and chat keep the journey clear through completion.',
    },
  ],
  ja: [
    {
      question: 'HANDSとはどのようなサービスですか？',
      answer: '希望する場所と時間に、確認済みのウェルネスパートナーを探して予約できるサービスです。',
    },
    {
      question: 'パートナー情報はどこで確認できますか？',
      answer: '予約前にプロフィール、サービス、料金、カスタマーレビューを確認できます。',
    },
    {
      question: '予約後はどう進みますか？',
      answer: 'パートナーが承認すると、完了までステータスとチャットで進行状況を確認できます。',
    },
  ],
  zh: [
    {
      question: 'HANDS是什么服务？',
      answer: 'HANDS帮助您在所选地点和时间寻找并预约经过验证的健康服务伙伴。',
    },
    {
      question: '在哪里查看伙伴信息？',
      answer: '预约前可查看伙伴资料、服务、价格和客户评价。',
    },
    {
      question: '预约后如何进行？',
      answer: '伙伴接受后，您可以通过状态和聊天了解服务完成前的整个过程。',
    },
  ],
};

export function HandsHomePage({
  locale = 'ko',
  partners = [],
}: {
  readonly locale?: PublicSiteLocale;
  readonly partners?: PublicPartner[];
}) {
  if (locale !== 'ko') {
    return <LocalizedHandsHomePage locale={locale} partners={partners} />;
  }

  return (
    <div className="hands-site hands-home">
      <HandsSiteHeader locale={locale} theme="overlay" />

      <main>
        <section className="hero" id="top">
          <div className="media-placeholder hero-media" aria-label="히어로 이미지 자리">
            <span>HERO MEDIA</span>
          </div>
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-content">
            <p className="eyebrow">HANDS · WELLNESS AT YOUR DOOR</p>
            <h1>당신이 있는 곳이 가장 편안한 웰니스 공간이 됩니다.</h1>
            <p className="hero-copy">
              가까운 전문 마사지 테라피스트를 찾고, 원하는 서비스를 선택하고, 익숙한 공간에서
              편안하게 시작하세요.
            </p>
            <div className="hero-actions">
              <a className="button button-light" href="#download">
                HANDS 시작하기
              </a>
              <a className="text-button" href="#partners">
                마사지 테라피스트 둘러보기 <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <HeroVideoCard
            subtitle="예약부터 완료까지 연결되는 과정을 확인하세요."
            title="사람이 직접 전하는 마사지 테라피스트 1:1 웰니스 코칭"
          />
        </section>

        <section className="statement-section reveal">
          <p className="eyebrow dark">A BETTER WAY TO FEEL BETTER</p>
          <h2>
            집에서,
            <br />
            여행지에서,
            <br />
            지금 필요한 순간에.
          </h2>
          <div className="value-grid">
            <article>
              <span>01</span>
              <h3>가까운 마사지 테라피스트</h3>
              <p>현재 위치를 기준으로 이용 가능한 마사지 테라피스트를 한눈에 비교합니다.</p>
            </article>
            <article>
              <span>02</span>
              <h3>투명한 선택</h3>
              <p>서비스, 가격, 리뷰를 확인하고 나에게 맞는 마사지 테라피스트를 선택합니다.</p>
            </article>
            <article>
              <span>03</span>
              <h3>연결된 경험</h3>
              <p>예약, 채팅, 결제와 고객지원을 하나의 흐름으로 연결합니다.</p>
            </article>
          </div>
        </section>

        <HomeEditorialSections />

        <HowStepsShowcase actionLabel="HANDS 시작하기" steps={howSteps} />

        <CustomerStoriesSection />

        <HomeFaqSection faqs={faqs} title="자주 묻는 질문" />

        <HomePartnerStrip locale={locale} partners={partners} />

        <HomeFinalCta locale={locale} />

      </main>

      <HandsSiteFooter locale={locale} />
    </div>
  );
}

const localizedHomeCopy = {
  vi: {
    hero: 'Không gian wellness thoải mái nhất bắt đầu ngay nơi bạn đang ở.',
    heroBody: 'Tìm đối tác chuyên nghiệp gần bạn, chọn dịch vụ và tận hưởng tại nơi quen thuộc.',
    start: 'Bắt đầu với HANDS',
    browse: 'Xem đối tác',
    statement: 'Tại nhà. Khi đi du lịch. Ngay khi bạn cần.',
    values: [
      ['Đối tác gần bạn', 'So sánh đối tác đang hoạt động theo vị trí của bạn.'],
      ['Lựa chọn minh bạch', 'Xem dịch vụ, giá và đánh giá trước khi lựa chọn.'],
      ['Trải nghiệm liền mạch', 'Đặt lịch, trò chuyện, thanh toán và hỗ trợ trong một hành trình.'],
    ],
    steps: [
      ['Chọn địa chỉ', 'Chọn nơi nhận dịch vụ để xem các đối tác gần bạn trước.'],
      ['Chọn đối tác và dịch vụ', 'So sánh hồ sơ, mức giá và đánh giá trước khi lựa chọn.'],
      ['Đặt lịch và chờ thoải mái', 'Theo dõi trạng thái và trò chuyện sau khi đối tác xác nhận.'],
    ],
    faqTitle: 'Câu hỏi thường gặp',
    videoTitle: 'Xem cách HANDS kết nối dịch vụ wellness 1:1',
    videoSubtitle: 'Từ lựa chọn đối tác đến khi hoàn tất đặt lịch.',
  },
  en: {
    hero: 'Where you are becomes your most comfortable wellness space.',
    heroBody: 'Find a nearby professional, choose a service and begin in a familiar place.',
    start: 'Start with HANDS',
    browse: 'Browse partners',
    statement: 'At home. While travelling. Whenever you need it.',
    values: [
      ['Nearby partners', 'Compare available partners based on your current location.'],
      ['Transparent choice', 'Review services, prices and feedback before choosing.'],
      ['Connected experience', 'Booking, chat, payment and support in one journey.'],
    ],
    steps: [
      ['Choose an address', 'Set the service location to see nearby partners first.'],
      ['Choose a partner and service', 'Compare profiles, prices and reviews before choosing.'],
      ['Book and relax', 'Follow live status and chat after your partner accepts.'],
    ],
    faqTitle: 'Frequently asked questions',
    videoTitle: 'See how HANDS connects wellness',
    videoSubtitle: 'From choosing a partner to completing a booking.',
  },
  ja: {
    hero: '今いる場所が、いちばん心地よいウェルネス空間になります。',
    heroBody: '近くのプロを見つけ、サービスを選び、慣れた場所でくつろぎの時間を始めましょう。',
    start: 'HANDSを始める',
    browse: 'パートナーを見る',
    statement: '自宅で。旅先で。必要なその瞬間に。',
    values: [
      ['近くのパートナー', '現在地を基準に利用可能なパートナーを比較できます。'],
      ['分かりやすい選択', 'サービス、料金、レビューを確認して選べます。'],
      ['つながる体験', '予約、チャット、決済、サポートを一つの流れで提供します。'],
    ],
    steps: [
      ['住所を選ぶ', 'サービスを受ける場所を設定すると、近くのパートナーを優先表示します。'],
      ['パートナーとサービスを選ぶ', 'プロフィール、料金、レビューを比較して選択します。'],
      ['予約してゆっくり待つ', '承認後はステータスとチャットで進行状況を確認できます。'],
    ],
    faqTitle: 'よくある質問',
    videoTitle: 'HANDSの利用方法を見る',
    videoSubtitle: 'パートナー選びから予約完了まで。',
  },
  zh: {
    hero: '您所在的地方，就是最舒适的健康服务空间。',
    heroBody: '寻找附近的专业伙伴，选择所需服务，在熟悉的空间轻松开始。',
    start: '开始使用HANDS',
    browse: '浏览伙伴',
    statement: '在家中。在旅途中。在您需要的此刻。',
    values: [
      ['附近伙伴', '根据当前位置比较可提供服务的伙伴。'],
      ['透明选择', '查看服务、价格和评价后再做选择。'],
      ['连贯体验', '预约、聊天、支付和客户支持贯穿整个流程。'],
    ],
    steps: [
      ['选择地址', '设置服务地点后，优先查看附近的服务伙伴。'],
      ['选择伙伴和服务', '比较资料、价格和评价后再做选择。'],
      ['预约后安心等待', '伙伴确认后，可通过状态和聊天了解进度。'],
    ],
    faqTitle: '常见问题',
    videoTitle: '了解HANDS如何连接服务',
    videoSubtitle: '从选择伙伴到完成预约。',
  },
} as const;

function LocalizedHandsHomePage({
  locale,
  partners,
}: {
  readonly locale: Exclude<PublicSiteLocale, 'ko'>;
  readonly partners: PublicPartner[];
}) {
  const copy = localizedHomeCopy[locale];
  const base = `/${locale}`;

  return (
    <div className="hands-site hands-home">
      <HandsSiteHeader locale={locale} theme="overlay" />
      <main>
        <section className="hero" id="top">
          <div className="media-placeholder hero-media" aria-label="HANDS wellness" />
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-content">
            <p className="eyebrow">HANDS · WELLNESS AT YOUR DOOR</p>
            <h1>{copy.hero}</h1>
            <p className="hero-copy">{copy.heroBody}</p>
            <div className="hero-actions">
              <a className="button button-light" href="#download">{copy.start}</a>
              <Link className="text-button" href={`${base}/partners`}>{copy.browse} ↗</Link>
            </div>
          </div>
          <HeroVideoCard subtitle={copy.videoSubtitle} title={copy.videoTitle} />
        </section>

        <section className="statement-section reveal">
          <p className="eyebrow dark">A BETTER WAY TO FEEL BETTER</p>
          <h2>{copy.statement}</h2>
          <div className="value-grid">
            {copy.values.map(([title, body], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <HomeEditorialSections />

        <HowStepsShowcase
          actionLabel={copy.start}
          steps={copy.steps.map(([title, body], index) => ({
            ...howSteps[index],
            title,
            body,
          }))}
        />

        <CustomerStoriesSection />

        <HomeFaqSection faqs={localizedFaqs[locale]} title={copy.faqTitle} />

        <HomePartnerStrip locale={locale} partners={partners} />

        <HomeFinalCta locale={locale} />

      </main>
      <HandsSiteFooter locale={locale} />
    </div>
  );
}

const partnerStripCopy: Record<PublicSiteLocale, readonly [string, string]> = {
  ko: ['가까운 마사지 테라피스트', '전체 보기'],
  vi: ['Massage therapist gần bạn', 'Xem tất cả'],
  en: ['Massage therapists near you', 'View all'],
  ja: ['近くのマッサージセラピスト', 'すべて見る'],
  zh: ['附近的按摩理疗师', '查看全部'],
};

const fallbackHomePartners = [
  {
    id: 'minh-anh',
    displayName: 'Minh Anh',
    location: 'Quận 1, TP.HCM',
    image: '/images/recruitment/partner-recruitment-hero.png',
  },
  {
    id: 'thanh-vy',
    displayName: 'Thanh Vy',
    location: 'Thủ Đức, TP.HCM',
    image: '/images/editorial/method-partner.webp',
  },
  {
    id: 'ngoc-han',
    displayName: 'Ngoc Han',
    location: 'Tây Hồ, Hà Nội',
    image: '/images/editorial/feature-coach.webp',
  },
] as const;

function HomePartnerStrip({
  locale,
  partners,
}: {
  readonly locale: PublicSiteLocale;
  readonly partners: PublicPartner[];
}) {
  const [title, action] = partnerStripCopy[locale];
  const profiles = partners.length
    ? partners.slice(0, 5).map((partner) => ({
        id: partner.id,
        displayName: partner.displayName,
        location: partner.location?.districtLabel ?? partner.location?.cityLabel ?? '',
        image: safePublicMediaUrl(partner.profileImageUrl),
        href: publicPartnerDetailPath(partner, locale),
      }))
    : fallbackHomePartners.map((partner) => ({
        ...partner,
        href: `/${locale}/partners`,
      }));

  return (
    <section className="home-partner-strip" aria-labelledby="home-partner-strip-title">
      <div className="home-partner-strip-heading">
        <div>
          <p className="eyebrow dark">HANDS MASSAGE THERAPISTS</p>
          <h2 id="home-partner-strip-title">{title}</h2>
        </div>
        <Link href={`/${locale}/partners`}>{action} ↗</Link>
      </div>
      <div className="home-partner-strip-list">
        {profiles.map((partner) => (
          <Link className="home-partner-strip-card" href={partner.href} key={partner.id}>
            <span
              className="home-partner-strip-media"
              role="img"
              aria-label={partner.displayName}
              style={partner.image ? { backgroundImage: `url("${partner.image}")` } : undefined}
            />
            <strong>{partner.displayName}</strong>
            <small>{partner.location}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HomeFaqSection({
  faqs: items,
  title,
}: {
  readonly faqs: readonly { readonly question: string; readonly answer: string }[];
  readonly title: string;
}) {
  return (
    <section className="faq-section" id="faq">
      <div className="faq-panel">
        <div className="faq-content">
          <div className="faq-heading reveal">
            <p className="eyebrow">QUESTIONS, ANSWERED</p>
            <h2>{title}</h2>
          </div>
          <div className="faq-list">
            {items.map((faq, index) => (
              <details
                className="reveal"
                key={faq.question}
                name="hands-home-faq"
                open={index === 0}
              >
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
        <div className="faq-media" role="img" aria-label="HANDS 웰니스 마사지 테라피스트">
          <div className="faq-media-card">
            <strong>HANDS</strong>
            <span>예약부터 완료까지 연결된 고객지원</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const finalCtaCopy: Record<PublicSiteLocale, readonly [string, string]> = {
  ko: ['내 일상에 맞는 웰니스 마사지 테라피스트를 만나보세요.', '마사지 테라피스트 찾기'],
  vi: ['Tìm đối tác wellness phù hợp với nhịp sống của bạn.', 'Tìm đối tác'],
  en: ['Find a wellness partner made for your real-world lifestyle.', 'Find a partner'],
  ja: ['あなたの日常に合うウェルネスパートナーを見つけましょう。', 'パートナーを探す'],
  zh: ['寻找适合您日常生活的健康服务伙伴。', '寻找伙伴'],
};

function HomeFinalCta({ locale }: { readonly locale: PublicSiteLocale }) {
  const [title, action] = finalCtaCopy[locale];

  return (
    <section aria-labelledby="home-final-cta-title" className="home-final-cta" id="download">
      <div className="home-final-cta-content">
        <h2 id="home-final-cta-title">{title}</h2>
        <Link className="home-final-cta-button" href={`/${locale}/partners`}>
          {action} <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
