import { formatDateTime } from '../lib/admin-format';

type DateTimeTextProps = {
  readonly value?: string | null;
  readonly fallback?: string;
};

function isValidDateTime(value?: string | null): value is string {
  if (!value) {
    return false;
  }

  return Number.isFinite(new Date(value).getTime());
}

export function dateTimeTextClassName(value?: string | null) {
  return isValidDateTime(value) ? 'date-time-text' : 'date-time-text date-time-text-muted';
}

export function DateTimeText({ fallback = 'Not set', value }: DateTimeTextProps) {
  if (!isValidDateTime(value)) {
    return <span className={dateTimeTextClassName(value)}>{fallback}</span>;
  }

  const dateTime = value;

  return (
    <time className={dateTimeTextClassName(dateTime)} dateTime={dateTime}>
      {formatDateTime(dateTime, fallback)}
    </time>
  );
}
