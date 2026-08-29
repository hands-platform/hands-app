import { readFileSync } from 'node:fs';

import {
  buildPartnerAccountControlDraft,
  partnerAccountControlHiddenInputs,
  partnerAccountControlImpact,
} from './partner-detail-account-control-form';

const source = readFileSync('app/partners/[id]/partner-detail-account-control-form.tsx', 'utf8');

describe('PartnerDetailAccountControlForm', () => {
  it('builds an explicit no-expiry warning confirmation without calling the mutation', () => {
    const result = buildPartnerAccountControlDraft(
      controlForm({ noExpiry: 'true', type: 'WARNING' }),
      'partner-1',
    );

    expect(result).toEqual({
      draft: {
        expiresAt: '',
        noExpiry: true,
        partnerId: 'partner-1',
        reason: 'Verified safety evidence',
        reportId: '',
        reportLabel: 'Not linked',
        type: 'WARNING',
      },
      ok: true,
    });
    if (!result.ok) throw new Error(result.message);
    expect(partnerAccountControlHiddenInputs(result.draft)).toEqual([
      { name: 'providerProfileId', value: 'partner-1' },
      { name: 'type', value: 'WARNING' },
      { name: 'reason', value: 'Verified safety evidence' },
      { name: 'noExpiry', value: 'true' },
      { name: 'confirmation', value: 'confirmed' },
    ]);
  });

  it.each([
    ['WARNING', 'without automatically blocking Partner operations'],
    ['PAYOUT_HOLD', 'Blocks payout creation and release'],
    ['ACCOUNT_BLOCK', 'Blocks Partner visibility'],
    ['TRUST_BADGE_REMOVAL', 'Removes the public profile trust indicator'],
  ] as const)('states the %s operating impact', (type, expected) => {
    expect(partnerAccountControlImpact(type)).toContain(expected);
  });

  it('keeps the linked report and explicit future expiry in the confirmed payload', () => {
    const result = buildPartnerAccountControlDraft(
      controlForm({ expiresAt: '2099-09-01T09:30', reportId: 'report-1', type: 'ACCOUNT_BLOCK' }),
      'partner-1',
      [{ label: 'rep-1 / Safety complaint', value: 'report-1' }],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.draft.reportLabel).toBe('rep-1 / Safety complaint');
    expect(partnerAccountControlHiddenInputs(result.draft)).toEqual(
      expect.arrayContaining([
        { name: 'expiresAt', value: '2099-09-01T09:30' },
        { name: 'reportId', value: 'report-1' },
        { name: 'confirmation', value: 'confirmed' },
      ]),
    );
  });

  it.each([
    [{}, 'Choose either an expiry or No expiry before review.'],
    [{ expiresAt: '2099-09-01T09:30', noExpiry: 'true' }, 'Choose either an expiry or No expiry before review.'],
    [{ noExpiry: 'true', providerProfileId: 'partner-2' }, 'The Partner target changed. Refresh this page before applying a control.'],
    [{ noExpiry: 'true', reportId: 'missing' }, 'Choose a loaded report before applying a linked control.'],
    [{ noExpiry: 'true', reason: 'x'.repeat(501) }, 'Enter a reason no longer than 500 characters before review.'],
  ])('rejects an unsafe confirmation draft %#', (values, message) => {
    const reports = 'reportId' in values ? [{ label: 'Report 1', value: 'report-1' }] : [];
    expect(buildPartnerAccountControlDraft(controlForm(values), 'partner-1', reports)).toEqual({
      message,
      ok: false,
    });
  });

  it('reuses the shared dialog and locks duplicate submits while preserving error recovery', () => {
    expect(source).toContain('useActionState(createProviderSanctionWithState, null)');
    expect(source).toContain('<ConfirmDialog');
    expect(source).toContain('loading={pending}');
    expect(source).toContain('onCancel={cancelConfirmation}');
    expect(source).toContain('onSubmit={guardConfirmationSubmit}');
    expect(source).toContain('returnFocusRef={returnFocusRef}');
    expect(source).toContain('pending || submissionLocked.current');
    expect(source).toContain('submissionLocked.current = true');
    expect(source).toContain('setStateVisible(false)');
    expect(source).toContain('setStateVisible(true)');
    expect(source).toContain("role={status === 'error' ? 'alert' : 'status'}");
    expect(source).toContain('message={state.message}');
  });
});

function controlForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [name, value] of Object.entries({
    providerProfileId: 'partner-1',
    reason: 'Verified safety evidence',
    type: 'PAYOUT_HOLD',
    ...overrides,
  })) {
    formData.set(name, value);
  }
  return formData;
}
