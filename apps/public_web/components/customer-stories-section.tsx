'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

const customerStories = [
  {
    title: '출장 중에도 편안한 선택',
    quote: '낯선 지역에서도 후기와 가격을 비교하고 믿을 수 있는 마사지 테라피스트를 찾을 수 있었어요.',
    name: 'Sarah Mitchell',
    meta: 'HANDS 고객 · 2026',
    image: '/images/testimonials/sarah.jpg',
  },
  {
    title: '분명한 예약 과정',
    quote: '마사지 테라피스트가 수락한 뒤 채팅과 상태가 연결되어 있어 기다리는 동안에도 안심됐어요.',
    name: 'Elena Rossi',
    meta: 'HANDS 고객 · 2025',
    image: '/images/testimonials/elena.webp',
  },
  {
    title: '나에게 맞는 마사지 테라피스트',
    quote: '서비스와 리뷰를 한 번에 비교할 수 있어 원하는 스타일의 마사지 테라피스트를 고르기 쉬웠어요.',
    name: 'Marcus Chen',
    meta: 'HANDS 고객 · 2026',
    image: '/images/testimonials/marcus.webp',
  },
  {
    title: '집에서 시작하는 휴식',
    quote: '이동하지 않고 익숙한 공간에서 서비스를 받을 수 있다는 점이 가장 만족스러웠어요.',
    name: 'David Thompson',
    meta: 'HANDS 고객 · 2026',
    image: '/images/testimonials/david.jpg',
  },
  {
    title: '투명한 가격과 리뷰',
    quote: '예약 전에 가격과 실제 후기를 확인할 수 있어 처음 이용할 때도 선택이 어렵지 않았어요.',
    name: 'Sophia Williams',
    meta: 'HANDS 고객 · 2026',
    image: '/images/testimonials/sophia.jpg',
  },
  {
    title: '필요한 순간의 웰니스',
    quote: '바쁜 일정 사이에도 원하는 시간과 장소를 정해 서비스를 예약할 수 있어 편리했어요.',
    name: 'James Peterson',
    meta: 'HANDS 고객 · 2026',
    image: '/images/testimonials/james.webp',
  },
] as const;

const sourceCustomerStories = [
  {
    title: 'Weight Loss Journey',
    quote: "Healtify is the best platform I've ever used. The coaches bring a rare balance of expert guidance, daily support, and the motivation I needed to transform.",
    name: 'Sarah Mitchell',
    meta: 'Member since Jan 2026',
    image: '/images/testimonials/sarah.jpg',
  },
  {
    title: 'Athletic Performance',
    quote: 'The level of accountability is uncompromising. My trainer knows exactly how to push me while ensuring my recovery and nutrition are always on point for success.',
    name: 'Elena Rossi',
    meta: 'Member since Nov 2025',
    image: '/images/testimonials/elena.webp',
  },
  {
    title: 'Lifestyle Coaching',
    quote: "It's not just a workout app, it's a real human connection. My coach adapts my plan every single week based on my busy schedule and my actual energy levels.",
    name: 'Marcus Chen',
    meta: 'Member since Dec 2025',
    image: '/images/testimonials/marcus.webp',
  },
  {
    title: 'Muscle Building Plan',
    quote: 'Having a professional coach in my pocket changed everything. The workouts are perfectly tailored to my goals and the feedback is always precise and helpful.',
    name: 'David Thompson',
    meta: 'Member since Feb 2026',
    image: '/images/testimonials/david.jpg',
  },
  {
    title: 'Strength & Conditioning',
    quote: "Finally, a fitness service that delivers what it promises. The transition from generic gym routines to elite personalized training was the best choice I've made.",
    name: 'Sophia Williams',
    meta: 'Member since Jan 2026',
    image: '/images/testimonials/sophia.jpg',
  },
  {
    title: 'Posture & Mobility',
    quote: "I never thought digital coaching could be this effective. The video feedback from my trainer is better than any in-person session I've had in the past decade.",
    name: 'James Peterson',
    meta: 'Member since Mar 2026',
    image: '/images/testimonials/james.webp',
  },
] as const;

export function getCustomerStoryOffset(scrollY: number, cycle: number, rowIndex: number) {
  const offset = (scrollY * 0.326) % cycle;
  return rowIndex === 0 ? -offset : -(cycle - offset);
}

export function normalizeCustomerStoryOffset(offset: number, cycle: number) {
  if (!cycle) return 0;
  return -(((-offset % cycle) + cycle) % cycle);
}

export function CustomerStoriesSection({ sourceExact = false }: { readonly sourceExact?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const storiesForPage = sourceExact ? sourceCustomerStories : customerStories;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const windows = [...section.querySelectorAll<HTMLElement>('.customer-stories-window')];
    const tracks = [...section.querySelectorAll<HTMLElement>('.customer-stories-track')];
    const dragOffsets = tracks.map(() => 0);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
    let frame = 0;

    const update = () => {
      frame = 0;
      tracks.forEach((track, index) => {
        if (isMobile()) {
          track.style.transform = '';
          return;
        }
        const cycle = track.scrollWidth / 2;
        if (!cycle) return;
        const scrollOffset = reducedMotion
          ? 0
          : getCustomerStoryOffset(window.scrollY, cycle, index);
        const offset = normalizeCustomerStoryOffset(
          scrollOffset + dragOffsets[index],
          cycle,
        );
        track.style.transform = `translate3d(${offset}px, 0, 0)`;
      });
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const removePointerListeners = windows.map((windowElement, index) => {
      let pointerId: number | null = null;
      let startX = 0;
      let startOffset = 0;

      const finishDrag = (event: PointerEvent) => {
        if (pointerId !== event.pointerId) return;
        if (windowElement.hasPointerCapture(pointerId)) {
          windowElement.releasePointerCapture(pointerId);
        }
        pointerId = null;
        windowElement.classList.remove('is-dragging');
      };
      const handlePointerDown = (event: PointerEvent) => {
        if (isMobile() || (event.pointerType === 'mouse' && event.button !== 0)) return;
        pointerId = event.pointerId;
        startX = event.clientX;
        startOffset = dragOffsets[index];
        windowElement.setPointerCapture(pointerId);
        windowElement.classList.add('is-dragging');
        event.preventDefault();
      };
      const handlePointerMove = (event: PointerEvent) => {
        if (pointerId !== event.pointerId) return;
        dragOffsets[index] = startOffset + event.clientX - startX;
        schedule();
        event.preventDefault();
      };

      windowElement.addEventListener('pointerdown', handlePointerDown);
      windowElement.addEventListener('pointermove', handlePointerMove);
      windowElement.addEventListener('pointerup', finishDrag);
      windowElement.addEventListener('pointercancel', finishDrag);

      return () => {
        windowElement.removeEventListener('pointerdown', handlePointerDown);
        windowElement.removeEventListener('pointermove', handlePointerMove);
        windowElement.removeEventListener('pointerup', finishDrag);
        windowElement.removeEventListener('pointercancel', finishDrag);
      };
    });

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      removePointerListeners.forEach((remove) => remove());
    };
  }, []);

  return (
    <section
      aria-label="Customer stories"
      className="customer-stories-section"
      id="stories"
      ref={sectionRef}
    >
      <div className="customer-stories-heading">
        <p>
          <span aria-hidden="true">●</span> {sourceExact ? 'Testimonials' : 'CUSTOMER STORIES'}
        </p>
      </div>
      {[storiesForPage.slice(0, 3), storiesForPage.slice(3)].map((stories) => (
        <div
          aria-label={`${stories[0].name} customer stories`}
          className="customer-stories-window"
          key={stories[0].name}
          role="region"
        >
          <div className="customer-stories-track">
            {[...stories, ...stories].map((story, index) => (
              <article
                aria-hidden={index >= stories.length}
                className="customer-story-card"
                key={`${story.name}-${index}`}
              >
                <div>
                  <h3>{story.title}</h3>
                  <p>“ {story.quote} ”</p>
                </div>
                <footer>
                  <Image alt="" height={66} src={story.image} width={66} />
                  <div>
                    <strong>{story.name}</strong>
                    <span>{story.meta}</span>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
