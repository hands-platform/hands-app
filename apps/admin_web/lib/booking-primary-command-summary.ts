import type {
  BookingCommandDecisionStrip,
  BookingCommandDecisionTone,
} from './booking-command-decision-strip';

export type BookingPrimaryCommandSummaryInput = {
  bookingId: string;
  href: string;
  strip: BookingCommandDecisionStrip;
};

export type BookingPrimaryCommandSummaryItem = {
  status: string;
  primaryAction: string;
  detail: string;
  tone: BookingCommandDecisionTone;
  count: number;
  href: string;
  sampleBookingIds: string[];
};

export function bookingPrimaryCommandSummary(
  inputs: BookingPrimaryCommandSummaryInput[],
): BookingPrimaryCommandSummaryItem[] {
  const grouped = new Map<string, BookingPrimaryCommandSummaryItem>();

  for (const input of inputs) {
    const key = `${input.strip.status}:${input.strip.primaryAction}`;
    const current = grouped.get(key);

    if (current) {
      current.count += 1;
      if (current.sampleBookingIds.length < 3) {
        current.sampleBookingIds.push(input.bookingId);
      }
      continue;
    }

    grouped.set(key, {
      status: input.strip.status,
      primaryAction: input.strip.primaryAction,
      detail: input.strip.primaryDetail,
      tone: input.strip.tone,
      count: 1,
      href: input.href,
      sampleBookingIds: [input.bookingId],
    });
  }

  return [...grouped.values()].sort(
    (left, right) =>
      primaryCommandToneWeight(right.tone) - primaryCommandToneWeight(left.tone) ||
      right.count - left.count ||
      left.status.localeCompare(right.status),
  );
}

function primaryCommandToneWeight(tone: BookingCommandDecisionTone) {
  if (tone === 'pill-danger') {
    return 4;
  }
  if (tone === 'pill-warn') {
    return 3;
  }
  if (tone === 'pill-info') {
    return 2;
  }
  if (tone === 'pill-success') {
    return 1;
  }
  return 0;
}
