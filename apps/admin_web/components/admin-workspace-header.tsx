'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  LogOut,
  MapPinned,
  Search,
  ShieldCheck,
} from 'lucide-react';

import type { AdminNavSection } from '../lib/admin-navigation';
import { hrefMatchesPath } from '../lib/admin-nav-match';
import { AdminEmptyState } from './admin-empty-state';
import { AdminFormShell } from './admin-form-controls';
import { AdminThemeToggle } from './admin-theme-toggle';
import { AdminTopbarSearchInput } from './admin-topbar-search-input';
import { AdminAttentionBadge } from './status-badge';

type AdminWorkspaceHeaderProps = {
  readonly sections: readonly AdminNavSection[];
};

function titleFromPath(pathname: string) {
  const segment = pathname
    .split('/')
    .filter(Boolean)
    .at(-1);

  if (!segment) {
    return 'Start Shift';
  }

  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AdminWorkspaceHeader({ sections }: AdminWorkspaceHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeSection = sections.find((section) =>
    section.links.some((link) => hrefMatchesPath(link.href, pathname, search)),
  );
  const activeLink = activeSection?.links.find((link) => hrefMatchesPath(link.href, pathname, search));
  const pageTitle = activeLink?.label ?? titleFromPath(pathname);
  const searchableLinks = useMemo(
    () =>
      sections.flatMap((section) =>
        section.links.map((link) => ({
          ...link,
          sectionLabel: section.label,
        })),
      ),
    [sections],
  );
  const filteredLinks = searchableLinks
    .filter((link) => {
      const query = searchQuery.trim().toLowerCase();

      if (!query) {
        return true;
      }

      return [link.label, link.sectionLabel, link.description].some((value) =>
        value.toLowerCase().includes(query),
      );
    })
    .slice(0, 7);
  const attentionSections = sections.filter((section) => (section.attentionCount ?? 0) > 0);
  const totalAttentionCount = attentionSections.reduce(
    (sum, section) => sum + (section.attentionCount ?? 0),
    0,
  );

  return (
    <header className="topbar vuexy-navbar" aria-label="Admin workspace">
      <div className="workspace-heading">
        <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">HANDS</Link>
          {activeSection ? (
            <>
              <ChevronRight aria-hidden="true" size={14} />
              <span>{activeSection.label}</span>
            </>
          ) : null}
          <ChevronRight aria-hidden="true" size={14} />
          <span aria-current="page">{pageTitle}</span>
        </nav>
        <strong className="workspace-page-title">{pageTitle}</strong>
      </div>

      <div className="topbar-actions" aria-label="Workspace actions">
        <div className="topbar-menu">
          <button
            aria-expanded={searchOpen}
            aria-haspopup="dialog"
            className="topbar-search topbar-search-trigger"
            onClick={() => {
              setSearchOpen((value) => !value);
              setNotificationsOpen(false);
            }}
            type="button"
          >
            <span>
              <Search aria-hidden="true" size={16} />
              Search
            </span>
            <kbd>Ctrl K</kbd>
          </button>
          {searchOpen ? (
            <div className="topbar-dropdown topbar-search-menu" role="dialog" aria-label="Search admin pages">
              <AdminTopbarSearchInput
                autoFocus
                label="Search admin pages"
                onChange={(event) => setSearchQuery(event.target.value)}
                value={searchQuery}
              />
              <div className="topbar-dropdown-list">
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((link) => (
                    <Link
                      className="topbar-dropdown-link"
                      href={link.href}
                      key={`${link.sectionLabel}:${link.href}`}
                      onClick={() => setSearchOpen(false)}
                    >
                      <span className="topbar-dropdown-label">{link.label}</span>
                      <span className="topbar-dropdown-meta">{link.sectionLabel}</span>
                    </Link>
                  ))
                ) : (
                  <AdminEmptyState className="topbar-empty" message="No matching admin pages" title={null} />
                )}
              </div>
            </div>
          ) : null}
        </div>
        <AdminThemeToggle />
        <Link className="topbar-icon-chip" aria-label="Help" href="/operations-policy">
          <CircleHelp aria-hidden="true" size={18} />
        </Link>
        <div className="topbar-menu">
          <button
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            className="topbar-icon-chip topbar-icon-button"
            onClick={() => {
              setNotificationsOpen((value) => !value);
              setSearchOpen(false);
            }}
            type="button"
          >
            <Bell aria-hidden="true" size={18} />
            {totalAttentionCount > 0 ? <AdminAttentionBadge>{totalAttentionCount}</AdminAttentionBadge> : null}
          </button>
          {notificationsOpen ? (
            <div className="topbar-dropdown topbar-notification-menu" role="dialog" aria-label="Operation alerts">
              <div className="topbar-dropdown-title">Operation alerts</div>
              <div className="topbar-dropdown-list">
                {attentionSections.length > 0 ? (
                  attentionSections.map((section) => (
                    <Link
                      className="topbar-dropdown-link"
                      href={section.links[0]?.href ?? '/'}
                      key={section.label}
                      onClick={() => setNotificationsOpen(false)}
                    >
                      <span className="topbar-dropdown-label">{section.label}</span>
                      <span className="topbar-dropdown-meta">{section.attentionCount} need review</span>
                    </Link>
                  ))
                ) : (
                  <AdminEmptyState className="topbar-empty" message="No operation alerts" title={null} />
                )}
              </div>
            </div>
          ) : null}
        </div>
        <span className="topbar-chip">
          <MapPinned aria-hidden="true" size={14} />
          Vietnam Operations
        </span>
        <span className="topbar-chip topbar-chip-primary">
          <ShieldCheck aria-hidden="true" size={14} />
          Live Workspace
        </span>
        <AdminFormShell action="/api/admin/session/logout" method="post">
          <button className="topbar-icon-chip topbar-icon-button" aria-label="Sign out" title="Sign out" type="submit">
            <LogOut aria-hidden="true" size={18} />
          </button>
        </AdminFormShell>
      </div>
    </header>
  );
}
