import { operationsPolicyNotice } from './policy-notice';

describe('operations policy notice', () => {
  it('returns saved notice from query params', () => {
    expect(operationsPolicyNotice({ reason: 'matching policy', status: 'saved' })).toEqual({
      detail:
        'Updated matching policy. New bookings and partner participation checks will use the latest enforced settings.',
      title: 'Operational policy saved',
      tone: 'success',
    });
  });

  it('uses specific copy for missing value blocks', () => {
    expect(operationsPolicyNotice({ reason: 'missing-value', status: 'blocked' })).toEqual({
      detail: 'Enter a policy value before saving.',
      title: 'Policy update blocked',
      tone: 'danger',
    });
  });

  it('reads first array value and ignores unknown status', () => {
    expect(operationsPolicyNotice({ reason: ['missing-value'], status: ['blocked'] })?.detail).toBe(
      'Enter a policy value before saving.',
    );
    expect(operationsPolicyNotice({ status: 'noop' })).toBeNull();
  });
});
