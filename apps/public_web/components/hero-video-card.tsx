'use client';

import { useRef } from 'react';

type HeroVideoCardProps = {
  readonly className?: string;
  readonly poster?: string;
  readonly title: string;
  readonly subtitle: string;
};

export function HeroVideoCard({
  className,
  poster = '/images/editorial/hero-interview.png',
  title,
  subtitle,
}: HeroVideoCardProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  function openVideo() {
    dialogRef.current?.showModal();
    void videoRef.current?.play();
  }

  function stopVideo() {
    videoRef.current?.pause();
  }

  return (
    <>
      <div className={`hero-video-column${className ? ` ${className}` : ''}`}>
        <button
          aria-label={`${title.replaceAll('\n', ' ')} - 영상 보기`}
          className="hero-video-card"
          onClick={openVideo}
          type="button"
        >
          <span className="hero-video-poster" style={{ backgroundImage: `url("${poster}")` }}>
            <span>PLAY</span>
          </span>
          <span className="hero-video-copy">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
        </button>
      </div>

      <dialog className="hero-video-dialog" onClose={stopVideo} ref={dialogRef}>
        <form method="dialog">
          <button aria-label="영상 닫기" className="hero-video-close" type="submit">
            Close
          </button>
        </form>
        <video
          controls
          playsInline
          poster={poster}
          preload="metadata"
          ref={videoRef}
        >
          <source src="/videos/hands-wellness-preview.mp4" type="video/mp4" />
        </video>
      </dialog>
    </>
  );
}
