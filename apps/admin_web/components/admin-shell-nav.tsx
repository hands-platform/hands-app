'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { createElement } from 'react';
import {
  Activity,
  Banknote,
  BellRing,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileClock,
  FileText,
  FolderKanban,
  HandCoins,
  HeartHandshake,
  Landmark,
  LifeBuoy,
  ListChecks,
  MapPinned,
  MessageSquareText,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Send,
  Settings2,
  ShieldAlert,
  Sparkles,
  Star,
  UserCheck,
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
  'Cash Debt': HandCoins,
  Completed: ClipboardCheck,
  Calendar: CalendarDays,
  Coupons: ReceiptText,
  'Customer Referrals': UserCheck,
  Customers: UsersRound,
  Earnings: CircleDollarSign,
  Feedback: LifeBuoy,
  'Customer Reviews': Star,
  Files: FileText,
  'Finance Closeout': BookOpenCheck,
  Handoff: FileClock,
  Notifications: BellRing,
  'Operations Policy': Settings2,
  'Marketing Analytics': ChartNoAxesCombined,
  Partners: HeartHandshake,
  'Partner Referrals': HeartHandshake,
  'Partner Evaluations': MessageSquareText,
  'Admin Operators': UserRoundCog,
  Payments: CreditCard,
  Payouts: Banknote,
  'Post-match Cancellations': RefreshCw,
  Refunds: RefreshCw,
  'Service Catalog': PackageCheck,
  Setup: ListChecks,
  'Start Shift': Sparkles,
  'Tax Policy': Landmark,
  'Tax Overview': Landmark,
  'Partner Withholding Tax': ReceiptText,
  'Booking Settlement Audit': BookOpenCheck,
  'Settlement Reversals': RefreshCw,
  'General Ledger': BookOpenCheck,
  'Payment Clearing': CreditCard,
  'Bank Reconciliation': Landmark,
  'Monthly Tax Closing': ClipboardCheck,
  'Platform VAT': ReceiptText,
  'Payment Fees': CreditCard,
  'Referral Cashouts': HandCoins,
  'Wallet Adjustments': WalletCards,
  'Notification Templates': FileText,
  'Push Send': Send,
  'Unapproved Partners': ShieldAlert,
  'Unsettled Partners': WalletCards,
  'Usage Overview': ChartNoAxesCombined,
  'Vietnam Overview': MapPinned,
} as const;

type AdminShellNavProps = {
  readonly onNavigate?: () => void;
  readonly sections: readonly AdminNavSection[];
};

const sectionIconByLabel = {
  Analytics: ChartNoAxesCombined,
  Bookings: CalendarClock,
  'Admin Control': UserRoundCog,
  'Command Center': FolderKanban,
  Communications: BellRing,
  Finance: Landmark,
  Partners: HeartHandshake,
  'Policies & Setup': Settings2,
  'Tax & Accounting': ReceiptText,
  Users: UsersRound,
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

export function AdminShellNav({ onNavigate, sections }: AdminShellNavProps) {
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
            key={`${section.label}-${index}`}
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
              {section.links.map((link, linkIndex) => {
                const active = hrefMatchesPath(link.href, pathname, search);

                return (
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className="nav-link"
                    data-active={active ? 'true' : undefined}
                    href={link.href}
                    key={`${link.href}-${linkIndex}`}
                    onClick={onNavigate}
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
