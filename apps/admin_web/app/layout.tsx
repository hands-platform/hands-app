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
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  FileText,
  HandCoins,
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
  Store,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { adminNavSections, adminShiftFlow } from '../lib/admin-navigation';

const iconByLabel = {
  '10km Marketplace': MapPinned,
  'All Bookings': CalendarClock,
  'App Presence': Activity,
  'Attention Queue': BellRing,
  'Audit Log': FileClock,
  'Cash Debt': WalletCards,
  'Cash Settlements': HandCoins,
  'Chat Archive': MessageSquareText,
  'Chat Repair': MessageSquareText,
  'Command Dashboard': Sparkles,
  'Coupons': ReceiptText,
  'Customer Chat Evidence': MessageSquareText,
  'Customer Choice': UserRoundCheck,
  'Customer List': UsersRound,
  'Direct Request Held': ShieldCheck,
  Earnings: CircleDollarSign,
  Feedback: LifeBuoy,
  'Failed Alerts': BellRing,
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
  'Shift Handoff': FileClock,
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
            <section className="nav-flow" aria-label="Shift flow">
              <span className="nav-section-label">Shift Flow</span>
              <div className="nav-flow-list">
                {adminShiftFlow.map((item, index) => (
                  <Link className="nav-flow-link" href={item.href} key={item.href} title={item.description}>
                    <span aria-hidden="true">
                      <NavIcon label={item.label} size={15} />
                    </span>
                    <strong>
                      <small>{String(index + 1).padStart(2, '0')}</small>
                      {item.label}
                    </strong>
                  </Link>
                ))}
              </div>
            </section>
            <nav className="nav">
              {adminNavSections.map((section) => (
                <section className="nav-section" key={section.label}>
                  <span className="nav-section-label">{section.label}</span>
                  <p className="nav-section-description">{section.description}</p>
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
