import { readFileSync } from 'node:fs';

describe('Admin Web performance boundaries', () => {
  it('keeps date-picker code out of the shared layout and authentication entry points', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    const login = readFileSync('app/login/page.tsx', 'utf8');
    const header = readFileSync('components/admin-workspace-header.tsx', 'utf8');

    expect(layout).not.toContain('react-datepicker');
    expect(login).not.toContain('admin-form-controls');
    expect(header).not.toContain('admin-form-controls');
    expect(header).not.toContain('operator-access-forms');
  });

  it('short-circuits the login route before loading operator access and the client Admin shell', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    const loginBranch = layout.slice(
      layout.indexOf("requestPathname === '/login'"),
      layout.indexOf('const operatorAccessResult'),
    );

    expect(loginBranch).toContain('className="auth-shell"');
    expect(loginBranch).not.toContain('AdminRootShell');
    expect(loginBranch).not.toContain('getCurrentAdminOperatorAccessResult');
    expect(layout).not.toContain("import './globals.css';");
    expect(layout).not.toContain("import { AdminRootShell } from '../components/admin-root-shell';");
    const adminShell = readFileSync('components/admin-root-shell.tsx', 'utf8');
    const adminShellLoader = readFileSync('components/admin-root-shell-loader.tsx', 'utf8');
    expect(adminShell).toContain("import '../app/globals.css';");
    expect(adminShellLoader).toContain("dynamic(() => import('./admin-root-shell')");
  });

  it('loads chart implementations through viewport-deferred client boundaries', () => {
    const dashboard = readFileSync('app/page.tsx', 'utf8');
    const marketing = readFileSync('app/marketing-analytics/page.tsx', 'utf8');
    const usage = readFileSync('app/usage-overview/page.tsx', 'utf8');

    expect(dashboard).toContain('StartShiftChartWidgetsDeferred');
    expect(dashboard).not.toContain("from '../components/start-shift-chart-widgets'");
    expect(marketing).toContain('MarketingAnalyticsTrendChartDeferred');
    expect(usage).toContain('UsageOverviewTrendChartDeferred');
  });
});
