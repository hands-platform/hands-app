'use client';

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  ChevronRight,
  KeyRound,
  LogOut,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  adminNavSearchResults,
  groupAdminNavSearchResults,
  type AdminNavSection,
} from '../lib/admin-navigation';
import { adminBreadcrumbContext } from '../lib/admin-nav-match';
import { AdminEmptyState } from './admin-empty-state';
import { AdminFormShell } from './admin-form-light-controls';
import { AdminIconButton } from './admin-icon-button';
import { AdminIconLink } from './admin-icon-link';
import { AdminReauthenticateOperatorForm } from './admin-reauthenticate-operator-form';
import { AdminThemeToggle } from './admin-theme-toggle';
import { AdminTopbarButton } from './admin-topbar-button';
import { AdminTopbarSearchInput } from './admin-topbar-search-input';
import { AdminAttentionBadge } from './status-badge';

type AdminWorkspaceHeaderProps = {
  readonly navigationToggle?: ReactNode;
  readonly sections: readonly AdminNavSection[];
};

export function AdminWorkspaceHeader({ navigationToggle, sections }: AdminWorkspaceHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSearchResults, setShowAllSearchResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsListRef = useRef<HTMLDivElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const notificationContainerRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);
  const breadcrumb = adminBreadcrumbContext(sections, pathname, search);
  const searchResults = useMemo(
    () => adminNavSearchResults(sections, searchQuery, showAllSearchResults ? Number.MAX_SAFE_INTEGER : 7),
    [searchQuery, sections, showAllSearchResults],
  );
  const searchResultGroups = useMemo(
    () => showAllSearchResults
      ? groupAdminNavSearchResults(searchResults.results)
      : [{ entries: searchResults.results, sectionLabel: null }],
    [searchResults.results, showAllSearchResults],
  );
  const attentionSections = sections.filter((section) => (section.attentionCount ?? 0) > 0);
  const totalAttentionCount = attentionSections.reduce(
    (sum, section) => sum + (section.attentionCount ?? 0),
    0,
  );
  const hasOperationAlerts = attentionSections.length > 0;

  const closeSearch = useCallback((returnFocus = false) => {
    setSearchOpen(false);
    setSearchQuery('');
    setShowAllSearchResults(false);
    if (returnFocus) {
      window.setTimeout(() => searchTriggerRef.current?.focus(), 0);
    }
  }, [setSearchOpen, setSearchQuery, setShowAllSearchResults]);

  const closeNotifications = useCallback((returnFocus = false) => {
    setNotificationsOpen(false);
    if (returnFocus) {
      window.setTimeout(() => notificationTriggerRef.current?.focus(), 0);
    }
  }, [setNotificationsOpen]);

  const openSearch = useCallback(() => {
    closeNotifications();
    setSearchOpen(true);
    setShowAllSearchResults(false);
  }, [closeNotifications, setSearchOpen, setShowAllSearchResults]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (notificationsOpen && hasOperationAlerts) {
      notificationMenuRef.current?.querySelector<HTMLAnchorElement>('[role="menuitem"]')?.focus();
    }
  }, [hasOperationAlerts, notificationsOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (searchOpen) closeSearch(true);
        else openSearch();
        return;
      }

      if (event.key === 'Escape') {
        if (searchOpen) {
          event.preventDefault();
          closeSearch(true);
        } else if (notificationsOpen) {
          event.preventDefault();
          closeNotifications(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [closeNotifications, closeSearch, notificationsOpen, openSearch, searchOpen]);

  useEffect(() => {
    if (!searchOpen && !notificationsOpen) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (searchOpen && !searchContainerRef.current?.contains(target)) {
        closeSearch();
      }
      if (notificationsOpen && !notificationContainerRef.current?.contains(target)) {
        closeNotifications();
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [closeNotifications, closeSearch, notificationsOpen, searchOpen]);

  const handleSearchKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const links = Array.from(
      searchContainerRef.current?.querySelectorAll<HTMLAnchorElement>('.topbar-dropdown-link') ?? [],
    );
    if (event.key === 'Enter' && document.activeElement === searchInputRef.current && links[0]) {
      event.preventDefault();
      links[0].click();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (links.length === 0) return;
    event.preventDefault();
    const activeIndex = links.findIndex((link) => link === document.activeElement);
    const nextIndex = event.key === 'ArrowDown'
      ? activeIndex < 0 || activeIndex === links.length - 1 ? 0 : activeIndex + 1
      : activeIndex <= 0 ? links.length - 1 : activeIndex - 1;
    links[nextIndex]?.focus();
  };

  const handleShowAllSearchResults = () => {
    setShowAllSearchResults(true);
    window.requestAnimationFrame(() => {
      if (searchResultsListRef.current) searchResultsListRef.current.scrollTop = 0;
      searchInputRef.current?.focus();
    });
  };

  const handleNotificationKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const links = Array.from(
      notificationMenuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? [],
    );
    const activeIndex = links.findIndex((link) => link === document.activeElement);
    const targetIndex = operationAlertMenuTargetIndex(event.key, activeIndex, links.length);
    if (targetIndex === null) return;
    event.preventDefault();
    links[targetIndex]?.focus();
  };

  return (
    <header className="topbar vuexy-navbar" aria-label="Admin workspace">
      {navigationToggle ? <div className="topbar-mobile-nav-slot">{navigationToggle}</div> : null}
      <div className="workspace-heading">
        <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
          <Link href="/" prefetch={false}>HANDS</Link>
          {breadcrumb.sectionLabel && breadcrumb.sectionLabel !== breadcrumb.pageLabel ? (
            <>
              <ChevronRight aria-hidden="true" size={14} />
              <span>{breadcrumb.sectionLabel}</span>
            </>
          ) : null}
          {breadcrumb.workspace ? (
            <>
              <ChevronRight aria-hidden="true" size={14} />
              <Link href={breadcrumb.workspace.href} prefetch={false}>{breadcrumb.workspace.label}</Link>
            </>
          ) : null}
          <ChevronRight aria-hidden="true" size={14} />
          <span aria-current="page">{breadcrumb.pageLabel}</span>
        </nav>
      </div>

      <div className="topbar-actions" aria-label="Workspace actions">
        <div className="topbar-menu" ref={searchContainerRef}>
          <AdminTopbarButton
            aria-controls="admin-page-search"
            aria-expanded={searchOpen}
            className="topbar-search topbar-search-trigger"
            onClick={() => {
              if (searchOpen) closeSearch(true);
              else openSearch();
            }}
            ref={searchTriggerRef}
            type="button"
          >
            <span>
              <Search aria-hidden="true" size={16} />
              Search
            </span>
            <kbd>Ctrl K</kbd>
          </AdminTopbarButton>
          {searchOpen ? (
            <div
              aria-label="Search admin pages"
              className="topbar-dropdown topbar-search-menu"
              id="admin-page-search"
              onKeyDown={handleSearchKeyboard}
              role="search"
            >
              <AdminTopbarSearchInput
                autoFocus
                inputRef={searchInputRef}
                label="Search admin pages"
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setShowAllSearchResults(false);
                  if (searchResultsListRef.current) searchResultsListRef.current.scrollTop = 0;
                }}
                value={searchQuery}
              />
              <div className="topbar-dropdown-list" ref={searchResultsListRef}>
                {searchResults.results.length > 0 ? (
                  searchResultGroups.map((group) => (
                    <div className="topbar-search-result-group" key={group.sectionLabel ?? 'recommended'}>
                      {group.sectionLabel ? (
                        <strong className="topbar-search-result-group-label">{group.sectionLabel}</strong>
                      ) : null}
                      {group.entries.map((link) => (
                        <Link
                          className="topbar-dropdown-link"
                          href={link.href}
                          key={link.id}
                          prefetch={false}
                          onClick={() => closeSearch()}
                        >
                          <span className="topbar-dropdown-label">{link.label}</span>
                          <span className="topbar-dropdown-meta">
                            {link.workspaceLabel ?? link.sectionLabel}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ))
                ) : (
                  <AdminEmptyState className="topbar-empty" message="No matching admin pages" title={null} />
                )}
                {searchResults.total > searchResults.results.length ? (
                  <AdminTopbarButton
                    className="topbar-search-show-all"
                    onClick={handleShowAllSearchResults}
                    type="button"
                  >
                    Show all results ({searchResults.total})
                  </AdminTopbarButton>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <AdminThemeToggle />
        <AdminIconLink
          aria-label="Operations Policy"
          className="topbar-icon-chip"
          href="/operations-policy"
          title="Operations Policy"
        >
          <ShieldCheck aria-hidden="true" size={18} />
        </AdminIconLink>
        <div className="topbar-menu" ref={notificationContainerRef}>
          <AdminIconButton
            aria-controls="admin-operation-alerts"
            aria-label={`Operation alerts, ${totalAttentionCount}`}
            aria-expanded={notificationsOpen}
            aria-haspopup={hasOperationAlerts ? 'menu' : undefined}
            className="topbar-icon-chip topbar-icon-button"
            onClick={() => {
              closeSearch();
              if (notificationsOpen) closeNotifications();
              else setNotificationsOpen(true);
            }}
            ref={notificationTriggerRef}
            type="button"
          >
            <Bell aria-hidden="true" size={18} />
            {totalAttentionCount > 0 ? <AdminAttentionBadge>{totalAttentionCount}</AdminAttentionBadge> : null}
          </AdminIconButton>
          {notificationsOpen ? (
            <div
              aria-label="Operation alerts"
              className="topbar-dropdown topbar-notification-menu"
              id="admin-operation-alerts"
              onKeyDown={hasOperationAlerts ? handleNotificationKeyboard : undefined}
              ref={notificationMenuRef}
              role={hasOperationAlerts ? 'menu' : 'status'}
            >
              <div className="topbar-dropdown-title">Operation alerts</div>
              {hasOperationAlerts ? (
                <div className="topbar-dropdown-list">
                  {attentionSections.map((section, sectionIndex) => (
                    <Link
                      className="topbar-dropdown-link"
                      href={section.href ?? section.links[0]?.href ?? '/'}
                      key={`${section.id}:${sectionIndex}`}
                      prefetch={false}
                      onClick={() => closeNotifications()}
                      role="menuitem"
                    >
                      <span className="topbar-dropdown-label">{section.label}</span>
                      <span className="topbar-dropdown-meta">{section.attentionCount} need review</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="topbar-notification-empty">No operation alerts</p>
              )}
            </div>
            ) : null}
        </div>
        <details className="topbar-menu topbar-reauth-menu" id="admin-reauthentication-menu">
          <summary
            aria-label="Confirm identity for high-risk changes"
            className="topbar-icon-chip"
            title="Confirm identity for high-risk changes"
          >
            <KeyRound aria-hidden="true" size={18} />
          </summary>
          <div className="topbar-dropdown topbar-reauth-panel" id="admin-reauthentication-panel">
            <AdminReauthenticateOperatorForm />
          </div>
        </details>
        <AdminFormShell action="/api/admin/session/logout" method="post">
          <AdminIconButton
            className="topbar-icon-chip topbar-icon-button"
            aria-label="Sign out"
            title="Sign out"
            type="submit"
          >
            <LogOut aria-hidden="true" size={18} />
          </AdminIconButton>
        </AdminFormShell>
      </div>
    </header>
  );
}

export function operationAlertMenuTargetIndex(
  key: string,
  activeIndex: number,
  itemCount: number,
) {
  if (itemCount <= 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  if (key === 'ArrowDown') return activeIndex < 0 || activeIndex === itemCount - 1 ? 0 : activeIndex + 1;
  if (key === 'ArrowUp') return activeIndex <= 0 ? itemCount - 1 : activeIndex - 1;
  return null;
}
