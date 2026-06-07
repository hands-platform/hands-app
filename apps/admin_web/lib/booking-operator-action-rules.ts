const noShowEligibleStatuses = new Set([
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
]);

export function bookingOperatorNoteLines(notes?: string | null): string[] {
  return (notes ?? '')
    .split('\n')
    .map((note) => note.trim())
    .filter(Boolean);
}

export function canMarkNoShow(status: string): boolean {
  return noShowEligibleStatuses.has(status);
}

export function canExpireBooking(status: string): boolean {
  return status === 'OPEN_MATCHING';
}
