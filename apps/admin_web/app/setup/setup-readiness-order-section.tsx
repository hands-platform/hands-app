import type { AdminExternalReadiness } from '../../lib/admin-api';
import { CommandCopyRow } from '../../components/command-copy-row';
import { setupReadinessDisplayText } from './setup-readiness-copy';

type SetupRecommendedOrderItem = {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
};

type SetupReadinessOrderSectionProps = {
  readonly readinessChecks: AdminExternalReadiness['checks'];
  readonly recommendedOrder: readonly SetupRecommendedOrderItem[];
};

export function SetupReadinessOrderSection({
  readinessChecks,
  recommendedOrder,
}: SetupReadinessOrderSectionProps) {
  return (
    <section className="detail-grid">
      <div className="card">
        <h2>Live readiness</h2>
        <p className="muted">
          This panel is backed by the API endpoint, so it reflects the current `.env` and process environment.
        </p>
        <div className="stack">
          {readinessChecks.map((check) => (
            <ReadinessRow check={check} key={`${check.category}-${check.name}`} />
          ))}
          {readinessChecks.length === 0 && (
            <div className="ops-row">
              <div>
                <strong>Readiness API unavailable</strong>
                <p className="muted">Start the HANDS API and refresh this page.</p>
              </div>
              <span className="pill pill-warn">BLOCKED</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Recommended order</h2>
        <div className="timeline">
          {recommendedOrder.map((group, index) => (
            <a className="timeline-step" href={`#${group.id}`} key={group.id}>
              <span>Step {index + 1}</span>
              <strong>{group.title}</strong>
              <p className="muted">{group.purpose}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReadinessRow({ check }: { check: AdminExternalReadiness['checks'][number] }) {
  const configured = check.configured.map(setupReadinessDisplayText);
  const missing = check.missing.map(setupReadinessDisplayText);
  const invalid = (check.invalid ?? []).map(setupReadinessDisplayText);
  const commands = readinessCommands(check);
  const isCurrentStage = check.scope === 'CURRENT_STAGE';

  return (
    <div className="ops-row">
      <div>
        <strong>{setupReadinessDisplayText(check.name)}</strong>
        <p className="muted">{setupReadinessDisplayText(check.detail)}</p>
        <div className="participant-list admin-mb-8">
          <span className={`pill ${isCurrentStage ? 'pill-info' : 'pill-neutral'}`}>
            {isCurrentStage ? 'Current stage' : 'Deferred'}
          </span>
          {check.secretSafe && <span className="pill pill-neutral">Secret-safe</span>}
        </div>
        {check.operatorAction && (
          <p className="muted">
            <strong>Operator action:</strong> {setupReadinessDisplayText(check.operatorAction)}
          </p>
        )}
        {configured.length > 0 && <p className="muted">Configured: {configured.join(', ')}</p>}
        {missing.length > 0 && <p className="muted">Missing: {missing.join(', ')}</p>}
        {invalid.length > 0 && <p className="muted">Invalid: {invalid.join(', ')}</p>}
        {commands.length > 0 && (
          <div className="setup-command-list admin-mt-8">
            {commands.map((command) => (
              <CommandCopyRow command={command} key={`${check.category}-${command}`} />
            ))}
          </div>
        )}
      </div>
      <span className={`pill ${readinessStatusPillClass(check.status)}`}>{check.status}</span>
    </div>
  );
}

function readinessCommands(check: AdminExternalReadiness['checks'][number]) {
  if (check.category !== 'push') {
    return check.commands ?? [];
  }

  const commands = new Set(
    (check.commands ?? []).filter((command) => command !== 'npm.cmd run external:check:production'),
  );
  commands.add('npm.cmd run external:check:push');
  commands.add('npm.cmd run fcm:env-contract');
  commands.add('npm.cmd run notifications:push-data-contract');
  commands.add(
    'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -CheckOnly',
  );
  commands.add('npm.cmd run security:secrets');
  commands.add('npm.cmd run fcm:credentials-check');
  commands.add('npm.cmd run docker:contract');
  commands.add('npm.cmd run fcm:token-smoke -- --dry-run');
  commands.add('npm.cmd run fcm:push-smoke -- --dry-run');
  commands.add('npm.cmd run fcm:push-smoke -- --preflight');
  return Array.from(commands);
}

function readinessStatusPillClass(status: string) {
  if (status === 'READY') {
    return 'pill-success';
  }
  if (status === 'PARTIAL') {
    return 'pill-info';
  }
  return 'pill-warn';
}
