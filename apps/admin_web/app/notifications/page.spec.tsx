import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('notifications page access wiring', () => {
  const source = readFileSync(join(process.cwd(), 'app/notifications/page.tsx'), 'utf8');

  it('gates FCM diagnostics behind Developer/System operator access', () => {
    expect(source).toContain('getCurrentAdminOperatorAccess');
    expect(source).toContain('canViewAdminDeveloperSystem');
    expect(source).toContain('filterNotificationActionConfirmationSupportingLinks');
    expect(source).toContain('const confirmation = filterNotificationActionConfirmationSupportingLinks(');
    expect(source).toContain('canViewDiagnostics={canViewDiagnostics}');
    expect(source).toContain("requestedDiagnosticsMode === 'full' && canViewDiagnostics");
    expect(source).not.toContain("const diagnosticsMode = readSearchParam(params.diagnostics) === 'full' ? 'full' : 'compact';");
  });
});
