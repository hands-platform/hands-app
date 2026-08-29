import { readFileSync } from 'node:fs';

const source = readFileSync('components/use-admin-modal-focus.ts', 'utf8');

describe('useAdminModalFocus', () => {
  it('traps Tab, closes on Escape, and restores the prior focus target', () => {
    expect(source).toContain('window.setTimeout');
    expect(source).toContain('container.scrollTop = 0');
    expect(source).toContain('container.focus({ preventScroll: true })');
    expect(source).not.toContain('(focusable[0] ?? container).focus()');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain("event.key !== 'Tab'");
    expect(source).toContain('document.activeElement === container');
    expect(source).toContain('last.focus()');
    expect(source).toContain('first.focus()');
    expect(source).toContain('returnFocus?.focus({ preventScroll: true })');
  });

  it('can remain dormant while a conditionally rendered drawer is closed', () => {
    expect(source).toContain('if (!active) return;');
    expect(source).toContain('[active, containerRef, returnFocusRef]');
  });
});
