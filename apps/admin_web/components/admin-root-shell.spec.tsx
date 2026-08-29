import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminNavSections } from '../lib/admin-navigation';
import { AdminRootShell, restoreConfirmationFocus } from './admin-root-shell';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => new URLSearchParams(),
}));

describe('AdminRootShell', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/bookings');
  });

  it('renders the operations shell for authenticated workspace pages', () => {
    const markup = renderToStaticMarkup(
      <AdminRootShell sections={adminNavSections}>
        <div>Workspace content</div>
      </AdminRootShell>,
    );

    expect(markup).toContain('class="shell"');
    expect(markup).toContain('class="admin-skip-link"');
    expect(markup).toContain('href="#admin-main-content"');
    expect(markup).toContain('<main class="content" id="admin-main-content" tabindex="-1">');
    expect(markup).toContain('class="sidebar"');
    expect(markup).toContain('id="admin-mobile-sidebar"');
    expect(markup).toContain('aria-label="Admin navigation"');
    expect(markup).toContain('class="sidebar-backdrop"');
    expect(markup).toContain('class="sidebar-close-button"');
    expect(markup).toContain('topbar-mobile-menu-button');
    expect(markup).toContain('aria-controls="admin-mobile-sidebar"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Workspace content');
    expect(markup).toContain('aria-label="Operations Policy"');
    expect(markup).toContain('aria-label="Operation alerts, 0"');
    expect(markup).toContain('aria-label="Confirm identity for high-risk changes"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain('name="mfaCode"');
    expect(markup).not.toContain('aria-label="Help"');
    expect(markup).not.toContain('class="workspace-page-title"');
    expect(markup).toContain('Vietnam Operations Map');
    expect(markup).not.toContain('Live Workspace');
  });

  it('stores stable dropdown triggers and falls back to main after route-based confirmations close', () => {
    const source = readFileSync('components/admin-root-shell.tsx', 'utf8');

    expect(source).toContain("'repairBookingId'");
    expect(source).toContain("sessionStorage.setItem(");
    expect(source).toContain("querySelector<HTMLButtonElement>(':scope > button[aria-label]')");
    expect(source).toContain('triggerIndex: trigger ? matchingTriggers.indexOf(trigger) : -1');
    expect(source).toContain("document.getElementById('admin-main-content')");
    expect(source).toContain('sessionStorage.removeItem(confirmationReturnFocusKey)');
  });

  it.each(['Escape', 'Cancel'])('%s restores the exact first-row trigger without submitting', () => {
    const focused: string[] = [];
    const submit = vi.fn();
    const firstTrigger = focusableButton('Actions for Partner note first-note', focused);
    const secondTrigger = focusableButton('Actions for Partner note second-note', focused);
    const main = focusableElement('main', focused);
    const focusDocument = {
      getElementById: () => main,
      querySelectorAll: (selector: string) =>
        selector === 'button[aria-label]' ? [firstTrigger, secondTrigger] : [],
    } as unknown as Pick<Document, 'getElementById' | 'querySelectorAll'>;

    expect(
      restoreConfirmationFocus(
        {
          href: '/reviews/partner-customer-evaluations?confirm=moderate&noteId=first-note',
          index: 0,
          pathname: '/reviews/partner-customer-evaluations',
          triggerIndex: 0,
          triggerLabel: 'Actions for Partner note first-note',
        },
        '/reviews/partner-customer-evaluations',
        focusDocument,
      ),
    ).toBe(true);

    expect(focused).toEqual(['Actions for Partner note first-note']);
    expect(firstTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(secondTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(submit).not.toHaveBeenCalled();
  });

  it('restores focus after Website Content confirmations close', () => {
    const source = readFileSync('components/admin-root-shell.tsx', 'utf8');

    expect(source).toContain("'confirmPublish'");
    expect(source).toContain("'discardDraft'");
    expect(source).toContain("'deletePageId'");
    expect(source).toContain("'deleteSectionId'");
    expect(source).toContain("'rollbackRevisionId'");
  });
});

function focusableButton(label: string, focused: string[]) {
  return {
    focus: () => focused.push(label),
    getAttribute: (name: string) => {
      if (name === 'aria-expanded') return 'false';
      if (name === 'aria-label') return label;
      return null;
    },
  } as unknown as HTMLButtonElement;
}

function focusableElement(label: string, focused: string[]) {
  return {
    focus: () => focused.push(label),
  } as unknown as HTMLElement;
}
