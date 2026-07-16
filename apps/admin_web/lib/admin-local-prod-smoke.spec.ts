import { readFileSync } from 'node:fs';

describe('local production Admin smoke scripts', () => {
  it('exposes a production Admin Web start mode without replacing the dev start command', () => {
    const rootPackage = JSON.parse(readFileSync('../../package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const startScript = readFileSync('../../infra/scripts/start-hands-local.ps1', 'utf8');

    expect(rootPackage.scripts['local:start']).toBe(
      'powershell -ExecutionPolicy Bypass -File infra/scripts/start-hands-local.ps1',
    );
    expect(rootPackage.scripts['local:start:prod']).toBe(
      'powershell -ExecutionPolicy Bypass -File infra/scripts/start-hands-local.ps1 -AdminProduction',
    );
    expect(startScript).toContain('[switch]$AdminProduction');
    expect(startScript).toContain('npm.cmd run build --workspace @massage-vn/admin-web');
    expect(startScript).toContain('npm.cmd run start --workspace @massage-vn/admin-web -- --port $AdminPort');
  });

  it('treats a reachable local listener as running even when the wrapper process has exited', () => {
    const statusScript = readFileSync('../../infra/scripts/status-hands-local.ps1', 'utf8');

    expect(statusScript).toContain('$apiPortListening = Test-LocalPortListening $state.apiPort');
    expect(statusScript).toContain('$adminPortListening = Test-LocalPortListening $state.adminPort');
    expect(statusScript).toContain('apiRunning = [bool]$apiProcess -or $apiPortListening');
    expect(statusScript).toContain('adminRunning = [bool]$adminProcess -or $adminPortListening');
  });

  it('starts production Admin Web only after API health is ready', () => {
    const startScript = readFileSync('../../infra/scripts/start-hands-local.ps1', 'utf8');
    const productionWaitIndex = startScript.indexOf('Production Admin starts after API health is ready');
    const adminStartIndex = startScript.indexOf('$adminProcess = Start-Process powershell');

    expect(productionWaitIndex).toBeGreaterThan(-1);
    expect(adminStartIndex).toBeGreaterThan(-1);
    expect(productionWaitIndex).toBeLessThan(adminStartIndex);
    expect(startScript).toContain('if ($AdminProduction -and -not $SkipAdmin)');
    expect(startScript).toContain('Wait-HttpReady -Url "http://localhost:$ApiPort/api/health" -TimeoutSeconds 90');
  });

  it('does not leak local development NODE_ENV into production Admin builds', () => {
    const startScript = readFileSync('../../infra/scripts/start-hands-local.ps1', 'utf8');
    const productionAdminCommandIndex = startScript.indexOf('$adminCommand = if ($AdminProduction)');
    const nodeEnvIndex = startScript.indexOf("`$env:NODE_ENV='production'", productionAdminCommandIndex);
    const adminBuildIndex = startScript.indexOf('npm.cmd run build --workspace @massage-vn/admin-web', productionAdminCommandIndex);

    expect(productionAdminCommandIndex).toBeGreaterThan(-1);
    expect(nodeEnvIndex).toBeGreaterThan(productionAdminCommandIndex);
    expect(adminBuildIndex).toBeGreaterThan(nodeEnvIndex);
  });

  it('enables placeholder payment authorization only as a non-production local default', () => {
    const startScript = readFileSync('../../infra/scripts/start-hands-local.ps1', 'utf8');

    expect(startScript).toContain(
      'if ([Environment]::GetEnvironmentVariable("NODE_ENV", "Process") -ne "production")',
    );
    expect(startScript).toContain(
      'Set-DefaultEnvIfMissing -Key "ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS" -Value "true"',
    );
  });

  it('stops Next 16 production Admin listeners left behind by the wrapper process', () => {
    const stopScript = readFileSync('../../infra/scripts/stop-hands-local.ps1', 'utf8');

    expect(stopScript).toContain('next[/\\\\]dist[/\\\\]bin[/\\\\]next');
    expect(stopScript).toContain('Stop-HandsPortListener -Port $state.adminPort');
  });
});
