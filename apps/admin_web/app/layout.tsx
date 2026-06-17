import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';
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
import { adminNavSections } from '../lib/admin-navigation';

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

function navIcon(label: string) {
  return iconByLabel[label as keyof typeof iconByLabel] ?? Activity;
}

function NavIcon({ label, size = 16 }: { readonly label: string; readonly size?: number }) {
  const Icon = navIcon(label);

  return <Icon aria-hidden="true" size={size} strokeWidth={2.1} />;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand-block">
              <span className="brand-mark" aria-hidden="true">
                <Sparkles size={18} strokeWidth={2.4} />
              </span>
              <div>
                <strong>HANDS Admin</strong>
                <span>Operations Command Center</span>
              </div>
            </div>
            <nav className="nav">
              {adminNavSections.map((section) => (
                <section className="nav-section" key={section.label}>
                  <span className="nav-section-label">{section.label}</span>
                  {section.links.map((link) => (
                    <Link className="nav-link" key={link.href} href={link.href} title={link.description}>
                      <NavIcon label={link.label} />
                      {link.label}
                    </Link>
                  ))}
                </section>
              ))}
            </nav>
          </aside>
          <main className="content">
            <header className="topbar" aria-label="Admin workspace">
              <div>
                <span className="topbar-eyebrow">HANDS VN MVP</span>
                <strong>Operations Command Center</strong>
              </div>
              <div className="topbar-actions" aria-label="Workspace status">
                <span className="topbar-chip">
                  <MapPinned aria-hidden="true" size={14} />
                  Vietnam Operations
                </span>
                <span className="topbar-chip topbar-chip-primary">
                  <ShieldCheck aria-hidden="true" size={14} />
                  Live Workspace
                </span>
              </div>
            </header>
            <div className="content-inner">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
