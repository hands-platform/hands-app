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
