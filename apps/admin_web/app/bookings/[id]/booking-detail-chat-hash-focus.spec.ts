import { openBookingChatDisclosuresAndFocus } from './booking-detail-chat-hash-focus';

describe('Booking detail chat hash focus', () => {
  it('opens only ancestor disclosures before scrolling and focusing on the next frame', () => {
    const outerDisclosure = disclosure(null);
    const innerDisclosure = disclosure(outerDisclosure);
    const setAttribute = vi.fn();
    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    const target = {
      focus,
      hasAttribute: vi.fn().mockReturnValue(false),
      parentElement: { closest: vi.fn().mockReturnValue(innerDisclosure) },
      scrollIntoView,
      setAttribute,
    } as unknown as HTMLElement;
    let frameCallback: FrameRequestCallback | undefined;

    openBookingChatDisclosuresAndFocus(target, (callback) => {
      frameCallback = callback;
      return 1;
    });

    expect(innerDisclosure.open).toBe(true);
    expect(outerDisclosure.open).toBe(true);
    expect(scrollIntoView).not.toHaveBeenCalled();
    frameCallback?.(0);
    expect(setAttribute).toHaveBeenCalledWith('tabindex', '-1');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('preserves an existing tabindex for a transcript outside disclosures', () => {
    const setAttribute = vi.fn();
    const target = {
      focus: vi.fn(),
      hasAttribute: vi.fn().mockReturnValue(true),
      parentElement: { closest: vi.fn().mockReturnValue(null) },
      scrollIntoView: vi.fn(),
      setAttribute,
    } as unknown as HTMLElement;

    openBookingChatDisclosuresAndFocus(target, (callback) => {
      callback(0);
      return 1;
    });

    expect(setAttribute).not.toHaveBeenCalled();
  });
});

function disclosure(parent: HTMLDetailsElement | null) {
  return {
    open: false,
    parentElement: { closest: vi.fn().mockReturnValue(parent) },
  } as unknown as HTMLDetailsElement;
}
