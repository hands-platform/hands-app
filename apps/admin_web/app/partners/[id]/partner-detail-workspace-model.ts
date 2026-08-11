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
  return `/partners/${providerId}?${query.toString()}`;
}

export function partnerDetailWorkspaceHref(
  providerId: string,
  section: Exclude<PartnerDetailSection, 'overview' | 'full'>,
  hash = '',
) {
  return `/partners/${encodeURIComponent(providerId)}?section=${section}${hash}`;
}
