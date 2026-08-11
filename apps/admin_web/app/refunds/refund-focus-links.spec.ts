import {
  DEFAULT_REFUND_QUEUE_HREF,
  refundApprovalFocusHref,
  safeRefundReturnTo,
} from './refund-focus-links';

describe('refund focus links', () => {
  it('preserves an exact local refund queue return context', () => {
    const returnTo = '/refunds?range=30d&review=state-mismatch&sort=newest&page=2';

    expect(refundApprovalFocusHref('refund-1', returnTo)).toBe(
      '/finance-tax/approval-queue?view=refunds&requestId=refund-1&returnTo=%2Frefunds%3Frange%3D30d%26review%3Dstate-mismatch%26sort%3Dnewest%26page%3D2#approval-refund-1',
    );
  });

  it.each([
    'https://evil.example/refunds',
    '//evil.example/refunds',
    '/payments',
    'javascript:alert(1)',
  ])('rejects unsafe or unrelated return targets: %s', (value) => {
    expect(safeRefundReturnTo(value)).toBe(DEFAULT_REFUND_QUEUE_HREF);
  });
});
