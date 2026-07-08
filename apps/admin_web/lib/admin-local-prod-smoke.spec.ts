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
});
