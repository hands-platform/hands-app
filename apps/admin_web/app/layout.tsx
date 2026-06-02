import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

const navSections = [
  {
    label: 'Live Operations',
    links: [
      ['/', 'Command Dashboard'],
      ['/operations-handoff', 'Shift Handoff'],
      ['/bookings?view=attention', 'Attention Queue'],
      ['/bookings?view=matching', 'Live Matching'],
      ['/app-sessions', 'App Presence'],
      ['/notifications?review=failed', 'Failed Alerts'],
    ],
  },
  {
    label: 'Booking Operations',
    links: [
      ['/bookings', 'All Bookings'],
      ['/bookings?view=customer-choice', 'Customer Choice'],
      ['/bookings?view=marketplace', '10km Marketplace'],
      ['/bookings?view=chat-repair', 'Chat Repair'],
      ['/bookings?view=no-show', 'No-show Evidence'],
    ],
  },
  {
    label: 'People Operations',
    links: [
      ['/customers', 'Customers'],
      ['/partners', 'Partners'],
      ['/partners?review=kyc', 'KYC Review'],
      ['/partners?review=acceptance-blocked', 'Acceptance Blocked'],
      ['/partners?review=marketplace-ready', 'Marketplace Ready'],
      ['/partner-controls', 'Partner Controls'],
    ],
  },
  {
    label: 'Money Operations',
    links: [
      ['/finance-closeout', 'Finance Closeout'],
      ['/payments', 'Payments'],
      ['/earnings', 'Earnings'],
      ['/cash-settlements', 'Cash Settlements'],
      ['/payouts', 'Payouts'],
      ['/refunds', 'Refunds'],
    ],
  },
  {
    label: 'Policy and Setup',
    links: [
      ['/operations-policy', 'Operations Policy'],
      ['/services', 'Service Catalog'],
      ['/tax-policy', 'Tax Policy'],
      ['/setup', 'Setup'],
    ],
  },
  {
    label: 'Evidence and Audit',
    links: [
      ['/chat-archive', 'Chat Archive'],
      ['/notifications', 'Notifications'],
      ['/reviews', 'Reviews'],
      ['/coupons', 'Coupons'],
      ['/audit-log', 'Audit Log'],
    ],
  },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand-block">
              <strong>HANDS Admin</strong>
              <span>Operations Command Center</span>
            </div>
            <nav className="nav">
              {navSections.map((section) => (
                <section className="nav-section" key={section.label}>
                  <span className="nav-section-label">{section.label}</span>
                  {section.links.map(([href, label]) => (
                    <Link key={href} href={href}>
                      {label}
                    </Link>
                  ))}
                </section>
              ))}
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
