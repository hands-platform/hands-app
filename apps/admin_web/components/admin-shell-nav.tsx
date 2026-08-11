'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { createElement, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Banknote,
  BellRing,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileClock,
  FileText,
  FolderKanban,
  HandCoins,
  HeartHandshake,
  Landmark,
  ListChecks,
  MapPinned,
  MessageSquareText,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Sparkles,
  UserCheck,
  UserRoundCog,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

import {
  adminNavLinkDestinations,
  adminNavSectionDestinations,
  type AdminNavIconKey,
  type AdminNavLink,
  type AdminNavSection,
} from '../lib/admin-navigation';
import { bestMatchingNavHref } from '../lib/admin-nav-match';

const iconByKey: Record<AdminNavIconKey, LucideIcon> = {
  activity: Activity,
  adjustments: ArrowLeftRight,
  approvals: ShieldAlert,
  audit: FileClock,
  bank: Landmark,
  bookings: CalendarClock,
  calendar: CalendarDays,
  cash: HandCoins,
  chat: MessageSquareText,
  closeout: ClipboardCheck,
  command: Sparkles,
  content: FileText,
  controls: UserRoundCog,
  coupons: ReceiptText,
  customers: UsersRound,
  finance: Banknote,
  growth: ChartNoAxesCombined,
  handoff: FolderKanban,
  ledger: BookOpenCheck,
  map: MapPinned,
  messaging: BellRing,
  partners: HeartHandshake,
  payments: CreditCard,
  policy: Settings2,
  referrals: UserCheck,
  refunds: RefreshCw,
  services: PackageCheck,
  settings: Settings2,
  system: ListChecks,
  tax: ReceiptText,
  wallet: WalletCards,
};

type AdminShellNavProps = {
  readonly onNavigate?: () => void;
  readonly sections: readonly AdminNavSection[];
};

function NavIcon({ iconKey }: { readonly iconKey: AdminNavIconKey }) {
  return createElement(iconByKey[iconKey], { 'aria-hidden': true, size: 18, strokeWidth: 2 });
}

export function AdminShellNav({ onNavigate, sections }: AdminShellNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const activeDestination = bestMatchingNavHref(
    sections.flatMap(adminNavSectionDestinations),
    pathname,
    search,
  );
  const activeSection = sections.find((section) =>
    activeDestination ? adminNavSectionDestinations(section).includes(activeDestination) : false,
  );
  const routeKey = `${pathname}?${search}`;
  const [manualOpenSection, setManualOpenSection] = useState<{
    readonly routeKey: string;
    readonly sectionId: string | null;
  } | null>(null);
  const routeDefaultSectionId = activeSection?.href
    ? null
    : activeSection?.id ?? sections.find((section) => !section.href)?.id ?? null;
  const openSectionId = manualOpenSection?.routeKey === routeKey
    ? manualOpenSection.sectionId
    : routeDefaultSectionId;

  return (
    <nav className="nav" aria-label="Admin navigation">
      {sections.map((section) => {
        const sectionActive = section.id === activeSection?.id;
        const attentionCount = section.attentionCount ?? 0;

        if (section.href) {
          return (
            <Link
              aria-current={sectionActive ? 'page' : undefined}
              className="nav-section-summary nav-direct-link"
              data-active={sectionActive ? 'true' : undefined}
              href={section.href}
              key={section.id}
              onClick={onNavigate}
              prefetch={false}
              title={section.description}
            >
              <span className="nav-section-icon"><NavIcon iconKey={section.iconKey} /></span>
              <span className="nav-section-label">{section.label}</span>
            </Link>
          );
        }

        return (
          <details
            className="nav-section"
            data-active={sectionActive ? 'true' : undefined}
            key={section.id}
            open={openSectionId === section.id}
          >
            <summary
              className="nav-section-summary"
              onClick={(event) => {
                event.preventDefault();
                setManualOpenSection({
                  routeKey,
                  sectionId: openSectionId === section.id ? null : section.id,
                });
              }}
              title={section.description}
            >
              <span className="nav-section-icon"><NavIcon iconKey={section.iconKey} /></span>
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
              {section.links.map((link) => (
                <SidebarLink
                  activeDestination={activeDestination}
                  key={link.id}
                  link={link}
                  onNavigate={onNavigate}
                />
              ))}
              {section.localGroups?.map((group) => {
                const groupActive = group.links.some((link) => link.href === activeDestination);
                const representativeHref = group.links[0]?.href;
                if (!representativeHref) return null;
                return (
                  <Link
                    aria-current={representativeHref === activeDestination ? 'page' : undefined}
                    className="nav-link nav-local-group-link"
                    data-active={groupActive ? 'true' : undefined}
                    href={representativeHref}
                    key={group.id}
                    onClick={onNavigate}
                    prefetch={false}
                    title={group.description}
                  >
                    <NavIcon iconKey={group.iconKey} />
                    <span>{group.label}</span>
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

function SidebarLink({
  activeDestination,
  link,
  onNavigate,
}: {
  readonly activeDestination: string | null;
  readonly link: AdminNavLink;
  readonly onNavigate?: () => void;
}) {
  const active = activeDestination ? adminNavLinkDestinations(link).includes(activeDestination) : false;
  return (
    <Link
      aria-current={link.href === activeDestination ? 'page' : undefined}
      className="nav-link"
      data-active={active ? 'true' : undefined}
      href={link.href}
      onClick={onNavigate}
      prefetch={false}
      title={link.description}
    >
      <NavIcon iconKey={link.iconKey} />
      <span>{link.label}</span>
    </Link>
  );
}
