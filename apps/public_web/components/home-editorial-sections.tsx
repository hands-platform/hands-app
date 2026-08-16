'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

const featurePanels = [
  {
    action: '마사지 테라피스트 보기',
    body: '프로필과 서비스, 가격, 리뷰를 비교하고 지금 필요한 웰니스 마사지 테라피스트를 선택할 수 있습니다.',
    color: '#ffe1d6',
    href: '#partners',
    image: '/images/editorial/feature-coach.webp',
    title: '나에게 맞는 마사지 테라피스트와 서비스를 한 번에 비교하세요.',
  },
  {
    action: '이용 방법',
    body: '원하는 장소와 시간을 정하고 예약 상태와 채팅을 확인하며 서비스 시작을 기다릴 수 있습니다.',
    color: '#d7e9ff',
    href: '#how',
    image: '/images/editorial/feature-anywhere.webp',
    title: '예약 이후의 모든 순간을 한 화면에서 확인하세요.',
  },
  {
    action: '안전과 신뢰',
    body: '예약 기록과 고객지원 흐름이 연결되어 도움이 필요한 순간에도 필요한 정보를 확인할 수 있습니다.',
    color: '#cebffa',
    href: '#faq',
    image: '/images/editorial/feature-support.webp',
    title: '서비스가 끝날 때까지 HANDS가 연결을 이어갑니다.',
  },
] as const;

const sourceFeaturePanels = [
  {
    action: 'Meet the Team',
    body: 'Forget generic apps because we pair you with a real human trainer based on your unique personality and fitness level to provide the daily accountability and expert guidance you need to stay motivated and see real results.',
    color: '#ffe1d6',
    href: '#method',
    image: '/images/editorial/feature-coach.webp',
    title: 'Connect with an elite coach who builds your custom plan and stays by your side to ensure you reach every goal.',
  },
  {
    action: 'Explore Courses',
    body: 'Whether you are at a hotel gym or in your living room, your coach builds a dynamic schedule that fits your available equipment and energy levels so you never have to guess what exercise comes next to see real progress.',
    color: '#d7e9ff',
    href: '#results',
    image: '/images/editorial/feature-anywhere.webp',
    title: 'Future updates your workouts automatically, adjusting load, intensity, and movements for effective training.',
  },
  {
    action: 'Join Community',
    body: 'Get the professional encouragement and technical feedback you need right when you need it most because our coaches monitor your progress in real-time to adjust your path and celebrate every single victory with you.',
    color: '#cebffa',
    href: '#community',
    image: '/images/editorial/feature-support.webp',
    title: 'Connect with your trainer daily through a seamless chat and video experience built for your ultimate success.',
  },
] as const;

export function getFeatureRailOffset(
  scrollY: number,
  sectionTop: number,
  travel: number,
  maxOffset: number,
) {
  if (travel <= 0 || maxOffset <= 0) return 0;
  const progress = Math.min(1, Math.max(0, (scrollY - sectionTop) / travel));
  if (progress === 0) return 0;
  return -progress * maxOffset;
}

export function HomeEditorialSections({ sourceExact = false }: { readonly sourceExact?: boolean }) {
  const railRef = useRef<HTMLElement>(null);
  const panels = sourceExact ? sourceFeaturePanels : featurePanels;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rail = railRef.current;
    const sticky = rail?.querySelector<HTMLElement>('.home-feature-sticky');
    const track = rail?.querySelector<HTMLElement>('.home-feature-track');
    if (!rail || !sticky || !track) return;

    let frame = 0;
    let maxOffset = 0;

    const update = () => {
      frame = 0;
      const sectionTop = rail.getBoundingClientRect().top + window.scrollY;
      const travel = rail.offsetHeight - window.innerHeight;
      const offset = getFeatureRailOffset(window.scrollY, sectionTop, travel, maxOffset);
      track.style.transform = `translate3d(${offset}px, 0, 0)`;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const measure = () => {
      rail.style.setProperty(
        '--home-feature-width',
        `${document.documentElement.clientWidth * 0.9 - 36}px`,
      );
      maxOffset = Math.max(0, track.scrollWidth - sticky.clientWidth);
      rail.style.height = `${window.innerHeight + maxOffset}px`;
      update();
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', schedule);
    };
  }, []);

  return (
    <>
      <section
        aria-label="HANDS service experience"
        className="home-feature-rail"
        id="partners"
        ref={railRef}
      >
        <div className="home-feature-sticky">
          <div className="home-feature-track">
            {panels.map((panel) => (
              <article
                className="home-feature-panel"
                key={panel.title}
                style={{ backgroundColor: panel.color }}
              >
                <div
                  aria-label=""
                  className="home-feature-image"
                  role="img"
                  style={{ backgroundImage: `url("${panel.image}")` }}
                />
                <div className="home-feature-copy">
                  <h2>{panel.title}</h2>
                  <p>{panel.body}</p>
                  <a className="home-editorial-button" href={panel.href}>
                    {panel.action} <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="home-method-title"
        className="home-method-section limit-width"
        id="method"
      >
        <div className="home-method-copy">
          <div>
            <p className="home-method-kicker">
              <span aria-hidden="true">●</span> {sourceExact ? 'Our Method' : 'HANDS METHOD'}
            </p>
            <h2 id="home-method-title">
              {sourceExact ? 'Real human connection drives real results' : '사람과 사람의 연결이 더 나은 웰니스를 만듭니다.'}
            </h2>
            <p className="home-method-body">
              {sourceExact
                ? 'We combine elite personal coaching with an effortless digital experience because we know that a custom plan is only as good as the accountability behind it so your trainer is always there.'
                : '기술은 선택과 예약을 단순하게 만들고, 검증된 마사지 테라피스트는 고객이 원하는 장소에서 편안한 서비스를 완성합니다.'}
            </p>
          </div>
          <div className="home-method-stat">
            <Image
              alt=""
              className="home-method-stat-image"
              height={264}
              src="/images/editorial/method-stat.webp"
              width={264}
            />
            <div>
              <strong>{sourceExact ? '500k+' : '1:1'}</strong>
              <p>
                {sourceExact
                  ? 'Personalized workouts delivered and completed by our growing global community.'
                  : '고객의 선택과 마사지 테라피스트의 전문성을 한 번의 예약으로 연결합니다.'}
              </p>
            </div>
          </div>
        </div>

        <div className="home-method-media">
          <div className="home-method-media-copy">
            <h3>{sourceExact ? 'The 12-Week Evolution' : '웰니스가 필요한 순간을 위한 HANDS'}</h3>
            <p>
              {sourceExact
                ? 'A high-intensity journey designed to reset your habits through a daily expert guidance.'
                : '원하는 장소, 원하는 시간, 나에게 맞는 마사지 테라피스트.'}
            </p>
          </div>
          <div className="home-method-partner">
            <Image
              alt=""
              height={84}
              src="/images/editorial/method-partner.webp"
              width={84}
            />
            <div>
              <strong>{sourceExact ? 'Coach Mark Johnson' : 'HANDS Partner'}</strong>
              <span>{sourceExact ? 'Meet your Trainer' : 'Verified profile'}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
