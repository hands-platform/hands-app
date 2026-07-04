import Link from 'next/link';
import type { ReactNode } from 'react';

const STATUS_BADGE_CLASS_BY_TONE = {
  danger: 'pill pill-danger',
  info: 'pill pill-info',
  neutral: 'pill pill-neutral',
  success: 'pill pill-success',
  warning: 'pill pill-warn',
} as const;

export type StatusBadgeTone = keyof typeof STATUS_BADGE_CLASS_BY_TONE;

type StatusBadgeProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone: StatusBadgeTone;
  readonly title?: string;
};

type PillClassBadgeProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly pillClass: string;
  readonly title?: string;
};

type StatusBadgeLinkProps = StatusBadgeProps & {
  readonly ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | true | false;
  readonly ariaLabel?: string;
  readonly download?: string;
  readonly href: string;
};

type PillClassBadgeLinkProps = PillClassBadgeProps & {
  readonly ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | true | false;
  readonly ariaLabel?: string;
  readonly download?: string;
  readonly href: string;
};

export function statusBadgeClassName(tone: StatusBadgeTone) {
  return STATUS_BADGE_CLASS_BY_TONE[tone];
}

export function pillClassBadgeClassName(pillClass: string) {
  return pillClass.startsWith('pill ') ? pillClass : `pill ${pillClass}`;
}

function mergeBadgeClassName(baseClassName: string, className?: string) {
  return [baseClassName, className].filter(Boolean).join(' ');
}

export function StatusBadge({ children, className, tone, title }: StatusBadgeProps) {
  return (
    <span className={mergeBadgeClassName(statusBadgeClassName(tone), className)} title={title}>
      {children}
    </span>
  );
}

export function PillClassBadge({ children, className, pillClass, title }: PillClassBadgeProps) {
  return (
    <span className={mergeBadgeClassName(pillClassBadgeClassName(pillClass), className)} title={title}>
      {children}
    </span>
  );
}

export function StatusBadgeLink({
  ariaCurrent,
  ariaLabel,
  children,
  className,
  download,
  href,
  title,
  tone,
}: StatusBadgeLinkProps) {
  return (
    <Link
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      className={mergeBadgeClassName(statusBadgeClassName(tone), className)}
      download={download}
      href={href}
      title={title}
    >
      {children}
    </Link>
  );
}

export function PillClassBadgeLink({
  ariaCurrent,
  ariaLabel,
  children,
  className,
  download,
  href,
  pillClass,
  title,
}: PillClassBadgeLinkProps) {
  return (
    <Link
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      className={mergeBadgeClassName(pillClassBadgeClassName(pillClass), className)}
      download={download}
      href={href}
      title={title}
    >
      {children}
    </Link>
  );
}
