import type { BookingMonitorSummaryFact } from './booking-monitor-summary';

export type BookingMonitorSummaryFactInput = Omit<BookingMonitorSummaryFact, 'highPriorityCheck'> & {
  readonly checkSeverities: readonly string[];
};

export function bookingMonitorSummaryFactFromInputs(
  input: BookingMonitorSummaryFactInput,
): BookingMonitorSummaryFact {
  const { checkSeverities, ...fact } = input;

  return {
    ...fact,
    highPriorityCheck: checkSeverities.includes('high'),
  };
}
