'use client';

import Image from 'next/image';
import Matter from 'matter-js';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

const chips = [
  ['Hỗ trợ đối tác', '#d5d5d5'],
  ['Ứng dụng di động', '#e1e3e8'],
  ['Công nghệ kết nối', '#c7d0c1'],
  ['Quản lý dịch vụ', '#d9f8ea'],
  ['Lịch làm việc linh hoạt', '#c7d0c1'],
  ['Cơ hội phát triển', '#d9eef8'],
  ['Thu nhập minh bạch', '#d9f8f1'],
  ['Hiệu quả', '#f8f8d9'],
] as const;

type VisionStyle = CSSProperties & Record<`--${string}`, string | number>;

export function AsymmetricVisionClone() {
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  let characterIndex = 0;

  const renderWords = (text: string, keyPrefix: string): ReactNode[] =>
    text.split(' ').flatMap((word, wordIndex) => {
      const chars = Array.from(word).map((character) => {
        const index = characterIndex++;

        return (
          <span
            className="asymmetric-vision-char"
            key={`${keyPrefix}-${wordIndex}-${index}`}
            style={{ '--char-index': index } as VisionStyle}
          >
            {character}
          </span>
        );
      });

      return [
        wordIndex > 0 ? ' ' : null,
        <span className="asymmetric-vision-word" key={`${keyPrefix}-${wordIndex}`}>
          {chars}
        </span>,
      ];
    });

  const firstLine = renderWords(
    'HANDS giúp đối tác phát triển bằng trải nghiệm minh bạch, công nghệ kết nối và',
    'opening',
  );
  const firstImageIndex = characterIndex++;
  const middleLine = renderWords(
    'sự hỗ trợ xuyên suốt. Cùng xây dựng uy tín nghề nghiệp và tạo nên',
    'middle',
  );
  const secondImageIndex = characterIndex++;
  const finalLine = renderWords('trải nghiệm wellness đáng tin cậy.', 'closing');
  const revealTargetCount = characterIndex;

  useEffect(() => {
    const section = sectionRef.current;
    const scene = sceneRef.current;

    if (!section || !scene) return;

    let measurementFrame = 0;
    let revealFrame = 0;
    let revealTarget = 0;
    let revealCurrent = 0;
    let previousRevealTime = 0;
    const animateReveal = (time: number) => {
      const elapsed = previousRevealTime ? Math.min(64, time - previousRevealTime) : 16;
      previousRevealTime = time;
      const smoothing = 1 - Math.exp(-elapsed / 350);
      revealCurrent += (revealTarget - revealCurrent) * smoothing;

      if (Math.abs(revealTarget - revealCurrent) < 0.01) {
        revealCurrent = revealTarget;
        revealFrame = 0;
      } else {
        revealFrame = window.requestAnimationFrame(animateReveal);
      }
      section.style.setProperty('--vision-reveal', String(revealCurrent));
    };
    const startReveal = () => {
      if (!revealFrame) {
        previousRevealTime = 0;
        revealFrame = window.requestAnimationFrame(animateReveal);
      }
    };
    const updateReveal = () => {
      measurementFrame = 0;
      const title = section.querySelector<HTMLElement>('.asymmetric-vision-title');
      if (!title) return;
      const rect = title.getBoundingClientRect();
      const start = window.innerHeight;
      const end = window.innerHeight * 0.75 - rect.height / 2;
      const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
      revealTarget = progress * revealTargetCount;
      startReveal();
    };
    const scheduleReveal = () => {
      if (!measurementFrame) measurementFrame = window.requestAnimationFrame(updateReveal);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      section.classList.add('is-active');
      return;
    }

    const { Bodies, Body, Composite, Engine, Events, Mouse, MouseConstraint, Runner } = Matter;
    const chipElements = Array.from(scene.querySelectorAll<HTMLElement>('.asymmetric-vision-chip'));
    const engine = Engine.create();
    const runner = Runner.create();
    const mouse = Mouse.create(scene);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { render: { visible: false } },
    });
    const bodies: Matter.Body[] = [];
    const rainTimers: number[] = [];
    let width = scene.offsetWidth;
    let height = scene.offsetHeight;
    let topBoundary: Matter.Body | null = null;
    let previousScrollTop = 0;
    let scrollGravityActive = false;

    const startBoundary = Bodies.rectangle(-250, height / 2, 500, 4 * height, {
      isStatic: true,
    });
    const endBoundary = Bodies.rectangle(width + 250, height / 2, 500, 4 * height, {
      isStatic: true,
    });
    const bottomBoundary = Bodies.rectangle(0, height + 250, 2 * width, 500, {
      isStatic: true,
    });

    engine.gravity.y = 0.8;
    Composite.add(engine.world, [mouseConstraint, bottomBoundary, startBoundary, endBoundary]);

    chipElements.forEach((chip, index) => {
      const rect = chip.getBoundingClientRect();
      const angle = (Math.random() * 0.4 - 0.2) * Math.PI;
      const x = rect.width / 2 + Math.random() * Math.max(0, width - rect.width);
      const y = -rect.width - (index * rect.height + 10);
      const body = Bodies.rectangle(x, y, rect.width, rect.height, {
        angle,
        chamfer: { radius: rect.height / 2 },
        isStatic: true,
        restitution: 0.3,
      });

      bodies.push(body);
      Composite.add(engine.world, body);
    });

    const syncBodies = () => {
      if (!runner.enabled) return;

      chipElements.forEach((chip, index) => {
        const body = bodies[index];
        const rotator = chip.firstElementChild as HTMLElement | null;
        if (!body || !rotator) return;
        chip.style.transform = `translate(${body.position.x.toFixed(1)}px, ${body.position.y.toFixed(1)}px)`;
        rotator.style.transform = `translate(-50%, -50%) rotate(${body.angle.toFixed(2)}rad)`;
      });

      if (!scrollGravityActive && (bodies.at(-1)?.position.y ?? 0) > 70) {
        topBoundary = Bodies.rectangle(0, 0, 2 * width, 500, { isStatic: true });
        Composite.add(engine.world, topBoundary);
        scrollGravityActive = true;
      }

      if (scrollGravityActive) {
        const scrollTop = document.documentElement.scrollTop - document.documentElement.clientTop;
        const delta = scrollTop - previousScrollTop;
        engine.gravity.y = 0.7 - Math.min(4, Math.max(-2, delta * 0.1));
        previousScrollTop = scrollTop;
      }
    };

    const onMouseDown = () => {
      scene.style.pointerEvents = 'auto';
    };
    const onMouseUp = () => {
      scene.style.pointerEvents = '';
    };

    Events.on(runner, 'tick', syncBodies);
    Events.on(mouseConstraint, 'mousedown', onMouseDown);
    Events.on(mouseConstraint, 'mouseup', onMouseUp);
    Runner.run(runner, engine);
    runner.enabled = false;

    const runnerObserver = new IntersectionObserver(([entry]) => {
      runner.enabled = Boolean(entry?.isIntersecting);
    });
    const rainObserver = new IntersectionObserver(([entry], observer) => {
      if (!entry?.isIntersecting) return;
      section.classList.add('is-active');
      chipElements.forEach((chip, index) => {
        chip.style.opacity = '1';
        rainTimers.push(
          window.setTimeout(() => {
            const body = bodies[index];
            if (body) Body.setStatic(body, false);
          }, 80 * index),
        );
      });
      observer.disconnect();
    });

    runnerObserver.observe(scene);
    rainObserver.observe(scene);

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (width === scene.offsetWidth && height === scene.offsetHeight) return;
        width = scene.offsetWidth;
        height = scene.offsetHeight;

        if (topBoundary) {
          Body.setVertices(
            topBoundary,
            Bodies.rectangle(0, -250, 2 * width, 500, { isStatic: true }).vertices,
          );
        }
        Body.setPosition(startBoundary, { x: -250, y: height / 2 });
        Body.setVertices(
          startBoundary,
          Bodies.rectangle(-250, height / 2, 500, 4 * height, { isStatic: true }).vertices,
        );
        Body.setPosition(endBoundary, { x: width + 250, y: height / 2 });
        Body.setVertices(
          endBoundary,
          Bodies.rectangle(width + 250, height / 2, 500, 4 * height, { isStatic: true }).vertices,
        );
        Body.setPosition(bottomBoundary, { x: 0, y: height + 250 });
        Body.setVertices(
          bottomBoundary,
          Bodies.rectangle(0, height + 250, 2 * width, 500, { isStatic: true }).vertices,
        );

        chipElements.forEach((chip, index) => {
          const body = bodies[index];
          if (!body) return;
          const rect = chip.getBoundingClientRect();
          const resizedBody = Bodies.rectangle(body.position.x, body.position.y, rect.width, rect.height, {
            angle: body.angle,
            chamfer: { radius: rect.height / 2 },
          });
          Body.setVertices(body, resizedBody.vertices);
          if (body.position.y > height) Body.setPosition(body, { x: body.position.x, y: height / 2 });
          if (body.position.x > width) {
            const x = rect.width / 2 + Math.random() * Math.max(0, width - rect.width);
            Body.setPosition(body, { x, y: body.position.y });
          }
        });
      }, 250);
      scheduleReveal();
    };

    updateReveal();
    window.addEventListener('scroll', scheduleReveal, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      runnerObserver.disconnect();
      rainObserver.disconnect();
      rainTimers.forEach(window.clearTimeout);
      window.clearTimeout(resizeTimer);
      Events.off(runner, 'tick', syncBodies);
      Events.off(mouseConstraint, 'mousedown', onMouseDown);
      Events.off(mouseConstraint, 'mouseup', onMouseUp);
      Runner.stop(runner);
      Engine.clear(engine);
      Mouse.clearSourceEvents(mouse);
      window.removeEventListener('scroll', scheduleReveal);
      window.removeEventListener('resize', onResize);
      if (measurementFrame) window.cancelAnimationFrame(measurementFrame);
      if (revealFrame) window.cancelAnimationFrame(revealFrame);
    };
  }, [revealTargetCount]);

  return (
    <section className="asymmetric-vision-section" aria-label="Tầm nhìn của HANDS" ref={sectionRef}>
      <div className="asymmetric-vision-inner">
        <div
          className="asymmetric-vision-chip-scene"
          aria-hidden="true"
          data-lqd-throwable-scene=""
          ref={sceneRef}
        >
          {chips.map(([label, color]) => (
            <p
              className="asymmetric-vision-chip lqd-throwable-element"
              data-lqd-throwable-el=""
              key={label}
              style={
                {
                  '--chip-color': color,
                } as VisionStyle
              }
            >
              <span className="lqd-throwable-element-rot">{label}</span>
            </p>
          ))}
        </div>

        <div className="asymmetric-vision-copy">
          <Image
            alt=""
            className="asymmetric-vision-mark"
            height="10"
            src="/images/asymmetric-vision/shape.svg"
            width="48"
          />
          <h2 className="asymmetric-vision-title">
            {firstLine}
            <span
              className="asymmetric-vision-inline-image asymmetric-vision-reveal-unit"
              style={{ '--char-index': firstImageIndex } as VisionStyle}
            >
              <Image
                alt=""
                draggable="false"
                height={62}
                src="/images/asymmetric-vision/img-2.png"
                width={62}
              />
            </span>
            {middleLine}
            <span
              className="asymmetric-vision-inline-image asymmetric-vision-reveal-unit"
              style={{ '--char-index': secondImageIndex } as VisionStyle}
            >
              <Image
                alt=""
                draggable="false"
                height={62}
                src="/images/asymmetric-vision/img-1.png"
                width={62}
              />
            </span>
            {finalLine}
          </h2>

          <div className="asymmetric-vision-action">
            <span>Tầm nhìn</span>
            <a aria-label="Đăng ký đối tác" href="https://join.hands.vn/">
              <svg aria-hidden="true" height="11" viewBox="0 0 10.625 10.625" width="11">
                <path
                  d="M-1.76-11.322H5.313V-4.25H3.885V-8.932L-4.316-.7l-1-1,8.2-8.234H-1.76Z"
                  transform="translate(5.313 11.322)"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
