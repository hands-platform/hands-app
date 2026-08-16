const VIETNAM_OFFSET = '+07:00';
const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u;

export function vietnamLocalDateTimeToIso(value: string, label: string) {
  const raw = value.trim();
  const match = localDateTimePattern.exec(raw);
  if (!match) {
    throw new Error(`${label} must use Vietnam local date and time.`);
  }
  const [, year, month, day, hour, minute, second = '00'] = match;
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${VIETNAM_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid Vietnam date and time.`);
  }
  const roundTrip = isoToVietnamDateTimeLocal(parsed.toISOString(), second !== '00');
  const expected = `${year}-${month}-${day}T${hour}:${minute}${second !== '00' ? `:${second}` : ''}`;
  if (roundTrip !== expected) {
    throw new Error(`${label} must be a valid Vietnam date and time.`);
  }
  return parsed.toISOString();
}

export function isoToVietnamDateTimeLocal(value: string, includeSeconds = false) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hourCycle: 'h23',
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  const base = `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
  return includeSeconds ? `${base}:${part('second')}` : base;
}

