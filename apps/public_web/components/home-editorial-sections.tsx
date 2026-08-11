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

export function HomeEditorialSections() {
  const railRef = useRef<HTMLElement>(null);

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
            {featurePanels.map((panel) => (
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
              <span aria-hidden="true">●</span> HANDS METHOD
            </p>
            <h2 id="home-method-title">사람과 사람의 연결이 더 나은 웰니스를 만듭니다.</h2>
            <p className="home-method-body">
              기술은 선택과 예약을 단순하게 만들고, 검증된 마사지 테라피스트는 고객이 원하는
              장소에서 편안한 서비스를 완성합니다.
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
              <strong>1:1</strong>
              <p>고객의 선택과 마사지 테라피스트의 전문성을 한 번의 예약으로 연결합니다.</p>
            </div>
          </div>
        </div>

        <div className="home-method-media">
          <div className="home-method-media-copy">
            <h3>웰니스가 필요한 순간을 위한 HANDS</h3>
            <p>원하는 장소, 원하는 시간, 나에게 맞는 마사지 테라피스트.</p>
          </div>
          <div className="home-method-partner">
            <Image
              alt=""
              height={84}
              src="/images/editorial/method-partner.webp"
              width={84}
            />
            <div>
              <strong>HANDS Partner</strong>
              <span>Verified profile</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
