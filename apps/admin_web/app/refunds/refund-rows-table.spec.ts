import { focusRefundHashRow, parseRefundHashTarget } from './refund-rows-table';

describe('RefundRowsTable hash targets', () => {
  it('parses supported checklist and exact row hashes', () => {
    expect(parseRefundHashTarget('#refund-review-refund_1')).toEqual({
      id: 'refund_1',
      kind: 'checklist',
    });
    expect(parseRefundHashTarget('#refund-refund-1')).toEqual({
      id: 'refund-1',
      kind: 'row',
    });
  });

  it.each(['#refund-review-%', '#refund-review-%ZZ', '#unknown-refund-1', '#refund-'])(
    'ignores malformed or unsupported hash %s',
    (hash) => {
      expect(parseRefundHashTarget(hash)).toBeNull();
    },
  );

  it('focuses an exact row without changing the native hash scroll position', () => {
    const target = { focus: vi.fn() } as unknown as HTMLElement;

    focusRefundHashRow(target);

    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
