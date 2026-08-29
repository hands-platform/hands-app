import { focusPayoutRecordHashTarget } from './payout-record-hash-focus';

describe('Payout record hash focus', () => {
  it('makes the exact row focusable, scrolls it into view, and focuses it', () => {
    const target = {
      focus: vi.fn(),
      hasAttribute: vi.fn().mockReturnValue(false),
      scrollIntoView: vi.fn(),
      setAttribute: vi.fn(),
    } as unknown as HTMLElement;

    focusPayoutRecordHashTarget(target, true);

    expect(target.setAttribute).toHaveBeenCalledWith('tabindex', '-1');
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
