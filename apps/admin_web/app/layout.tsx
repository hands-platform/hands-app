import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

const links = [
  ['/', 'Dashboard'],
  ['/providers', 'Partners'],
  ['/provider-risk', 'Partner Risk'],
  ['/bookings', 'Bookings'],
  ['/services', 'Services'],
  ['/payments', 'Payments'],
  ['/refunds', 'Refunds'],
  ['/earnings', 'Earnings'],
  ['/cash-settlements', 'Cash Settlements'],
  ['/payouts', 'Payouts'],
  ['/tax-policy', 'Tax Policy'],
  ['/reviews', 'Reviews'],
  ['/notifications', 'Notifications'],
  ['/coupons', 'Coupons'],
  ['/audit-log', 'Audit Log'],
  ['/setup', 'Setup'],
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <strong>HANDS Admin</strong>
            <nav className="nav">
              {links.map(([href, label]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
