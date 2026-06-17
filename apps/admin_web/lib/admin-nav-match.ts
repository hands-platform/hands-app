export function hrefMatchesPath(href: string, pathname: string, search: string) {
  const [hrefPath, hrefQuery] = href.split('?');

  if (hrefPath === '/') {
    return pathname === '/';
  }

  if (hrefQuery) {
    return pathname === hrefPath && new URLSearchParams(search).toString() === hrefQuery;
  }

  if (pathname === hrefPath || pathname.startsWith(`${hrefPath}/`)) {
    return !search || pathname !== hrefPath;
  }

  return false;
}
