'use client';

import Image from 'next/image';
import { useEffect } from 'react';

const featureCards = {
  sleep: {
    eyebrow: 'Sleep',
    title: 'Revitalize Nights, Energize Your Days!',
    body: 'Unlock deep insights into sleep patterns, personalized recommendations, and wake up feeling refreshed and revitalized each morning with our sleep feature.',
    items: [
      ['/images/halsa-features/heart-rate.svg', 'Heart Rate'],
      ['/images/halsa-features/sleep-cycles.svg', 'Sleep Cicles'],
    ],
  },
  activity: {
    eyebrow: 'Activity',
    title: 'Move Freely, Thrive Every Day!',
    body: "Set goals, track activity levels, and receive personalized plans. Whether it's steps, workouts, or challenges, our app supports your journey to an active lifestyle.",
    items: [
      ['/images/halsa-features/step-count.svg', 'Step Count'],
      ['/images/halsa-features/calories.svg', 'Calories Tracking'],
    ],
  },
  mindfulness: {
    eyebrow: 'Mindfulness',
    title: 'Mindful Moments, Daily Serenity!',
    body: 'Indulge in guided meditations, breathing exercises, and stress reduction tools. Cultivate mindfulness for a balanced and serene everyday life.',
    items: [
      ['/images/halsa-features/meditation.svg', 'Guided Meditation'],
      ['/images/halsa-features/stress.svg', 'Stress Level Tracking'],
    ],
  },
} as const;

type FeatureCardName = keyof typeof featureCards;

function FeatureCard({ name }: { name: FeatureCardName }) {
  const card = featureCards[name];

  return (
    <article className={`halsa-feature-card halsa-feature-card-${name}`}>
      <div className="halsa-feature-card-copy">
        <span className="halsa-pill halsa-pill-inverse">{card.eyebrow}</span>
        <div>
          <h3>{card.title}</h3>
          <p>{card.body}</p>
        </div>
      </div>
      <ul>
        {card.items.map(([icon, label]) => (
          <li key={label}>
            <Image alt="" aria-hidden="true" height={24} src={icon} width={24} />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function FeatureImage({
  className,
  priority = false,
  src,
}: {
  className?: string;
  priority?: boolean;
  src: string;
}) {
  const revealClassName = className?.includes('halsa-feature-image-extra') ? ' halsa-reveal' : '';

  return (
    <div className={`halsa-feature-image${revealClassName} ${className ?? ''}`}>
      <Image
        alt="Feature"
        fill
        priority={priority}
        sizes="(min-width: 1200px) 33vw, (min-width: 810px) 50vw, 100vw"
        src={src}
      />
    </div>
  );
}

export function HalsaFeaturesClone() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1 },
    );

    document.querySelectorAll('.halsa-reveal').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="halsa-main-clone">
      <section className="halsa-features-section">
        <div className="halsa-features-intro">
          <span className="halsa-pill">Features</span>
          <div>
            <h2>
              Your Path to Wellness:
              <br />
              Uncover Features.
            </h2>
            <p>
              Discover a suite of powerful features designed to optimize sleep, boost activity, and enhance
              mindfulness daily.
            </p>
          </div>
        </div>

        <div className="halsa-features-grid">
          <FeatureImage
            className="halsa-feature-image-sleep"
            priority
            src="/images/halsa-features/sleep-primary.webp"
          />
          <FeatureImage
            className="halsa-feature-image-extra"
            src="/images/halsa-features/sleep-secondary.webp"
          />
          <FeatureCard name="sleep" />
          <FeatureCard name="activity" />
          <FeatureImage
            className="halsa-feature-image-activity"
            src="/images/halsa-features/activity-primary.webp"
          />
          <FeatureImage
            className="halsa-feature-image-extra"
            src="/images/halsa-features/activity-secondary.webp"
          />
          <FeatureImage
            className="halsa-feature-image-mindfulness"
            src="/images/halsa-features/mindfulness-primary.webp"
          />
          <FeatureImage
            className="halsa-feature-image-extra"
            src="/images/halsa-features/mindfulness-secondary.webp"
          />
          <FeatureCard name="mindfulness" />
        </div>
      </section>

    </div>
  );
}
