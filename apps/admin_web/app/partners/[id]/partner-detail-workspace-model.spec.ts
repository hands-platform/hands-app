import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildPartnerDetailTargetHref,
  buildPartnerDetailWorkspaceHref,
  partnerDetailWorkspaceHref,
  readPartnerAccessView,
  readPartnerBookingsView,
  readPartnerControlView,
  readPartnerDetailSection,
  readPartnerDossierView,
} from './partner-detail-workspace-model';

const targetSources = [
  'app/partners/[id]/page.tsx',
  'app/partners/[id]/partner-detail-app-activity-section.tsx',
  'app/partners/[id]/partner-detail-booking-chat-records-section.tsx',
  'app/partners/[id]/partner-detail-booking-gate-decision-section.tsx',
  'app/partners/[id]/partner-detail-cash-debt-origin-section.tsx',
  'app/partners/[id]/partner-detail-document-media-section.tsx',
  'app/partners/[id]/partner-detail-finance-gate-section.tsx',
  'app/partners/[id]/partner-detail-master-facts-section.tsx',
  'app/partners/[id]/partner-detail-operator-notes-section.tsx',
  'app/partners/[id]/partner-detail-operator-command-queue-section.tsx',
  'app/partners/[id]/partner-detail-payout-operations-section.tsx',
  'app/partners/[id]/partner-detail-profile-finance-summary-section.tsx',
  'app/partners/[id]/partner-detail-reports-controls-section.tsx',
  'app/partners/[id]/partner-detail-review-progress-section.tsx',
  'app/partners/[id]/partner-detail-service-pricing-section.tsx',
].map((path) => readFileSync(path, 'utf8')).join('\n');

describe('partner detail workspace model', () => {
  it('keeps the lightweight overview as the default and preserves the explicit full record', () => {
    expect(readPartnerDetailSection({})).toBe('overview');
    expect(readPartnerDetailSection({ section: 'full' })).toBe('full');
  });

  it('routes pending operator actions to their owning workspace', () => {
    expect(readPartnerDetailSection({ deviceAction: 'revoke-device' })).toBe('access');
    expect(readPartnerDetailSection({ controlAction: 'lift-control' })).toBe('access');
    expect(readPartnerDetailSection({ reviewAction: 'approve-kyc' })).toBe('dossier');
    expect(readPartnerDetailSection({ confirm: 'approve' })).toBe('control');
  });

  it('normalizes workspace views and rejects unsupported values', () => {
    expect(readPartnerControlView({ control: 'records' })).toBe('records');
    expect(readPartnerControlView({ control: 'unsupported' })).toBe('work');
    expect(readPartnerBookingsView({ bookings: 'ledger' })).toBe('ledger');
    expect(readPartnerBookingsView({ bookings: 'unsupported' })).toBe('journey');
    expect(readPartnerAccessView({ deviceAction: 'revoke-device' })).toBe('diagnostics');
    expect(readPartnerAccessView({ access: 'controls' })).toBe('controls');
    expect(readPartnerDossierView({ dossier: 'finance' })).toBe('finance');
  });

  it('builds stable workspace links without unrelated query parameters', () => {
    expect(buildPartnerDetailWorkspaceHref('partner 1', 'bookings', 'ledger')).toBe(
      '/partners/partner%201?section=bookings&bookings=ledger',
    );
    expect(buildPartnerDetailWorkspaceHref('partner-1', 'control', 'work')).toBe(
      '/partners/partner-1?section=control',
    );
    expect(partnerDetailWorkspaceHref('partner 1', 'dossier', '#kyc')).toBe(
      '/partners/partner%201?section=dossier&dossier=evidence#documents',
    );
  });

  it.each([
    ['account-controls', '/partners/partner-1?section=access&access=controls#partner-reports-controls'],
    ['app-activity', '/partners/partner-1?section=access&access=diagnostics#app-activity'],
    ['bank', '/partners/partner-1?section=dossier&dossier=finance#bank'],
    ['booking-evidence', '/partners/partner-1?section=bookings&bookings=evidence#booking-chat-records'],
    ['booking-gate', '/partners/partner-1?section=access#partner-booking-gate-decision'],
    ['booking-journey', '/partners/partner-1?section=bookings#partner-booking-journey'],
    ['cash-debt', '/partners/partner-1?section=dossier&dossier=finance#cash-debt-origin'],
    ['connected-records', '/partners/partner-1?section=control#partner-connected-operations-records'],
    ['control-queue', '/partners/partner-1?section=control#partner-operator-command-queue'],
    ['documents', '/partners/partner-1?section=dossier&dossier=evidence#documents'],
    ['location', '/partners/partner-1?section=dossier&dossier=evidence#location'],
    ['master-facts', '/partners/partner-1?section=control&control=reference#partner-master-facts'],
    ['operator-notes', '/partners/partner-1?section=control&control=records#partner-operator-notes'],
    ['payout', '/partners/partner-1?section=dossier&dossier=finance#payout-operations'],
    ['review-history', '/partners/partner-1?section=dossier&dossier=evidence#partner-review-history'],
    ['service-pricing', '/partners/partner-1?section=dossier&dossier=evidence#service-pricing'],
    ['tax', '/partners/partner-1?section=dossier&dossier=finance#tax'],
  ] as const)('routes %s to a rendered canonical target', (target, expectedHref) => {
    const href = buildPartnerDetailTargetHref('partner-1', target);
    const hash = new URL(href, 'http://localhost').hash.slice(1);

    expect(href).toBe(expectedHref);
    expect(targetSources).toContain(`id="${hash}"`);
  });
});
