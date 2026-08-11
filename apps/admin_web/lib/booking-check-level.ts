export type BookingCheckLevelFlag = {
  readonly severity: 'high' | 'medium' | 'low';
  readonly title: string;
};

export function bookingCheckFlag(
  condition: boolean,
  severity: BookingCheckLevelFlag['severity'],
  title: string,
): BookingCheckLevelFlag | null {
  return condition ? { severity, title } : null;
}

export function compactBookingCheckFlags(
  flags: readonly (BookingCheckLevelFlag | null)[],
): BookingCheckLevelFlag[] {
  return flags.filter((flag): flag is BookingCheckLevelFlag => Boolean(flag));
}

export type BookingCheckLevel = {
  readonly helper: string;
  readonly label: 'Action' | 'Watch' | 'Checks clear';
  readonly tone: 'signal-warn' | 'signal-info' | 'signal-ok';
};

export function bookingCheckLevel(flags: readonly BookingCheckLevelFlag[]): BookingCheckLevel {
  if (flags.some((flag) => flag.severity === 'high')) {
    return { label: 'Action', helper: `${flags.length} check(s)`, tone: 'signal-warn' };
  }
  if (flags.some((flag) => flag.severity === 'medium')) {
    return { label: 'Watch', helper: `${flags.length} check(s)`, tone: 'signal-info' };
  }
  if (flags.some((flag) => flag.severity === 'low')) {
    return { label: 'Watch', helper: `${flags.length} check(s)`, tone: 'signal-info' };
  }
  return { label: 'Checks clear', helper: 'No active checks', tone: 'signal-ok' };
}
