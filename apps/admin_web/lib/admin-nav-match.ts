export function hrefMatchesPath(href: string, pathname: string, search: string) {
  const [hrefPath, hrefQuery] = href.split('?');

  if (hrefPath === '/') {
    return pathname === '/';
  }

  if (hrefQuery) {
    return pathname === hrefPath && new URLSearchParams(search).toString() === hrefQuery;
  }

  if (pathname === hrefPath || pathname.startsWith(`${hrefPath}/`)) {
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

function isBookingDetailPath(pathname: string) {
  const bookingSubpath = pathname.slice('/bookings/'.length);

  if (!bookingSubpath || bookingSubpath.includes('/')) {
    return false;
  }

  return !new Set(['completed', 'post-match-cancellations']).has(bookingSubpath);
}
