import { readSearchParam } from '../../../lib/date-range';

export type PartnerDetailSection =
  | 'overview'
  | 'full'
  | 'control'
  | 'bookings'
  | 'access'
  | 'dossier';
export type PartnerControlView = 'work' | 'records' | 'reference';
export type PartnerBookingsView = 'journey' | 'evidence' | 'ledger';
export type PartnerAccessView = 'readiness' | 'controls' | 'diagnostics';
export type PartnerDossierView = 'approval' | 'evidence' | 'finance';
export type PartnerDetailTarget =
  | 'account-controls'
  | 'app-activity'
  | 'bank'
  | 'booking-evidence'
  | 'booking-gate'
  | 'booking-journey'
  | 'cash-debt'
  | 'connected-records'
  | 'control-queue'
  | 'documents'
  | 'location'
  | 'master-facts'
  | 'operator-notes'
  | 'payout'
  | 'review-history'
  | 'service-pricing'
  | 'tax';

type PartnerDetailSearchParams = Record<string, string | string[] | undefined>;

export function readPartnerDetailSection(params: PartnerDetailSearchParams): PartnerDetailSection {
  const rawSection = readSearchParam(params.section);
  if (rawSection === 'overview' || rawSection === 'full') {
    return rawSection;
  }
  if (
    rawSection === 'control' ||
    rawSection === 'bookings' ||
    rawSection === 'access' ||
    rawSection === 'dossier'
  ) {
    return rawSection;
  }
  if (readSearchParam(params.deviceAction) || readSearchParam(params.controlAction)) {
    return 'access';
  }
  if (readSearchParam(params.reviewAction)) {
    return 'dossier';
  }
  if (readSearchParam(params.confirm)) {
    return 'control';
  }
  return 'overview';
}

export function readPartnerControlView(params: PartnerDetailSearchParams): PartnerControlView {
  const controlView = readSearchParam(params.control);
  return controlView === 'records' || controlView === 'reference' ? controlView : 'work';
}

export function readPartnerBookingsView(params: PartnerDetailSearchParams): PartnerBookingsView {
  const bookingsView = readSearchParam(params.bookings);
  return bookingsView === 'evidence' || bookingsView === 'ledger' ? bookingsView : 'journey';
}

export function readPartnerAccessView(params: PartnerDetailSearchParams): PartnerAccessView {
  if (readSearchParam(params.deviceAction)) {
    return 'diagnostics';
  }
  const accessView = readSearchParam(params.access);
  return accessView === 'controls' || accessView === 'diagnostics' ? accessView : 'readiness';
}

export function readPartnerDossierView(params: PartnerDetailSearchParams): PartnerDossierView {
  const dossierView = readSearchParam(params.dossier);
  return dossierView === 'evidence' || dossierView === 'finance' ? dossierView : 'approval';
}

export function buildPartnerDetailWorkspaceHref(
  providerId: string,
  section: Exclude<PartnerDetailSection, 'overview' | 'full'>,
  view?: PartnerControlView | PartnerBookingsView | PartnerAccessView | PartnerDossierView,
) {
  const query = new URLSearchParams({ section });
  if (section === 'control' && (view === 'records' || view === 'reference')) {
    query.set('control', view);
  }
  if (section === 'bookings' && (view === 'evidence' || view === 'ledger')) {
    query.set('bookings', view);
  }
  if (section === 'dossier' && (view === 'evidence' || view === 'finance')) {
    query.set('dossier', view);
  }
  if (section === 'access' && (view === 'controls' || view === 'diagnostics')) {
    query.set('access', view);
  }
  return `/partners/${encodeURIComponent(providerId)}?${query.toString()}`;
}

const PARTNER_DETAIL_TARGETS: Record<
  PartnerDetailTarget,
  {
    readonly hash: string;
    readonly section: Exclude<PartnerDetailSection, 'overview' | 'full'>;
    readonly view: PartnerControlView | PartnerBookingsView | PartnerAccessView | PartnerDossierView;
  }
> = {
  'account-controls': { hash: 'partner-reports-controls', section: 'access', view: 'controls' },
  'app-activity': { hash: 'app-activity', section: 'access', view: 'diagnostics' },
  bank: { hash: 'bank', section: 'dossier', view: 'finance' },
  'booking-evidence': { hash: 'booking-chat-records', section: 'bookings', view: 'evidence' },
  'booking-gate': { hash: 'partner-booking-gate-decision', section: 'access', view: 'readiness' },
  'booking-journey': { hash: 'partner-booking-journey', section: 'bookings', view: 'journey' },
  'cash-debt': { hash: 'cash-debt-origin', section: 'dossier', view: 'finance' },
  'connected-records': {
    hash: 'partner-connected-operations-records',
    section: 'control',
    view: 'work',
  },
  'control-queue': { hash: 'partner-operator-command-queue', section: 'control', view: 'work' },
  documents: { hash: 'documents', section: 'dossier', view: 'evidence' },
  location: { hash: 'location', section: 'dossier', view: 'evidence' },
  'master-facts': { hash: 'partner-master-facts', section: 'control', view: 'reference' },
  'operator-notes': { hash: 'partner-operator-notes', section: 'control', view: 'records' },
  payout: { hash: 'payout-operations', section: 'dossier', view: 'finance' },
  'review-history': { hash: 'partner-review-history', section: 'dossier', view: 'evidence' },
  'service-pricing': { hash: 'service-pricing', section: 'dossier', view: 'evidence' },
  tax: { hash: 'tax', section: 'dossier', view: 'finance' },
};

export function buildPartnerDetailTargetHref(providerId: string, target: PartnerDetailTarget) {
  const destination = PARTNER_DETAIL_TARGETS[target];
  return `${buildPartnerDetailWorkspaceHref(providerId, destination.section, destination.view)}#${destination.hash}`;
}

export function partnerDetailWorkspaceHref(
  providerId: string,
  section: Exclude<PartnerDetailSection, 'overview' | 'full'>,
  hash = '',
) {
  const legacyTarget: Partial<Record<string, PartnerDetailTarget>> = {
    '#admin': 'account-controls',
    '#app-activity': 'app-activity',
    '#bank': 'bank',
    '#booking-chat-records': 'booking-evidence',
    '#kyc': 'documents',
    '#location': 'location',
    '#partner-access-section': 'booking-gate',
    '#partner-booking-journey': 'booking-journey',
    '#partner-operator-notes': 'operator-notes',
    '#payout': 'payout',
    '#service-pricing': 'service-pricing',
    '#tax': 'tax',
  };
  const target = legacyTarget[hash];
  if (target) {
    return buildPartnerDetailTargetHref(providerId, target);
  }
  return `${buildPartnerDetailWorkspaceHref(providerId, section)}${hash}`;
}
