'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

const footerColumns = [
  {
    title: 'Explore',
    links: [
      'How it works',
      'Our Coaches',
      'Methodology',
      'Success Stories',
      'The App',
      'Corporate Wellness',
      'Community',
      'Training Blog',
    ],
  },
  {
    title: 'Programs',
    links: [
      'Weight Loss',
      'Muscle Building',
      'Athletic Performance',
      'Lifestyle Design',
      'Nutrition Coaching',
      'Post-Injury Recovery',
      'Pricing Plans',
    ],
  },
  {
    title: 'Support',
    links: [
      'Terms of Service',
      'Help Center',
      'Privacy Policy',
      'Contact Us',
      'Member Login',
      'Join the Team',
    ],
  },
] as const;

const socialLinks = [
  ['Facebook', 'https://www.facebook.com/groups/uncode', 'facebook'],
  ['YouTube', 'https://www.youtube.com/channel/UCK27He6L4DmmC_5SCClFEkQ/videos', 'youtube'],
  ['X', 'https://twitter.com/undsgndotcom', 'x'],
  ['Envato', 'https://themeforest.net/user/undsgn', 'envato'],
] as const;

const clients = [
  ['client-artistic-portrait.webp', 'Client portrait'],
  ['client-smiling-man.webp', 'Client portrait'],
  ['client-lavender-portrait.webp', 'Client portrait'],
] as const;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M19.9,12.4c.1-.2.1-.5,0-.8,0-.1-.1-.2-.2-.3l-7-7c-.4-.4-1-.4-1.4,0s-.4,1,0,1.4l5.3,5.3H5c-.6,0-1,.4-1,1s.4,1,1,1h11.6l-5.3,5.3c-.4.4-.4,1,0,1.4s.5.3.7.3.5,0,.7-.3l7-7c0,0,.2-.2.2-.3Z" />
    </svg>
  );
}

export function CreativeWellnessFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const footer = footerRef.current;
    const cta = ctaRef.current;

    if (!footer || !cta) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    const update = () => {
      frame = 0;
      if (reducedMotion.matches) {
        footer.style.setProperty('--wellness-footer-bg-y', '0px');
        return;
      }

      const rect = cta.getBoundingClientRect();
      const offset = Math.min(48, Math.max(-63, rect.top * -0.1));
      footer.style.setProperty('--wellness-footer-bg-y', `${offset}px`);
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    reducedMotion.addEventListener('change', requestUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      reducedMotion.removeEventListener('change', requestUpdate);
    };
  }, []);

  return (
    <footer className="wellness-footer" ref={footerRef} role="contentinfo">
      <div className="wellness-footer-cta" ref={ctaRef}>
        <Image
          alt="Woman practicing yoga outdoors"
          className="wellness-footer-cta-image"
          fill
          sizes="calc(100vw - 28px)"
          src="/images/wellness-footer/yoga-studio-serenity.webp"
          unoptimized
        />
        <div className="wellness-footer-cta-content">
          <h2>Expert coaching made for your real-world lifestyle</h2>
          <a
            className="wellness-footer-button"
            href="https://undsgn.com/uncode/pages/about-wellness/"
            rel="noreferrer"
            target="_blank"
          >
            <span className="wellness-footer-button-label">
              <span
                className="wellness-footer-button-label-track"
                data-content="Find Personal Trainer"
              >
                Find Personal Trainer
              </span>
            </span>
            <span className="wellness-footer-button-arrow">
              <span className="wellness-footer-button-arrow-track">
                <ArrowIcon />
                <ArrowIcon />
              </span>
            </span>
          </a>
        </div>
      </div>

      <div className="wellness-footer-info">
        <div className="wellness-footer-intro">
          <h2>Providing the world’s most sophisticated personal training experience for growth</h2>
          <p>Elite coaching. Human connection. Real results.</p>

          <div className="wellness-footer-trust">
            <div className="wellness-footer-rating">
              <span className="wellness-footer-stars" aria-label="4.8 out of 5 stars">
                <span aria-hidden="true" className="wellness-footer-stars-base" />
                <span aria-hidden="true" className="wellness-footer-stars-fill" />
              </span>
              <span>Trusted by 1k+ clients (4.8/5)</span>
            </div>
            <div className="wellness-footer-clients">
              {clients.map(([src, alt]) => (
                <Image
                  alt={alt}
                  height={60}
                  key={src}
                  src={`/images/wellness-footer/${src}`}
                  unoptimized
                  width={60}
                />
              ))}
            </div>
          </div>

          <nav className="wellness-footer-socials" aria-label="Social media">
            {socialLinks.map(([label, href, icon]) => (
              <a
                aria-label={label}
                className={`wellness-footer-social wellness-footer-social-${icon}`}
                href={href}
                key={label}
                rel="noreferrer"
                target="_blank"
              />
            ))}
          </nav>
        </div>

        <nav className="wellness-footer-columns" aria-label="Footer">
          {footerColumns.map(({ title, links }) => (
            <div className="wellness-footer-column" key={title}>
              <h3>{title}</h3>
              {links.map((label) => (
                <a href="#" key={label}>
                  {label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
