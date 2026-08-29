import { AdminDetails, closeAdminDetailsOnEscape } from './admin-details';

describe('AdminDetails', () => {
  it('accepts browser-restored disclosure state during hydration', () => {
    expect(AdminDetails({ children: null }).props.suppressHydrationWarning).toBe(true);
  });

  it('closes an open disclosure on Escape and restores focus to its summary', () => {
    const focus = vi.fn();
    const details = {
      open: true,
      querySelector: () => ({ focus }),
    } as unknown as HTMLDetailsElement;

    expect(closeAdminDetailsOnEscape('Enter', details)).toBe(false);
    expect(closeAdminDetailsOnEscape(' ', details)).toBe(false);
    expect(details.open).toBe(true);
    expect(closeAdminDetailsOnEscape('Escape', details)).toBe(true);
    expect(details.open).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
  });
});
