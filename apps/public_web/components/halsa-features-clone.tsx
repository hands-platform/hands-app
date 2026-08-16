'use client';

import Image from 'next/image';
import { useEffect } from 'react';

const featureCards = {
  sleep: {
    eyebrow: 'Giấc ngủ',
    title: 'Phục hồi ban đêm, tràn đầy năng lượng mỗi ngày!',
    body: 'Hiểu rõ nhịp ngủ, nhận gợi ý phù hợp và bắt đầu mỗi sáng với trạng thái tỉnh táo, sảng khoái hơn.',
    items: [
      ['/images/halsa-features/heart-rate.svg', 'Nhịp tim'],
      ['/images/halsa-features/sleep-cycles.svg', 'Chu kỳ giấc ngủ'],
    ],
  },
  activity: {
    eyebrow: 'Vận động',
    title: 'Tự do vận động, khỏe hơn mỗi ngày!',
    body: 'Đặt mục tiêu, theo dõi mức độ vận động và nhận kế hoạch phù hợp để duy trì lối sống chủ động mỗi ngày.',
    items: [
      ['/images/halsa-features/step-count.svg', 'Số bước chân'],
      ['/images/halsa-features/calories.svg', 'Theo dõi calo'],
    ],
  },
  mindfulness: {
    eyebrow: 'Chánh niệm',
    title: 'Khoảnh khắc tĩnh tại, bình yên mỗi ngày!',
    body: 'Thực hành thiền có hướng dẫn, bài tập hít thở và các phương pháp giảm căng thẳng để cân bằng cuộc sống.',
    items: [
      ['/images/halsa-features/meditation.svg', 'Thiền có hướng dẫn'],
      ['/images/halsa-features/stress.svg', 'Theo dõi căng thẳng'],
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
        alt="Tính năng wellness"
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
          <span className="halsa-pill">Tính năng</span>
          <div>
            <h2>
              Hành trình wellness của bạn:
              <br />
              Khám phá mọi tính năng.
            </h2>
            <p>
              Khám phá những tính năng giúp cải thiện giấc ngủ, tăng cường vận động và duy trì sự cân bằng mỗi
              ngày.
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
