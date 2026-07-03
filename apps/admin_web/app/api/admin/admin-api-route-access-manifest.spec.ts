import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const adminApiRouteAllowlist: Record<string, string> = {
  'geoapify-tiles/[z]/[x]/[y]/route.ts':
    'Retired tile proxy returns a static 410 response and does not reach upstream services or admin data.',
  'session/login/route.ts': 'Login establishes the Admin Web session and cannot require an existing session.',
  'session/logout/route.ts': 'Logout clears session state and uses its own cookie boundary.',
  'session/me/route.ts': 'Session introspection uses its own session parsing response contract.',
};

describe('Admin Web browser-facing admin API route access manifest', () => {
  it('keeps non-session /api/admin routes behind an Admin Web session check or an explicit allowlist', () => {
    const routeFiles = collectRouteFiles(path.join(process.cwd(), 'app', 'api', 'admin'));
    const unprotectedRoutes = routeFiles
      .map((file) => ({
        file,
        route: normalizeRoutePath(file),
        source: readFileSync(file, 'utf8'),
      }))
      .filter(({ route, source }) => !source.includes('requireAdminWebAccess') && !adminApiRouteAllowlist[route])
      .map(({ route }) => route)
      .sort();

    expect(routeFiles.map(normalizeRoutePath)).toContain('bookings/[id]/chat-messages/route.ts');
    expect(routeFiles.map(normalizeRoutePath)).toContain('maptiler-tiles/[z]/[x]/[y]/route.ts');
    expect(adminApiRouteAllowlist['geoapify-tiles/[z]/[x]/[y]/route.ts']).toContain('static 410');
    expect(unprotectedRoutes).toEqual([]);
  });
});

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return collectRouteFiles(entryPath);
    }

    return entry === 'route.ts' ? [entryPath] : [];
  });
}

function normalizeRoutePath(filePath: string) {
  return path
    .relative(path.join(process.cwd(), 'app', 'api', 'admin'), filePath)
    .split(path.sep)
    .join('/');
}
