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
  readonly tone: StatusBadgeTone;
  readonly title?: string;
};

type PillClassBadgeProps = {
  readonly children: ReactNode;
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

export function StatusBadge({ children, tone, title }: StatusBadgeProps) {
  return (
    <span className={statusBadgeClassName(tone)} title={title}>
      {children}
    </span>
  );
}

export function PillClassBadge({ children, pillClass, title }: PillClassBadgeProps) {
  return (
    <span className={pillClassBadgeClassName(pillClass)} title={title}>
      {children}
    </span>
  );
}

export function StatusBadgeLink({
  ariaCurrent,
  ariaLabel,
  children,
  download,
  href,
  title,
  tone,
}: StatusBadgeLinkProps) {
  return (
    <Link
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      className={statusBadgeClassName(tone)}
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
  download,
  href,
  pillClass,
  title,
}: PillClassBadgeLinkProps) {
  return (
    <Link
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      className={pillClassBadgeClassName(pillClass)}
      download={download}
      href={href}
      title={title}
    >
      {children}
    </Link>
  );
}
