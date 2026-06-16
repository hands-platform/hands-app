import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { adminNavSections, adminShiftFlow } from '../lib/admin-navigation';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand-block">
              <span className="brand-mark" aria-hidden="true">
                H
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
                    <span>{index + 1}</span>
                    <strong>{item.label}</strong>
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
                    <Link key={link.href} href={link.href} title={link.description}>
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
                <span className="topbar-chip">Vietnam Operations</span>
                <span className="topbar-chip topbar-chip-primary">Live Workspace</span>
              </div>
            </header>
            <div className="content-inner">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
