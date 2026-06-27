'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { createElement } from 'react';
import {
  Activity,
  BadgeCheck,
  BellRing,
  CalendarClock,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  FileText,
  FolderKanban,
  HeartHandshake,
  LifeBuoy,
  ListChecks,
  MapPinned,
  MessageSquareText,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Settings2,
  Sparkles,
  Star,
  UserRoundCog,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

import type { AdminNavSection } from '../lib/admin-navigation';
import { hrefMatchesPath } from '../lib/admin-nav-match';

const iconByLabel = {
  'All Bookings': CalendarClock,
  'App Presence': Activity,
  'Audit Log': FileClock,
  'Cash Debt': WalletCards,
  Completed: ClipboardCheck,
  Calendar: CalendarDays,
  Coupons: ReceiptText,
  'Customer Referrals': UsersRound,
  Customers: UsersRound,
  Earnings: CircleDollarSign,
  Feedback: LifeBuoy,
  'Customer Reviews': Star,
  Files: FileText,
  'Finance Closeout': ClipboardCheck,
  Handoff: FileClock,
  Notifications: BellRing,
  'Operations Policy': Settings2,
  'Marketing Analytics': ChartNoAxesCombined,
  Partners: HeartHandshake,
  'Partner Referrals': HeartHandshake,
  'Partner Evaluations': MessageSquareText,
  Payments: ReceiptText,
  Payouts: WalletCards,
  'Post-match Cancellations': RefreshCw,
  Refunds: RefreshCw,
  'Service Catalog': PackageCheck,
  Setup: ListChecks,
  'Start Shift': Sparkles,
  'Tax Policy': FileText,
  'Unapproved Partners': BadgeCheck,
  'Unsettled Partners': WalletCards,
  'Usage Overview': ChartNoAxesCombined,
  'Vietnam Overview': MapPinned,
} as const;

type AdminShellNavProps = {
  readonly sections: readonly AdminNavSection[];
};

const sectionIconByLabel = {
  Bookings: CalendarClock,
  Command: FolderKanban,
  Customers: UsersRound,
  Finance: CircleDollarSign,
  Partners: HeartHandshake,
  System: Settings2,
} as const;

function navIcon(label: string): LucideIcon {
  return iconByLabel[label as keyof typeof iconByLabel] ?? Activity;
}

function sectionIcon(label: string): LucideIcon {
  return sectionIconByLabel[label as keyof typeof sectionIconByLabel] ?? UserRoundCog;
}

function NavIcon({ label }: { readonly label: string }) {
  const Icon = navIcon(label);

  return createElement(Icon, { 'aria-hidden': true, size: 18, strokeWidth: 2 });
}

function SectionIcon({ label }: { readonly label: string }) {
  const Icon = sectionIcon(label);

  return createElement(Icon, { 'aria-hidden': true, size: 18, strokeWidth: 2 });
}

export function AdminShellNav({ sections }: AdminShellNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <nav className="nav" aria-label="Admin navigation">
      {sections.map((section, index) => {
        const sectionActive = section.links.some((link) => hrefMatchesPath(link.href, pathname, search));
        const openByDefault = sectionActive || index === 0;
        const attentionCount = section.attentionCount ?? 0;

        return (
          <details
            className="nav-section"
            data-active={sectionActive ? 'true' : undefined}
            key={section.label}
            open={openByDefault}
          >
            <summary className="nav-section-summary" title={section.description}>
              <span className="nav-section-icon">
                <SectionIcon label={section.label} />
              </span>
              <span className="nav-section-label">{section.label}</span>
              <span className="nav-section-count-slot">
                {attentionCount > 0 ? (
                  <span className="nav-section-count" aria-label={`${attentionCount} items need review`}>
                    {attentionCount}
                  </span>
                ) : null}
              </span>
              <ChevronRight aria-hidden="true" className="nav-section-chevron" size={16} strokeWidth={2.25} />
            </summary>
            <div className="nav-submenu">
              {section.links.map((link) => {
                const active = hrefMatchesPath(link.href, pathname, search);

                return (
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className="nav-link"
                    data-active={active ? 'true' : undefined}
                    href={link.href}
                    key={link.href}
                    title={link.description}
                  >
                    <NavIcon label={link.label} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
