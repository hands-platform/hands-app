'use client';

import Image from 'next/image';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

const cards = [
  {
    eyebrow: 'Connection',
    title: ['Highly', 'accessible'],
    description:
      'Our approach ensures your brand story resonates consistently, whether online, in-store, or in media.',
    image: '/images/ohio-creative/connection.jpeg',
  },
  {
    eyebrow: 'Collaboration',
    title: ['Creative', 'networking'],
    description:
      'Creating a higher spacing and how people move through a unique and impactful campaign.',
    image: '/images/ohio-creative/collaboration.jpeg',
  },
  {
    eyebrow: 'Innovations',
    title: ['Ongoing', 'optimization'],
    description:
      'We track how people move through impactful campaigns that allows to discover better others.',
    image: '/images/ohio-creative/innovations.jpeg',
  },
  {
    eyebrow: 'Experience',
    title: ['Collaborative', 'discovery'],
    description:
      'Spaces of each debt in the digital world can help you with overall simplest authentic.',
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
    <section className="ohio-creative-section" aria-label="Creative capabilities">
      <div className="ohio-creative-shell">
        <div className="ohio-section-spacer" aria-hidden="true" />

        <div className="ohio-intro-row">
          <div className="ohio-intro-copy">
            <h2>
              With more than 16+ years<br className="ohio-desktop-break" />{' '}
              of experience, our team has<br className="ohio-desktop-break" />{' '}
              become a leader in digital<br className="ohio-desktop-break" />{' '}
              design and innovations.
            </h2>
            <p>Grow brands through bold, strategic creative</p>
          </div>
          <div className="ohio-intro-action">
            <a className="ohio-text-link" href="#" target="_blank">
              See all works
              <ArrowIcon />
            </a>
          </div>
        </div>

        <div className="ohio-story-row">
          <div className="ohio-shape-column">
            <Image
              alt=""
              height={735}
              priority
              src="/images/ohio-creative/shape1.png"
              width={1536}
            />
          </div>
          <div className="ohio-story-copy ohio-story-copy-primary">
            <p>
              Using year-over-year design approaches and the latest technologies, we will ensure that
              your new website will be <strong>visible, accessible, and treads lightly on the environment.</strong>
            </p>
            <p>
              Our philosophy is built on people who are addicted on creating, learning, and growing
              together, which allows us to discover better others miss.
            </p>
          </div>
          <div className="ohio-story-copy ohio-story-copy-secondary">
            <p>
              Modern and cutting-edge approach for creating <strong>digital and connected brands,
              services, and products</strong> driving digital arts and engaging experiences.
            </p>
            <div className="ohio-progress" ref={progressRef}>
              <h3>Media insights</h3>
              <div className="ohio-progress-track">
                <div className="ohio-progress-bar" role="progressbar" aria-label="Progress bar" aria-valuemax={100} aria-valuenow={83}>
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
          <h3>Capabilities</h3>
          <a className="ohio-text-link" href="#" target="_blank">
            See all services
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
                <Image alt={card.title.join(' ')} fill sizes="(max-width: 760px) calc(100vw - 32px), 272px" src={card.image} />
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
                    <a aria-label={`Open ${card.title.join(' ')}`} href="#" target="_blank">
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
