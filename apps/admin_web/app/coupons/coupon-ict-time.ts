export const COUPON_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const COUPON_TIME_ZONE_LABEL = 'ICT';

const ICT_OFFSET_MINUTES = 7 * 60;
const ICT_WALL_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function formatCouponIctDateTime(value?: string | null, fallback = 'Not set') {
  const parts = couponIctDateTimeParts(value);
  if (!parts) return fallback;

  const month = new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    timeZone: COUPON_TIME_ZONE,
  }).format(new Date(parts.instant));

  return `${parts.day} ${month} ${parts.year}, ${parts.hour}:${parts.minute} ${COUPON_TIME_ZONE_LABEL}`;
}

export function couponIsoToIctWallTimeInput(value?: string | null) {
  const parts = couponIctDateTimeParts(value);
  if (!parts) return '';

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function couponIctWallTimeToIso(value: string, originalIso?: string | null) {
  const normalized = value.trim();
  if (!normalized) return undefined;

  if (originalIso && couponIsoToIctWallTimeInput(originalIso) === normalized) {
    return Number.isFinite(Date.parse(originalIso)) ? new Date(originalIso).toISOString() : null;
  }

  const match = ICT_WALL_TIME_PATTERN.exec(normalized);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const utcMilliseconds = Date.UTC(year, month - 1, day, hour, minute) - ICT_OFFSET_MINUTES * 60_000;
  const instant = new Date(utcMilliseconds);

  if (!Number.isFinite(instant.getTime())) return null;
  if (couponIsoToIctWallTimeInput(instant.toISOString()) !== normalized) return null;

  return instant.toISOString();
}

function couponIctDateTimeParts(value?: string | null) {
  if (!value) return null;
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: COUPON_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  if (!values.year || !values.month || !values.day || !values.hour || !values.minute) return null;
  return {
    day: values.day,
    hour: values.hour === '24' ? '00' : values.hour,
    instant,
    minute: values.minute,
    month: values.month,
    year: values.year,
  };
}
