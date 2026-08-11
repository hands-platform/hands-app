import { describe, expect, it } from 'vitest';
import {
  buildPartnerDetailWorkspaceHref,
  partnerDetailWorkspaceHref,
  readPartnerAccessView,
  readPartnerBookingsView,
  readPartnerControlView,
  readPartnerDetailSection,
  readPartnerDossierView,
} from './partner-detail-workspace-model';

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
      '/partners/partner 1?section=bookings&bookings=ledger',
    );
    expect(buildPartnerDetailWorkspaceHref('partner-1', 'control', 'work')).toBe(
      '/partners/partner-1?section=control',
    );
    expect(partnerDetailWorkspaceHref('partner 1', 'dossier', '#kyc')).toBe(
      '/partners/partner%201?section=dossier#kyc',
    );
  });
});
