import type { AdminAuditLog } from './admin-api';
import { readPlainRecord, shortId } from './admin-format';

export type BookingMatchAuditSource = {
  readonly className: string;
  readonly detail: string;
  readonly label: string;
  readonly source: 'CUSTOMER_SELECTED_PARTNER' | 'FIRST_PICK_ACCEPTED_FIRST';
};

export type BookingMatchAuditHighlight = {
  readonly className: string;
  readonly label: string;
};

export function bookingMatchAuditSource(log: AdminAuditLog): BookingMatchAuditSource | null {
  const source = bookingMatchSource(log);
  if (source === 'FIRST_PICK_ACCEPTED_FIRST') {
    return {
      className: 'pill pill-success',
      detail: 'API matched the first-pick Partner before customer fallback selection was needed.',
      label: 'First-pick accepted first',
      source,
    };
  }
  if (source === 'CUSTOMER_SELECTED_PARTNER') {
    return {
      className: 'pill pill-info',
      detail: 'Customer selected from participating Partners after first-pick did not validly win first.',
      label: 'Customer selected Partner',
      source,
    };
  }
  return null;
}

export function bookingMatchAuditHighlights(log: AdminAuditLog): BookingMatchAuditHighlight[] {
  const source = bookingMatchAuditSource(log);
  if (!source) {
    return [];
  }
  const providerId = bookingMatchProviderId(log);
  return [
    { className: source.className, label: source.label },
    providerId ? { className: 'pill pill-info', label: `Partner ${auditEntityId(providerId)}` } : null,
  ].filter((item): item is BookingMatchAuditHighlight => item !== null);
}

export function bookingMatchAuditSummary(log: AdminAuditLog) {
  const source = bookingMatchAuditSource(log);
  if (!source) {
    return '';
  }
  const metadata = readPlainRecord(log.metadata);
  const providerId = bookingMatchProviderId(log);
  const bookingId = typeof metadata?.bookingId === 'string' ? metadata.bookingId : targetId(log.target);
  return [
    source.label,
    providerId ? `Partner ${auditEntityId(providerId)}` : null,
    bookingId ? `booking ${auditEntityId(bookingId)}` : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function bookingMatchAuditDetail(log: AdminAuditLog) {
  const source = bookingMatchAuditSource(log);
  if (!source) {
    return '';
  }
  if (source.source === 'FIRST_PICK_ACCEPTED_FIRST') {
    return 'The first-pick Partner won the race under API rules. Customer fallback selection should no longer be available.';
  }
  return 'The customer selected from participating Partners. This is the fallback path after first-pick did not validly match first.';
}

function bookingMatchSource(log: AdminAuditLog): BookingMatchAuditSource['source'] | null {
  const metadata = readPlainRecord(log.metadata);
  const source = metadata?.matchSource;
  if (source === 'FIRST_PICK_ACCEPTED_FIRST' || log.action === 'booking.matched.first_pick_accepted') {
    return 'FIRST_PICK_ACCEPTED_FIRST';
  }
  if (source === 'CUSTOMER_SELECTED_PARTNER' || log.action === 'booking.matched.customer_selected') {
    return 'CUSTOMER_SELECTED_PARTNER';
  }
  return null;
}

function bookingMatchProviderId(log: AdminAuditLog) {
  const metadata = readPlainRecord(log.metadata);
  return typeof metadata?.providerProfileId === 'string' ? metadata.providerProfileId : null;
}

function targetId(target: string) {
  const [, id] = target.split(':');
  return id || null;
}

function auditEntityId(value: string) {
  return shortId(value, { length: 12 });
}
