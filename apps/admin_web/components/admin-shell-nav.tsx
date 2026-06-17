'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Activity,
  BadgeCheck,
  BellRing,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  FileText,
  HeartHandshake,
  LifeBuoy,
  ListChecks,
  MapPinned,
  MessageSquareText,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';

import type { AdminNavSection } from '../lib/admin-navigation';
import { hrefMatchesPath } from '../lib/admin-nav-match';

const iconByLabel = {
  'All Bookings': CalendarClock,
  Calendar: CalendarDays,
  'App Presence': Activity,
  'Audit Log': FileClock,
  'Cash Debt': WalletCards,
  'Chat Archive': MessageSquareText,
  'Chat Repair': MessageSquareText,
  Coupons: ReceiptText,
  'Customer Choice': UserRoundCheck,
  'Customer List': UsersRound,
  'Direct Request Held': ShieldCheck,
  Earnings: CircleDollarSign,
  Feedback: LifeBuoy,
  'Customer Reviews': Star,
  Files: FileText,
  'Finance Closeout': ClipboardCheck,
  Handoff: FileClock,
  'KYC Review': BadgeCheck,
  'Live Customers': Activity,
  'Live Matching': RefreshCw,
  Marketplace: Store,
  'Marketplace Ready': Store,
  Notifications: BellRing,
  'No-show Evidence': BookOpenCheck,
  'Operations Policy': Settings2,
  'Partner Controls': BriefcaseBusiness,
  'Partner List': HeartHandshake,
  Payments: ReceiptText,
  Payouts: WalletCards,
  Refunds: RefreshCw,
  'Service Catalog': PackageCheck,
  Setup: ListChecks,
  'Start Shift': Sparkles,
  'Tax Policy': FileText,
  'Urgent Bookings': BellRing,
} as const;

type AdminShellNavProps = {
  readonly sections: readonly AdminNavSection[];
};

function navIcon(label: string) {
  return iconByLabel[label as keyof typeof iconByLabel] ?? Activity;
}

function NavIcon({ label }: { readonly label: string }) {
  const Icon = navIcon(label);

  return <Icon aria-hidden="true" size={18} strokeWidth={2} />;
}

export function AdminShellNav({ sections }: AdminShellNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <nav className="nav" aria-label="Admin navigation">
      {sections.map((section) => (
        <section className="nav-section" key={section.label}>
          <span className="nav-section-label">{section.label}</span>
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
        </section>
      ))}
    </nav>
  );
}
