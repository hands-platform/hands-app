import type { BookingFinalSelectionCopy } from '../../lib/booking-final-selection-copy';

export type BookingMonitorSelectionFacts = {
  readonly finalSelectionCopy: BookingFinalSelectionCopy | null;
  readonly firstPickPending: boolean;
  readonly hasPreferredProvider: boolean;
  readonly isBackupSelected: boolean;
  readonly isMatched: boolean;
  readonly isSelectedProviderParticipant: boolean;
  readonly marketplaceCount: number;
  readonly preferredProviderState: string | null;
};

export type BookingMonitorSelectionCopy = {
  readonly label: string;
  readonly pathLabel: string;
  readonly toneClass: string;
};

export function bookingMonitorSelectionFromFacts(
  facts: BookingMonitorSelectionFacts,
): BookingMonitorSelectionCopy {
  return {
    label: bookingMonitorSelectionLabel(facts),
    pathLabel: bookingMonitorSelectionPathLabel(facts),
    toneClass: bookingMonitorSelectionToneClass(facts),
  };
}

export function bookingMonitorSelectionLabel(facts: BookingMonitorSelectionFacts): string {
  if (facts.finalSelectionCopy) {
    return facts.finalSelectionCopy.label;
  }

  if (!facts.hasPreferredProvider) {
    return 'No first-pick partner';
  }

  if (facts.isBackupSelected) {
    return 'Marketplace partner selected';
  }

  if (facts.firstPickPending) {
    return 'First-pick partner pending';
  }

  if (facts.preferredProviderState === 'declined') {
    return 'First-pick partner declined';
  }

  if (facts.isMatched) {
    return 'Final partner selected';
  }

  if (facts.isSelectedProviderParticipant) {
    return 'First-pick partner is active';
  }

  return 'First-pick partner requested';
}

export function bookingMonitorSelectionPathLabel(facts: BookingMonitorSelectionFacts): string {
  if (!facts.hasPreferredProvider) {
    return facts.marketplaceCount > 0 ? 'Open pool request with marketplace supply' : 'Open pool request';
  }

  if (facts.finalSelectionCopy?.pathLabel) {
    return facts.finalSelectionCopy.pathLabel;
  }

  if (facts.firstPickPending) {
    return facts.marketplaceCount > 0
      ? 'Direct request first, with marketplace partners already waiting'
      : 'Direct request first, waiting on the first-pick partner';
  }

  if (facts.isBackupSelected) {
    return 'Direct request escalated to marketplace participation, then the guest chose a marketplace partner';
  }

  if (facts.isMatched) {
    return 'Direct request confirmed by the first-pick partner';
  }

  if (facts.marketplaceCount > 0) {
    return 'Marketplace partners are available while the first-pick partner stays in the flow';
  }

  return 'Direct request remains the active path';
}

export function bookingMonitorSelectionToneClass(facts: BookingMonitorSelectionFacts): string {
  if (facts.finalSelectionCopy) {
    return facts.finalSelectionCopy.toneClass;
  }

  if (!facts.hasPreferredProvider) {
    return 'pill-neutral';
  }

  if (facts.firstPickPending) {
    return 'pill-warn';
  }

  if (facts.preferredProviderState === 'declined') {
    return 'pill-info';
  }

  if (facts.isMatched || facts.isSelectedProviderParticipant) {
    return 'pill-success';
  }

  return 'pill-neutral';
}
