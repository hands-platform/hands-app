export type BookingCheckLevelFlag = {
  readonly severity: 'high' | 'medium' | 'low';
  readonly title: string;
};

export type BookingCheckLevel = {
  readonly helper: string;
  readonly label: 'Action' | 'Monitor' | 'Note' | 'Clear';
  readonly tone: 'signal-warn' | 'signal-info' | 'signal-ok';
};

export function bookingCheckLevel(flags: readonly BookingCheckLevelFlag[]): BookingCheckLevel {
  if (flags.some((flag) => flag.severity === 'high')) {
    return { label: 'Action', helper: `${flags.length} check(s)`, tone: 'signal-warn' };
  }
  if (flags.some((flag) => flag.severity === 'medium')) {
    return { label: 'Monitor', helper: `${flags.length} check(s)`, tone: 'signal-info' };
  }
  if (flags.some((flag) => flag.severity === 'low')) {
    return { label: 'Note', helper: `${flags.length} check(s)`, tone: 'signal-info' };
  }
  return { label: 'Clear', helper: 'No active checks', tone: 'signal-ok' };
}
