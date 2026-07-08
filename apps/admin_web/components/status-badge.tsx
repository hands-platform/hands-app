import Link from 'next/link';
import type { ReactNode } from 'react';

const STATUS_BADGE_CLASS_BY_TONE = {
  danger: 'pill pill-danger',
  info: 'pill pill-info',
  neutral: 'pill pill-neutral',
  primary: 'pill pill-primary',
  success: 'pill pill-success',
  warning: 'pill pill-warn',
} as const;

export type StatusBadgeTone = keyof typeof STATUS_BADGE_CLASS_BY_TONE;
export type AdminSignalTone = 'info' | 'ok' | 'warn';

type StatusBadgeProps = {
  readonly ariaDisabled?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone: StatusBadgeTone;
  readonly title?: string;
};

type StatusBadgeFromPillClassProps = Omit<StatusBadgeProps, 'tone'> & {
  readonly pillClass: string;
};

type AdminAttentionBadgeProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly title?: string;
};

type AdminSignalProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly title?: string;
  readonly tone: AdminSignalTone;
};

type StatusBadgeLinkProps = StatusBadgeProps & {
  readonly ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | true | false;
  readonly ariaLabel?: string;
  readonly download?: string;
  readonly href: string;
};

type StatusBadgeLinkFromPillClassProps = Omit<StatusBadgeLinkProps, 'tone'> & {
  readonly pillClass: string;
};

type StatusBadgeButtonProps = StatusBadgeProps & {
  readonly disabled?: boolean;
  readonly type?: 'button' | 'reset' | 'submit';
};

export function statusBadgeClassName(tone: StatusBadgeTone) {
  return STATUS_BADGE_CLASS_BY_TONE[tone];
}

export function statusBadgeToneFromPillClass(pillClass: string): StatusBadgeTone {
  if (pillClass.includes('danger') || pillClass.includes('blocked')) {
    return 'danger';
  }
  if (pillClass.includes('warn') || pillClass.includes('pending')) {
    return 'warning';
  }
  if (pillClass.includes('success') || pillClass.includes('done') || pillClass.includes('ok')) {
    return 'success';
  }
  if (pillClass.includes('info')) {
    return 'info';
  }
  if (pillClass.includes('primary')) {
    return 'primary';
  }
  return 'neutral';
}

export function adminSignalToneFromClassName(className?: string): AdminSignalTone {
  if (className?.includes('warn') || className?.includes('danger')) {
    return 'warn';
  }

  if (className?.includes('ok') || className?.includes('success')) {
    return 'ok';
  }

  return 'info';
}

function mergeBadgeClassName(baseClassName: string, className?: string) {
  return Array.from(
    new Set(
      [baseClassName, className].flatMap((value) =>
        value
          ? value
              .split(/\s+/)
              .filter(Boolean)
              .filter((token) => value === baseClassName || !legacyPillToneTokens.has(token))
          : [],
      ),
    ),
  ).join(' ');
}

const legacyPillToneTokens = new Set([
  'pill-danger',
  'pill-info',
  'pill-neutral',
  'pill-primary',
  'pill-success',
  'pill-warn',
]);

function mergeLegacyPillClassName(pillClass: string, className?: string) {
  const tokens = [pillClass, className]
    .flatMap((value) => (value ? value.split(/\s+/).filter(Boolean) : []));
  const needsPillBase = !tokens.includes('pill') && tokens.some((token) => legacyPillToneTokens.has(token));

  return Array.from(new Set(needsPillBase ? ['pill', ...tokens] : tokens)).join(' ');
}

export function StatusBadge({ ariaDisabled, children, className, tone, title }: StatusBadgeProps) {
  return (
    <span
      aria-disabled={ariaDisabled}
      className={mergeBadgeClassName(statusBadgeClassName(tone), className)}
      title={title}
    >
      {children}
    </span>
  );
}

export function StatusBadgeFromPillClass({
  ariaDisabled,
  children,
  className,
  pillClass,
  title,
}: StatusBadgeFromPillClassProps) {
  return (
    <StatusBadge
      ariaDisabled={ariaDisabled}
      className={mergeLegacyPillClassName(pillClass, className)}
      title={title}
      tone={statusBadgeToneFromPillClass(pillClass)}
    >
      {children}
    </StatusBadge>
  );
}

export function AdminAttentionBadge({ children, className, title }: AdminAttentionBadgeProps) {
  return (
    <span className={mergeBadgeClassName('topbar-attention-badge', className)} title={title}>
      {children}
    </span>
  );
}

export function AdminSignal({ children, className, title, tone }: AdminSignalProps) {
  return (
    <span className={mergeBadgeClassName(`signal signal-${tone}`, className)} title={title}>
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
      prefetch={false}
      title={title}
    >
      {children}
    </Link>
  );
}

export function StatusBadgeLinkFromPillClass({
  ariaCurrent,
  ariaLabel,
  children,
  className,
  download,
  href,
  pillClass,
  title,
}: StatusBadgeLinkFromPillClassProps) {
  return (
    <StatusBadgeLink
      ariaCurrent={ariaCurrent}
      ariaLabel={ariaLabel}
      className={mergeLegacyPillClassName(pillClass, className)}
      download={download}
      href={href}
      title={title}
      tone={statusBadgeToneFromPillClass(pillClass)}
    >
      {children}
    </StatusBadgeLink>
  );
}

export function StatusBadgeButton({
  children,
  className,
  disabled,
  title,
  tone,
  type = 'button',
}: StatusBadgeButtonProps) {
  return (
    <button
      className={mergeBadgeClassName(statusBadgeClassName(tone), className)}
      disabled={disabled}
      title={title}
      type={type}
    >
      {children}
    </button>
  );
}
