import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

const navSections = [
  {
    label: 'Command',
    links: [
      ['/', 'Operations Dashboard'],
      ['/operations-handoff', 'Operations Handoff'],
      ['/bookings', 'Booking Monitor'],
      ['/bookings?view=matching', 'Matching Queue'],
      ['/bookings?view=customer-choice', 'Customer Choice'],
      ['/bookings?view=chat-repair', 'Chat Repair'],
      ['/operations-policy', 'Operations Policy'],
    ],
  },
  {
    label: 'Customers',
    links: [
      ['/customers', 'Customer List'],
      ['/chat-archive', 'Chat Archive'],
      ['/reviews', 'Reviews'],
      ['/coupons', 'Coupons'],
      ['/notifications', 'Notifications'],
      ['/notifications?review=failed', 'Failed Notifications'],
    ],
  },
  {
    label: 'Partners',
    links: [
      ['/partners', 'Partner List'],
      ['/partners?review=kyc', 'KYC Review'],
      ['/partners?review=acceptance-blocked', 'Acceptance Blocked'],
      ['/partners?review=marketplace-ready', 'Marketplace Ready'],
      ['/partner-controls', 'Partner Controls'],
      ['/app-sessions', 'App Sessions'],
    ],
  },
  {
    label: 'Finance',
    links: [
      ['/finance-closeout', 'Finance Closeout'],
      ['/payments', 'Payments'],
      ['/refunds', 'Refunds'],
      ['/earnings', 'Earnings'],
      ['/cash-settlements', 'Cash Settlements'],
      ['/payouts', 'Payouts'],
      ['/tax-policy', 'Tax Policy'],
    ],
  },
  {
    label: 'Catalog and System',
    links: [
      ['/services', 'Service Catalog'],
      ['/audit-log', 'Audit Log'],
      ['/setup', 'Setup'],
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
              <span>Vietnam operations console</span>
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
