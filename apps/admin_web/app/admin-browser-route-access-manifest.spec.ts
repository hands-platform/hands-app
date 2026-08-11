import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const adminHelperRouteAllowlist: Record<string, string> = {
  'api/admin/session/login/route.ts':
    'Login exchanges validated Admin Web credentials for a session and must be reachable before a session exists.',
};

const adminHelperPattern =
  /\b(?:adminGet|adminGetResult|adminPost|adminPatch|adminDelete|adminPostOrThrow|adminPatchOrThrow|adminDeleteWithBodyOrThrow|getAdminAccessToken)\b/;

describe('Admin Web browser route access manifest', () => {
  it('keeps browser-facing route handlers that use server admin helpers behind an Admin Web session check', () => {
    const routeFiles = collectRouteFiles(path.join(process.cwd(), 'app'));
    const helperRoutes = routeFiles
      .map((file) => ({
        file,
        route: normalizeRoutePath(file),
        source: readFileSync(file, 'utf8'),
      }))
      .filter(({ source }) => adminHelperPattern.test(source));

    const unprotectedRoutes = helperRoutes
      .filter(({ route, source }) => !source.includes('requireAdminWebAccess') && !adminHelperRouteAllowlist[route])
      .map(({ route }) => route)
      .sort();

    expect(helperRoutes.map(({ route }) => route)).toContain('files/[id]/open/route.ts');
    expect(helperRoutes.map(({ route }) => route)).toContain('reviews/export/route.ts');
    expect(adminHelperRouteAllowlist['api/admin/session/login/route.ts']).toContain('before a session exists');
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
  return path.relative(path.join(process.cwd(), 'app'), filePath).split(path.sep).join('/');
}
