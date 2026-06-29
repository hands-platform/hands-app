import { taxPolicyNotice } from './tax-policy-notice';

describe('tax policy notice', () => {
  it('returns validation notice copy from query params', () => {
    expect(
      taxPolicyNotice({
        message: 'Effective to must be after effective from.',
        taxPolicyNotice: 'validation',
      }),
    ).toEqual({
      badge: 'Blocked',
      detail: 'Effective to must be after effective from.',
      title: 'Tax policy update blocked',
      tone: 'danger',
    });
  });

  it('reads first array value and ignores unknown notices', () => {
    expect(
      taxPolicyNotice({
        message: ['Effective from is required.'],
        taxPolicyNotice: ['validation'],
      })?.detail,
    ).toBe('Effective from is required.');
    expect(taxPolicyNotice({ taxPolicyNotice: 'saved' })).toBeNull();
  });
});
