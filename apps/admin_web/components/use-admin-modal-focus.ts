'use client';

import { useEffect, useRef, type RefObject } from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useAdminModalFocus(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  returnFocusRef?: RefObject<HTMLElement | null>,
  active = true,
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    let cleanup: (() => void) | undefined;
    const timeout = window.setTimeout(() => {
      if (!containerRef.current) return;
      const container: HTMLElement = containerRef.current;
      const previousFocus =
        returnFocusRef?.current ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      const returnFocus = returnFocusRef?.current ?? previousFocus;
      const focusable = modalFocusableElements(container);
      (focusable[0] ?? container).focus();
      const background = disableModalBackground(container);

      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCloseRef.current();
          return;
        }

        if (event.key !== 'Tab') return;

        const currentFocusable = modalFocusableElements(container);
        if (currentFocusable.length === 0) {
          event.preventDefault();
          container.focus();
          return;
        }

        const first = currentFocusable[0]!;
        const last = currentFocusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      container.addEventListener('keydown', handleKeyDown);
      cleanup = () => {
        container.removeEventListener('keydown', handleKeyDown);
        restoreModalBackground(background);
        returnFocus?.focus();
      };
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      cleanup?.();
    };
  }, [active, containerRef, returnFocusRef]);
}

type ModalBackgroundState = {
  readonly ariaHidden: string | null;
  readonly element: HTMLElement;
  readonly inert: boolean;
};

function disableModalBackground(container: HTMLElement) {
  const states: ModalBackgroundState[] = [];
  let branch: HTMLElement = container;

  while (branch.parentElement) {
    const parent = branch.parentElement;
    for (const sibling of parent.children) {
      if (!(sibling instanceof HTMLElement) || sibling === branch) continue;
      if (sibling.matches('.calendar-drawer-backdrop, script, style')) continue;
      states.push({
        ariaHidden: sibling.getAttribute('aria-hidden'),
        element: sibling,
        inert: sibling.inert,
      });
      sibling.inert = true;
      sibling.setAttribute('aria-hidden', 'true');
    }
    if (parent === document.body) break;
    branch = parent;
  }

  return states;
}

function restoreModalBackground(states: readonly ModalBackgroundState[]) {
  for (const state of states) {
    state.element.inert = state.inert;
    if (state.ariaHidden === null) {
      state.element.removeAttribute('aria-hidden');
    } else {
      state.element.setAttribute('aria-hidden', state.ariaHidden);
    }
  }
}

function modalFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true' && element.tabIndex >= 0,
  );
}
