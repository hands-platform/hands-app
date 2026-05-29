import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

const navSections = [
  {
    label: 'Command',
    links: [
      ['/', 'Operations Dashboard'],
      ['/bookings', 'Booking Monitor'],
      ['/operations-policy', 'Operations Policy'],
    ],
  },
  {
    label: 'Customers',
    links: [
      ['/customers', 'Customer List'],
      ['/reviews', 'Reviews'],
      ['/coupons', 'Coupons'],
      ['/notifications', 'Notifications'],
    ],
  },
  {
    label: 'Partners',
    links: [
      ['/partners', 'Partner List'],
      ['/partner-controls', 'Partner Controls'],
      ['/partner-risk', 'Partner Activity Checks'],
      ['/app-sessions', 'App Sessions'],
    ],
  },
  {
    label: 'Finance',
    links: [
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
