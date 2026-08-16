'use client';

import Image from 'next/image';
import { useEffect, useRef, type ReactNode } from 'react';

import { CreativeWellnessFooter } from './creative-wellness-footer';
import { CustomerStoriesSection } from './customer-stories-section';
import { HeroVideoCard } from './hero-video-card';
import { HomeEditorialSections } from './home-editorial-sections';
import { HowStepsShowcase } from './how-steps-showcase';

const inlineImages = [
  ['/images/creative-wellness/inline-coach.webp', 'Personal coach'],
  ['/images/creative-wellness/inline-home.webp', 'Training at home'],
  ['/images/creative-wellness/inline-gym.webp', 'Training in the gym'],
  ['/images/creative-wellness/inline-go.webp', 'Training on the go'],
] as const;

const resultSlides = [
  {
    action: 'See the Results',
    body: 'Creative trainer transforms months of effort into weeks of visible progress.',
    image: '/images/creative-wellness/result-accountability.webp',
    imagePosition: 'center center',
    title: 'Daily Accountability',
  },
  {
    action: 'Find your Fitness',
    body: 'Convert any space into an elite gym with a plan that follows your schedule.',
    image: '/images/creative-wellness/result-anywhere.webp',
    imagePosition: 'center center',
    title: 'Anywhere Coaching',
  },
  {
    action: 'Start your Story',
    body: 'Join over 10,000 members reaching peak performance with 1-on-1 support.',
    image: '/images/creative-wellness/result-methods.webp',
    imagePosition: 'center center',
    title: 'Proven Methods',
  },
] as const;

const communityImages = Array.from(
  { length: 30 },
  (_, index) => `/images/creative-wellness/community-${String((index % 12) + 1).padStart(2, '0')}.jpg`,
);

const coachingPrinciples = [
  {
    title: 'Personal Coaching Experience',
    body: 'Access world-class trainers who provide real-time feedback and technical adjustments, ensuring every movement is effective and safe for your specific body type.',
  },
  {
    title: 'Dynamic Adaptive Plans',
    body: 'Forget static PDF workouts; our platform delivers flexible training schedules that evolve based on your weekly progress, equipment availability, and goals.',
  },
  {
    title: 'Real-Time Guidance',
    body: "Your coach is with you every step of the way, monitoring your data and celebrating your wins to keep you consistent when motivation alone isn't enough.",
  },
] as const;

const plans = [
  {
    name: 'Essential',
    description: 'Ideal for those who need a professional roadmap and weekly check-ins to stay on track with their fitness goals.',
    price: '$99',
    action: 'Start Essential',
    color: '#ffe1d6',
    features: ['Custom Training Plan', 'Weekly Coach Reviews', 'In-App Messaging', 'Health App Integration', 'Progress Tracking'],
  },
  {
    name: 'Elite',
    badge: 'Popular',
    description: 'Our most requested plan. Daily 1-on-1 support and real-time adjustments for high-performers with busy schedules.',
    price: '$149',
    action: 'Go Elite',
    color: '#d7e9ff',
    features: ['Everything in Essential', 'Fully Personalized Training', 'Form Video Analysis', 'Advanced Health Integration', 'Daily 1-on-1 Coaching'],
  },
  {
    name: 'Ultimate',
    description: 'The full experience. Unlimited access to your trainer with advanced biometric data monitoring and lifestyle design.',
    price: '$199',
    action: 'Get Ultimate',
    color: '#cebffa',
    features: ['Everything in Elite', 'Full Lifestyle & Habit Mapping', 'Full Lifestyle Mapping', 'Biometric Data Sync', 'Exclusive Content Access'],
  },
] as const;

function ArrowButton({ children, href }: { readonly children: ReactNode; readonly href: string }) {
  return (
    <a className="cw-pill-button" href={href}>
      <span>{children}</span>
      <span aria-hidden="true" className="cw-pill-arrow">↗</span>
    </a>
  );
}

export function CreativeWellnessClone() {
  const communityRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = communityRef.current;
    if (!section) return;

    const images = Array.from(section.querySelectorAll<HTMLImageElement>('.cw-community-image'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionDistance = 200;
    const spill = motionDistance / 2;
    const padding = 27;
    const gap = 8;
    const jitter = 0.35;
    const safeSize = 0.6;
    let frame = 0;
    let items: Array<{
      readonly element: HTMLImageElement;
      readonly baseX: number;
      readonly baseY: number;
      readonly moveFactor: number;
      readonly scale: number;
    }> = [];

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const overlaps = (
      a: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
      b: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
    ) => !(
      a.x + a.width <= b.x
      || b.x + b.width <= a.x
      || a.y + a.height <= b.y
      || b.y + b.height <= a.y
    );

    const setPosition = (
      item: (typeof items)[number],
      offsetX: number,
      offsetY: number,
      duration: number,
    ) => {
      item.element.style.transitionDuration = `${duration}ms`;
      item.element.style.transform = `translate3d(${item.baseX + offsetX}px, ${item.baseY + offsetY}px, 0) scale(${item.scale})`;
    };

    const resetPositions = (duration = 700) => {
      items.forEach((item) => setPosition(item, 0, 0, duration));
    };

    const updateForScroll = () => {
      frame = 0;
      if (reducedMotion.matches) {
        resetPositions(0);
        return;
      }

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (rect.bottom <= 0 || rect.top >= viewportHeight) {
        resetPositions(1700);
        return;
      }

      const progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height), 0, 1);
      const normalizedY = progress * 2 - 1;
      const normalizedX = normalizedY * 0.35;

      items.forEach((item) => {
        const x = -normalizedX * motionDistance * 0.35 * item.moveFactor;
        const y = -normalizedY * motionDistance * 0.35 * item.moveFactor;
        setPosition(item, x, y, 700);
      });
    };

    const requestScrollUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateForScroll);
    };

    const buildLayout = () => {
      const rect = section.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const baseWidth = clamp(viewportWidth * 0.1, 80, 200);
      const minimumWidth = clamp(viewportWidth * 0.1, 50, 100);
      const minimumScale = minimumWidth / baseWidth;
      const virtualWidth = rect.width + spill * 2;
      const virtualHeight = rect.height + spill * 2;
      const originX = -spill;
      const originY = -spill;
      const safeWidth = virtualWidth * safeSize;
      const safeHeight = virtualHeight * safeSize;
      const safeRect = {
        x: originX + (virtualWidth - safeWidth) / 2,
        y: originY + (virtualHeight - safeHeight) / 2,
        width: safeWidth,
        height: safeHeight,
      };
      const columns = Math.ceil(Math.sqrt(images.length));
      const rows = Math.ceil(images.length / columns);
      const cellWidth = (virtualWidth - padding * 2) / columns;
      const cellHeight = (virtualHeight - padding * 2) / rows;
      const placed: Array<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number }> = [];
      const nextItems: typeof items = [];

      images.forEach((element, index) => {
        element.style.display = 'none';
        element.style.width = `${baseWidth}px`;

        const column = index % columns;
        const row = Math.floor(index / columns);
        const cellX = originX + padding + column * cellWidth;
        const cellY = originY + padding + row * cellHeight;
        let baseX = cellX + cellWidth / 2 + (Math.random() - 0.5) * cellWidth * jitter;
        let baseY = cellY + cellHeight / 2 + (Math.random() - 0.5) * cellHeight * jitter;
        let wasPlaced = false;

        for (let attempt = 0; attempt < 120; attempt += 1) {
          const x = cellX + Math.random() * cellWidth;
          const y = cellY + Math.random() * cellHeight;
          const centerX = x + baseWidth / 2;
          const centerY = y + baseWidth / 2;
          if (
            centerX >= safeRect.x
            && centerX <= safeRect.x + safeRect.width
            && centerY >= safeRect.y
            && centerY <= safeRect.y + safeRect.height
          ) continue;

          const candidate = { x, y, width: baseWidth + gap, height: baseWidth + gap };
          if (placed.some((item) => overlaps(candidate, item))) continue;

          baseX = x;
          baseY = y;
          placed.push(candidate);
          wasPlaced = true;
          break;
        }

        if (!wasPlaced) return;

        placed.push({ x: baseX, y: baseY, width: baseWidth + gap, height: baseWidth + gap });
        const depth = Math.random();
        const scale = minimumScale + (1 - minimumScale) * (1 - depth);
        const moveFactor = 1 - depth * 0.75;
        const item = { element, baseX, baseY, moveFactor, scale };

        element.style.display = 'block';
        element.style.zIndex = String(1 + Math.round(30 * (1 - depth)));
        nextItems.push(item);
        setPosition(item, 0, 0, 0);
      });

      items = nextItems;
      updateForScroll();
    };

    const handlePointerMove = (event: MouseEvent) => {
      if (reducedMotion.matches) return;
      const rect = section.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const normalizedX = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const normalizedY = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);

      items.forEach((item) => {
        setPosition(
          item,
          -normalizedX * motionDistance * item.moveFactor,
          -normalizedY * motionDistance * item.moveFactor,
          700,
        );
      });
    };

    const handlePointerLeave = () => resetPositions(1700);
    const resizeObserver = new ResizeObserver(buildLayout);

    buildLayout();
    resizeObserver.observe(section);
    section.addEventListener('mousemove', handlePointerMove);
    section.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', buildLayout);
    reducedMotion.addEventListener('change', buildLayout);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      section.removeEventListener('mousemove', handlePointerMove);
      section.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('scroll', requestScrollUpdate);
      window.removeEventListener('resize', buildLayout);
      reducedMotion.removeEventListener('change', buildLayout);
    };
  }, []);

  return (
    <>
      <main className="creative-wellness">
        <section className="hero cw-hero" id="top">
          <div className="cw-hero-media" aria-hidden="true" />
          <div className="cw-hero-shade" aria-hidden="true" />
          <div className="hero-content cw-hero-content">
            <h1>Elite Personal<br />Training</h1>
            <p className="hero-copy">
              A dedicated personal coach who builds your custom training plan and stays by your side every single day to ensure you reach your fitness goals with confidence.
            </p>
            <ArrowButton href="#method">Get Started Now</ArrowButton>
          </div>

          <div className="cw-hero-trust">
            <div className="cw-avatar-stack" aria-hidden="true">
              <Image alt="" height={60} src="/images/wellness-footer/client-artistic-portrait.webp" width={60} />
              <Image alt="" height={60} src="/images/wellness-footer/client-smiling-man.webp" width={60} />
              <Image alt="" height={60} src="/images/wellness-footer/client-lavender-portrait.webp" width={60} />
            </div>
            <div>
              <span className="cw-stars" aria-label="4.8 out of 5 stars">★★★★★</span>
              <span>Trusted by 1k+ clients (4.8/5)</span>
            </div>
          </div>

          <HeroVideoCard
            poster="/images/creative-wellness/hero-video.webp"
            subtitle="See how our coaches track your success"
            title={'Real human\ntrainers 1-on-1\ncoaching'}
          />
        </section>

        <section className="cw-inline-statement" aria-label="Training anywhere">
          <h2>
            Your coaching
            <Image alt={inlineImages[0][1]} height={140} src={inlineImages[0][0]} width={210} />
            <br />
            at home
            <Image alt={inlineImages[1][1]} height={140} src={inlineImages[1][0]} width={210} />
            {' '}in the gym
            <Image alt={inlineImages[2][1]} height={140} src={inlineImages[2][0]} width={210} />
            <br />
            on the go
            <Image alt={inlineImages[3][1]} height={140} src={inlineImages[3][0]} width={210} />
          </h2>
        </section>

        <HomeEditorialSections sourceExact />

        <section className="cw-community" id="community" ref={communityRef}>
          {communityImages.map((src, index) => (
            <Image alt="" aria-hidden="true" className="cw-community-image" height={200} key={`${src}-${index}`} src={src} width={200} />
          ))}
          <div className="cw-community-content">
            <h2>Stronger Together</h2>
            <ArrowButton href="#results">Start Exploring</ArrowButton>
          </div>
        </section>

        <section className="cw-manifesto">
          <h2>
            At Healthify, we facilitate sophisticated training experiences based on uncompromising accountability and revolutionary health-conscious growth. A reputation for significant life achievements.
          </h2>
        </section>

        <div id="results">
          <HowStepsShowcase actionHref="#pricing" actionLabel="See the Results" steps={resultSlides} />
        </div>

        <CustomerStoriesSection sourceExact />

        <section className="faq-section cw-coaching" id="coaching">
          <div className="faq-panel">
            <div className="faq-content">
              <div className="faq-heading">
                <h2>Built on the idea that human-to-human</h2>
                <p>That’s why we focus on high-touch coaching that adapts to your life, providing the daily motivation and technical expertise needed to elevate your fitness journey.</p>
              </div>
              <div className="faq-list">
                {coachingPrinciples.map((item, index) => (
                  <details key={item.title} name="creative-wellness-coaching" open={index === 0}>
                    <summary>{item.title}</summary>
                    <p>{item.body}</p>
                  </details>
                ))}
              </div>
            </div>
            <div className="faq-media cw-coaching-media" role="img" aria-label="Focused runner outdoors">
              <div className="faq-media-card cw-founder-card">
                <strong>Alexander Vance</strong>
                <span>Founder &amp; CEO</span>
                <Image alt="Alexander Vance" height={120} src="/images/creative-wellness/founder.webp" width={120} />
              </div>
            </div>
          </div>
        </section>

        <section className="cw-pricing" id="pricing">
          <header>
            <p><span aria-hidden="true">●</span> Pricing Plans</p>
            <h2>The right investment for your transformation</h2>
          </header>
          <div className="cw-pricing-grid">
            {plans.map((plan) => (
              <article key={plan.name} style={{ backgroundColor: plan.color }}>
                <div className="cw-plan-heading">
                  <h3>{plan.name}</h3>
                  {'badge' in plan && plan.badge ? <span>{plan.badge}</span> : null}
                </div>
                <p>{plan.description}</p>
                <p className="cw-price"><strong>{plan.price}</strong> / month</p>
                <ul>
                  {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <a className="cw-plan-button" href="#top">{plan.action}</a>
                <small>Cancel anytime. No hidden fees.</small>
              </article>
            ))}
          </div>
        </section>
      </main>

      <CreativeWellnessFooter />
    </>
  );
}
