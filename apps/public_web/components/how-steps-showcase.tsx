'use client';

import { useState } from 'react';

type HowStep = {
  readonly body: string;
  readonly image: string;
  readonly imagePosition?: string;
  readonly title: string;
};

export function HowStepsShowcase({
  actionLabel,
  steps,
}: {
  readonly actionLabel: string;
  readonly steps: readonly HowStep[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = steps[activeIndex];

  return (
    <section
      aria-labelledby="how-showcase-title"
      className="how-showcase"
      id="how"
      style={{
        backgroundImage: `url("${activeStep.image}")`,
        backgroundPosition: activeStep.imagePosition ?? 'center bottom',
      }}
    >
      <div className="how-showcase-shade" aria-hidden="true" />
      <div className="how-story-card">
        <strong className="how-story-index">
          {String(activeIndex + 1).padStart(2, '0')}
        </strong>
        <div className="how-story-content">
          <p className="how-story-kicker">— {activeStep.title}</p>
          <h2 id="how-showcase-title">{activeStep.body}</h2>
          <a className="button button-light" href="#download">
            {actionLabel}
          </a>
          <div className="how-slide-controls">
            <span aria-live="polite">
              {String(activeIndex + 1).padStart(2, '0')}/
              {String(steps.length).padStart(2, '0')}
            </span>
            <div aria-label="HANDS 이용 단계" className="how-slide-dots" role="group">
              {steps.map((step, index) => (
                <button
                  aria-label={`${index + 1}. ${step.title}`}
                  aria-pressed={index === activeIndex}
                  className={index === activeIndex ? 'is-active' : undefined}
                  key={step.title}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
