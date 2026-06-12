import type { BookingEvidenceFilter } from './booking-page-params';

export type BookingMonitorEvidenceMatchReaders = {
  readonly activeStatus: () => boolean;
  readonly addressNeedsOps: () => boolean;
  readonly alertEvidenceNeedsOps: () => boolean;
  readonly cashDebtNeedsOps: () => boolean;
  readonly chatLive: () => boolean;
  readonly chatRepairNeedsOps: () => boolean;
  readonly closeoutNeedsOps: () => boolean;
  readonly hasFinalPartner: () => boolean;
  readonly hasProviderLocation: () => boolean;
  readonly locationNeedsOps: () => boolean;
  readonly paymentNeedsOps: () => boolean;
  readonly status: () => string;
  readonly terminalStatus: () => boolean;
};

export function bookingMatchesMonitorEvidenceFilter(
  evidenceFilter: BookingEvidenceFilter,
  readers: BookingMonitorEvidenceMatchReaders,
) {
  switch (evidenceFilter) {
    case 'all':
      return true;
    case 'address':
      return readers.addressNeedsOps();
    case 'partner':
      return (
        readers.status() === 'OPEN_MATCHING' ||
        (readers.activeStatus() && !readers.hasFinalPartner())
      );
    case 'chat':
      return readers.chatRepairNeedsOps() || readers.chatLive();
    case 'money':
      return readers.paymentNeedsOps() || readers.cashDebtNeedsOps() || readers.closeoutNeedsOps();
    case 'location':
      return readers.locationNeedsOps() || readers.hasProviderLocation();
    case 'alerts':
      return readers.alertEvidenceNeedsOps();
    case 'closeout':
      return (
        readers.terminalStatus() ||
        readers.closeoutNeedsOps() ||
        readers.status() === 'NO_SHOW'
      );
    default:
      return true;
  }
}
