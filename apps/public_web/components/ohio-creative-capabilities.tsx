'use client';

import Image from 'next/image';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

const cards = [
  {
    eyebrow: 'Kết nối',
    title: ['Dễ dàng', 'tiếp cận'],
    description: 'Cách tiếp cận rõ ràng giúp trải nghiệm của đối tác luôn nhất quán trên mọi điểm chạm.',
    image: '/images/ohio-creative/connection.jpeg',
  },
  {
    eyebrow: 'Hợp tác',
    title: ['Kết nối', 'chuyên nghiệp'],
    description: 'Xây dựng mạng lưới cộng tác bền vững để mỗi đối tác có thêm cơ hội phát triển nghề nghiệp.',
    image: '/images/ohio-creative/collaboration.jpeg',
  },
  {
    eyebrow: 'Đổi mới',
    title: ['Liên tục', 'tối ưu'],
    description: 'Theo dõi trải nghiệm thực tế để liên tục cải thiện quy trình và chất lượng phục vụ.',
    image: '/images/ohio-creative/innovations.jpeg',
  },
  {
    eyebrow: 'Trải nghiệm',
    title: ['Cùng nhau', 'phát triển'],
    description: 'Học hỏi từ cộng đồng và phát triển kỹ năng để tạo nên trải nghiệm dịch vụ đáng tin cậy.',
    image: '/images/ohio-creative/experience.jpeg',
  },
] as const;

function ArrowIcon({ size = 24 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 -960 960 960" width={size}>
      <path d="M646-442.5H170v-75h476L426.5-737l53.5-53 310 310-310 310-53.5-53L646-442.5Z" />
    </svg>
  );
}

export function OhioCreativeCapabilities() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const progress = progressRef.current;
    if (!progress) return;

    const bar = progress.querySelector<HTMLElement>('.ohio-progress-bar');
    const value = progress.querySelector<HTMLElement>('.ohio-progress-value');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    const finish = () => {
      progress.style.setProperty('--ohio-progress', '83%');
      if (value) value.textContent = '83';
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();

        if (reducedMotion) {
          finish();
          return;
        }

        const start = performance.now();
        const animate = (now: number) => {
          const elapsed = Math.min(1, (now - start) / 2200);
          const eased = 1 - Math.pow(1 - elapsed, 3);
          const current = Math.round(83 * eased);
          progress.style.setProperty('--ohio-progress', `${current}%`);
          if (value) value.textContent = String(current);
          if (elapsed < 1) frame = window.requestAnimationFrame(animate);
        };

        frame = window.requestAnimationFrame(animate);
      },
      { threshold: 0.35 },
    );

    observer.observe(progress);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      if (bar) bar.style.removeProperty('width');
    };
  }, []);

  const tilt = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const rotateX = ((event.clientY - rect.top) / rect.height - 0.5) * -4;
    const rotateY = ((event.clientX - rect.left) / rect.width - 0.5) * 4;
    card.style.transform = `perspective(6000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const resetTilt = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.transform = 'perspective(6000px) rotateX(0deg) rotateY(0deg)';
  };

  return (
    <section className="ohio-creative-section" aria-label="Năng lực và kinh nghiệm">
      <div className="ohio-creative-shell">
        <div className="ohio-section-spacer" aria-hidden="true" />

        <div className="ohio-intro-row">
          <div className="ohio-intro-copy">
            <h2>
              Kinh nghiệm thực tế
              <br className="ohio-desktop-break" /> và quy trình rõ ràng giúp
              <br className="ohio-desktop-break" /> đối tác tự tin phát triển
              <br className="ohio-desktop-break" /> cùng HANDS.
            </h2>
            <p>Phát triển nghề nghiệp bằng trải nghiệm minh bạch</p>
          </div>
          <div className="ohio-intro-action">
            <a className="ohio-text-link" href="https://join.hands.vn/">
              Tìm hiểu thêm
              <ArrowIcon />
            </a>
          </div>
        </div>

        <div className="ohio-story-row">
          <div className="ohio-shape-column">
            <Image alt="" height={735} priority src="/images/ohio-creative/shape1.png" width={1536} />
          </div>
          <div className="ohio-story-copy ohio-story-copy-primary">
            <p>
              HANDS kết nối công nghệ với kinh nghiệm dịch vụ để công việc của đối tác trở nên{' '}
              <strong>rõ ràng, dễ tiếp cận và chủ động hơn.</strong>
            </p>
            <p>Chúng tôi xây dựng một cộng đồng cùng học hỏi, cải thiện kỹ năng và phát triển lâu dài.</p>
          </div>
          <div className="ohio-story-copy ohio-story-copy-secondary">
            <p>
              Quy trình hiện đại tạo nên một hệ thống{' '}
              <strong>dịch vụ kết nối, minh bạch và đáng tin cậy</strong> cho cả đối tác và khách hàng.
            </p>
            <div className="ohio-progress" ref={progressRef}>
              <h3>Mức độ sẵn sàng</h3>
              <div className="ohio-progress-track">
                <div
                  className="ohio-progress-bar"
                  role="progressbar"
                  aria-label="Tiến độ"
                  aria-valuemax={100}
                  aria-valuenow={83}
                >
                  <span className="ohio-progress-tooltip">
                    <span className="ohio-progress-value">0</span>%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ohio-section-spacer" aria-hidden="true" />

        <div className="ohio-capabilities-heading">
          <h3>Năng lực</h3>
          <a className="ohio-text-link" href="https://join.hands.vn/">
            Xem tất cả dịch vụ
            <ArrowIcon />
          </a>
        </div>
        <div className="ohio-capabilities-rule" />

        <div className="ohio-capabilities-grid">
          {cards.map((card, index) => (
            <div className="ohio-capability-column" key={card.eyebrow}>
              <article
                className={`ohio-capability-card${index === 3 ? ' is-deep' : ''}`}
                onPointerLeave={resetTilt}
                onPointerMove={tilt}
              >
                <Image
                  alt={card.title.join(' ')}
                  fill
                  sizes="(max-width: 760px) calc(100vw - 32px), 272px"
                  src={card.image}
                />
                <div className="ohio-capability-overlay">
                  <div>
                    <p className="ohio-capability-eyebrow">{card.eyebrow}</p>
                    <h4>
                      {card.title[0]}
                      <br />
                      {card.title[1]}
                    </h4>
                  </div>
                  <div className="ohio-capability-description">
                    <p>{card.description}</p>
                    <a
                      aria-label={`Mở ${card.title.join(' ')}`}
                      href="https://join.hands.vn/"
                      target="_blank"
                    >
                      <ArrowIcon size={16} />
                    </a>
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
