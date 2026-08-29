import {
  adminNavLinkDestinations,
  adminNavSearchEntries,
  adminNavSectionDestinations,
  adminWorkspaceNavigationGroups,
  type AdminNavSection,
} from './admin-navigation';

export function hrefMatchesPath(href: string, pathname: string, search: string) {
  const hrefUrl = new URL(href, 'http://admin.local');
  const hrefPath = hrefUrl.pathname;
  const hrefQuery = hrefUrl.searchParams.toString();
  const bookingDetailWorkspace = isBookingDetailPath(pathname)
    ? postMatchCancellationWorkspaceFromSearch(search)
    : null;

  if (hrefPath === '/') {
    return pathname === '/';
  }

  if (isPaymentMatchingPrimaryHref(hrefUrl)) {
    return isPaymentMatchingPath(pathname);
  }

  if (hrefPath === '/finance-tax/bank-reconciliation' && isBankReconciliationPath(pathname)) {
    return true;
  }

  if (hrefPath === '/finance-tax/payment-clearing' && isPaymentClearingPath(pathname)) {
    return true;
  }

  if (hrefQuery) {
    if (hrefPath === '/partners' && pathname === hrefPath) {
      return (
        primaryPartnerReview(new URLSearchParams(hrefQuery)) ===
        primaryPartnerReview(new URLSearchParams(search))
      );
    }
    if (hrefPath === '/partner-controls' && pathname === hrefPath) {
      return (
        primaryPartnerControlDetails(new URLSearchParams(hrefQuery)) ===
        primaryPartnerControlDetails(new URLSearchParams(search))
      );
    }
    return pathname === hrefPath && new URLSearchParams(search).toString() === hrefQuery;
  }

  if (bookingDetailWorkspace) {
    if (hrefPath === '/bookings/post-match-cancellations') return true;
    if (hrefPath === '/bookings') return false;
  }

  if (pathname === hrefPath) {
    if (hrefPath === '/partners') {
      return true;
    }

    return true;
  }

  if (pathname.startsWith(`${hrefPath}/`)) {
    if (hrefPath === '/finance-tax' || hrefPath === '/notifications') {
      return false;
    }
    if (hrefPath === '/partners' && pathname.startsWith('/partners/overview')) {
      return false;
    }
    if (hrefPath === '/bookings') {
      return pathname === '/bookings' || isBookingDetailPath(pathname);
    }
    if (hrefPath === '/bookings/completed' || hrefPath === '/bookings/post-match-cancellations') {
      return pathname === hrefPath;
    }
    if (hrefPath === '/reviews' || hrefPath === '/reviews/partner-customer-evaluations') {
      return pathname === hrefPath;
    }

    return !search || pathname !== hrefPath;
  }

  return false;
}

export function partnerWorkspaceModeLabel(search: string) {
  const review = primaryPartnerReview(new URLSearchParams(search));
  if (review === 'approval-pending') return 'Approvals';
  if (review === 'unapproved') return 'Onboarding Blockers';
  if (review === 'unsettled') return 'Wallet Debt';
  return null;
}

export function adminNavigationPrimaryMode(href: string) {
  const url = new URL(href, 'http://admin.local');
  if (url.pathname === '/partners') {
    return primaryPartnerReview(url.searchParams) || 'directory';
  }
  if (url.pathname === '/partner-controls') {
    return primaryPartnerControlDetails(url.searchParams);
  }
  return null;
}

export type PostMatchCancellationWorkspace = {
  href: string;
  label: 'Needs decision' | 'No-show review' | 'Resolved records';
};

export function postMatchCancellationWorkspaceFromHref(
  href: string | null | undefined,
): PostMatchCancellationWorkspace | null {
  if (!href || href.includes('\\') || !href.startsWith('/bookings/post-match-cancellations')) {
    return null;
  }
  const url = new URL(href, 'http://admin.local');
  if (url.pathname !== '/bookings/post-match-cancellations') return null;
  const view = url.searchParams.get('view');
  return {
    href,
    label:
      view === 'no-show'
        ? 'No-show review'
        : view === 'post-match-cancellations'
          ? 'Resolved records'
          : 'Needs decision',
  };
}

export function postMatchCancellationWorkspaceFromSearch(search: string) {
  return postMatchCancellationWorkspaceFromHref(new URLSearchParams(search).get('returnTo'));
}

function primaryPartnerReview(params: URLSearchParams) {
  const review = params.get('review') ?? '';
  return ['approval-pending', 'unapproved', 'unsettled'].includes(review) ? review : '';
}

function primaryPartnerControlDetails(params: URLSearchParams) {
  const details = params.get('details') ?? '';
  return ['controls', 'reports', 'sanctions'].includes(details) ? details : 'summary';
}

export function bestMatchingNavHref(hrefs: readonly string[], pathname: string, search: string) {
  const matchingHrefs = hrefs.filter((href) => hrefMatchesPath(href, pathname, search));

  if (matchingHrefs.length === 0) {
    return null;
  }

  return matchingHrefs.sort((left, right) => {
    const leftHasQuery = left.includes('?');
    const rightHasQuery = right.includes('?');

    if (leftHasQuery !== rightHasQuery) {
      return leftHasQuery ? -1 : 1;
    }

    return right.split('?')[0].length - left.split('?')[0].length;
  })[0];
}

export type AdminBreadcrumbContext = {
  readonly pageLabel: string;
  readonly sectionLabel?: string;
  readonly workspace?: {
    readonly href: string;
    readonly label: string;
  };
};

export function adminBreadcrumbContext(
  sections: readonly AdminNavSection[],
  pathname: string,
  search: string,
): AdminBreadcrumbContext {
  const activeDestination = bestMatchingNavHref(
    sections.flatMap(adminNavSectionDestinations),
    pathname,
    search,
  );
  const activeSection = sections.find((section) =>
    activeDestination ? adminNavSectionDestinations(section).includes(activeDestination) : false,
  );
  const activeLink = activeSection?.links.find((link) =>
    activeDestination ? adminNavLinkDestinations(link).includes(activeDestination) : false,
  );
  const activeSearchEntry = adminNavSearchEntries(sections).find((entry) => entry.href === activeDestination);
  const activeQuerySpecificSearchEntry =
    activeSearchEntry && /[?#]/.test(activeSearchEntry.href) ? activeSearchEntry : undefined;
  const activeWorkspaceGroup = adminWorkspaceNavigationGroups.find((group) =>
    bestMatchingNavHref(
      group.links.map((link) => link.href),
      pathname,
      search,
    ),
  );
  const activeWorkspacePage = activeWorkspaceGroup?.links.find((link) =>
    hrefMatchesPath(link.href, pathname, search),
  );
  const activeLocalGroup = activeSection?.localGroups?.find((group) =>
    group.links.some((link) => link.href === activeDestination),
  );
  const partnerMode = pathname === '/partners' ? partnerWorkspaceModeLabel(search) : null;
  const cancellationMode = pathname.startsWith('/bookings/')
    ? postMatchCancellationWorkspaceFromSearch(search)?.label
    : null;
  const paymentMatchingPage = paymentMatchingPageLabel(pathname, search);
  const pageLabel =
    paymentMatchingPage ??
    cancellationMode ??
    partnerMode ??
    activeQuerySpecificSearchEntry?.label ??
    activeWorkspacePage?.label ??
    activeSearchEntry?.label ??
    activeLink?.label ??
    activeSection?.label ??
    titleFromAdminPath(pathname);
  const workspaceCandidate = activeWorkspaceGroup
    ? {
        href: activeWorkspaceGroup.links[0]?.href ?? activeDestination ?? '/',
        label: activeWorkspaceGroup.label,
      }
    : activeLocalGroup
      ? { href: activeLocalGroup.links[0]?.href ?? activeDestination ?? '/', label: activeLocalGroup.label }
      : activeLink
        ? { href: activeLink.href, label: activeLink.label }
        : undefined;
  const workspace =
    workspaceCandidate?.label !== pageLabel && workspaceCandidate?.label !== activeSection?.label
      ? workspaceCandidate
      : undefined;

  return {
    pageLabel,
    sectionLabel: activeSection?.label,
    workspace,
  };
}

function paymentMatchingPageLabel(pathname: string, search: string) {
  if (isBankReconciliationPath(pathname)) {
    const detailId = detailIdAfter(pathname, '/finance-tax/bank-reconciliation');
    if (detailId) return `Bank transaction ${shortRecordId(detailId)}`;
    const workspace = new URLSearchParams(search).get('workspace');
    if (workspace === 'imports') return 'Statement imports';
    if (workspace === 'manual') return 'Manual bank entry';
    return 'Bank transactions';
  }

  if (isPaymentClearingPath(pathname)) {
    const detailId = detailIdAfter(pathname, '/finance-tax/payment-clearing');
    if (detailId) return `Payment evidence ${shortRecordId(detailId)}`;
    const review = new URLSearchParams(search).get('review');
    if (review === 'partial') return 'Partial matches';
    if (review === 'cleared' || review === 'reversed' || review === 'terminal') {
      return 'Cleared & reversed history';
    }
    return 'Unmatched payment evidence';
  }

  return null;
}

function isPaymentMatchingPrimaryHref(url: URL) {
  return (
    url.pathname === '/finance-tax/bank-reconciliation' && url.searchParams.get('workspace') === 'operations'
  );
}

function isPaymentMatchingPath(pathname: string) {
  return isBankReconciliationPath(pathname) || isPaymentClearingPath(pathname);
}

function isBankReconciliationPath(pathname: string) {
  return (
    pathname === '/finance-tax/bank-reconciliation' ||
    pathname.startsWith('/finance-tax/bank-reconciliation/')
  );
}

function isPaymentClearingPath(pathname: string) {
  return (
    pathname === '/finance-tax/payment-clearing' || pathname.startsWith('/finance-tax/payment-clearing/')
  );
}

function detailIdAfter(pathname: string, basePath: string) {
  if (!pathname.startsWith(`${basePath}/`)) return null;
  const detailId = pathname.slice(basePath.length + 1).split('/')[0];
  return detailId ? decodeURIComponent(detailId) : null;
}

function shortRecordId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function titleFromAdminPath(pathname: string) {
  const segment = pathname.split('/').filter(Boolean).at(-1);
  if (!segment) return 'Start Shift';
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isBookingDetailPath(pathname: string) {
  const bookingSubpath = pathname.slice('/bookings/'.length);

  if (!bookingSubpath || bookingSubpath.includes('/')) {
    return false;
  }

  return !new Set(['completed', 'post-match-cancellations']).has(bookingSubpath);
}
