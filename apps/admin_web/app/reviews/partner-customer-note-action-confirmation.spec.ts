import {
  buildPartnerNoteModerationConfirmation,
  partnerNoteModerationConfirmHref,
  readPartnerNoteModerationStatus,
  safePartnerNoteReturnTo,
} from './partner-customer-note-action-confirmation';

describe('Partner note moderation confirmation', () => {
  it('preserves list context while using a separate target-state query key', () => {
    const href = partnerNoteModerationConfirmHref(
      'note-1',
      'REPORTED',
      '/reviews/partner-customer-evaluations?q=late&status=restricted&page=2',
    );
    const url = new URL(href, 'http://admin.local');

    expect(url.searchParams.get('q')).toBe('late');
    expect(url.searchParams.get('status')).toBe('restricted');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('targetStatus')).toBe('REPORTED');
    expect(url.searchParams.get('returnTo')).toBe(
      '/reviews/partner-customer-evaluations?q=late&status=restricted&page=2',
    );
  });

  it('makes the Needs review consequence explicit', () => {
    const confirmation = buildPartnerNoteModerationConfirmation(
      { id: 'note-1', comment: 'Immutable note', status: 'PUBLISHED' },
      'REPORTED',
      '/reviews/partner-customer-evaluations',
    );

    expect(confirmation?.targetLabel).toBe('Needs review');
    expect(confirmation?.title).toBe('Send note note-1 to Needs review?');
    expect(confirmation?.impact).toContain("customer's Needs review signal");
    expect(confirmation?.reasonOptions?.length).toBeGreaterThan(1);
    expect(confirmation?.hiddenInputs).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'comment' })]),
    );
  });

  it('uses state-specific confirmation copy and reason requirements', () => {
    const note = { id: 'note-2', comment: 'Immutable note', status: 'REPORTED' };
    const restricted = buildPartnerNoteModerationConfirmation(
      note,
      'HIDDEN',
      '/reviews/partner-customer-evaluations',
    );
    const retained = buildPartnerNoteModerationConfirmation(
      note,
      'PUBLISHED',
      '/reviews/partner-customer-evaluations',
    );

    expect(restricted?.title).toBe('Restrict note note-2?');
    expect(restricted?.reasonOptions?.map((option) => option.label)).toContain('Confirmed sensitive data');
    expect(retained?.title).toBe('Return note note-2 to Retained?');
    expect(retained?.reasonOptions).toBeNull();
    expect(retained?.hiddenInputs).toEqual(
      expect.arrayContaining([{ name: 'reason', value: 'Returned to Retained' }]),
    );
  });

  it('clears unsafe return paths and rejects unknown states', () => {
    expect(safePartnerNoteReturnTo('/customers/customer-1')).toBe('/reviews/partner-customer-evaluations');
    expect(readPartnerNoteModerationStatus('DELETED')).toBeNull();
  });
});
