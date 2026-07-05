import type { AdminExternalReadiness } from '../../lib/admin-api';
import { CommandCopyRow } from '../../components/command-copy-row';
import { AdminDetailGrid, AdminSection } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeLink, statusBadgeToneFromPillClass } from '../../components/status-badge';
import { FCM_SETUP_READINESS_COMMANDS } from '../notifications/fcm-smoke-commands';
import { setupReadinessDisplayText } from './setup-readiness-copy';

type SetupRecommendedOrderItem = {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
};

type SetupReadinessOrderSectionProps = {
  readonly commandMode?: 'full' | 'summary';
  readonly readinessChecks: AdminExternalReadiness['checks'];
  readonly recommendedOrder: readonly SetupRecommendedOrderItem[];
};

export function SetupReadinessOrderSection({
  commandMode = 'full',
  readinessChecks,
  recommendedOrder,
}: SetupReadinessOrderSectionProps) {
  return (
    <AdminDetailGrid ariaLabel="Setup readiness order">
      <AdminSection
        description="This panel is backed by the API endpoint, so it reflects the current `.env` and process environment."
        title="Live readiness"
      >
        <div className="stack">
          {readinessChecks.map((check) => (
            <ReadinessRow check={check} commandMode={commandMode} key={`${check.category}-${check.name}`} />
          ))}
          {readinessChecks.length === 0 && (
            <div className="ops-row">
              <div>
                <strong>Readiness API unavailable</strong>
                <p className="muted">Start the HANDS API and refresh this page.</p>
              </div>
              <StatusBadge tone="warning">BLOCKED</StatusBadge>
            </div>
          )}
        </div>
      </AdminSection>

      <AdminSection title="Recommended order">
        <div className="timeline">
          {recommendedOrder.map((group, index) => (
            <a className="timeline-step" href={`#${group.id}`} key={group.id}>
              <span>Step {index + 1}</span>
              <strong>{group.title}</strong>
              <p className="muted">{group.purpose}</p>
            </a>
          ))}
        </div>
      </AdminSection>
    </AdminDetailGrid>
  );
}

function ReadinessRow({
  check,
  commandMode,
}: {
  readonly check: AdminExternalReadiness['checks'][number];
  readonly commandMode: 'full' | 'summary';
}) {
  const configured = check.configured.map(setupReadinessDisplayText);
  const missing = check.missing.map(setupReadinessDisplayText);
  const invalid = (check.invalid ?? []).map(setupReadinessDisplayText);
  const allCommands = readinessCommands(check);
  const commands = commandMode === 'summary' ? allCommands.slice(0, 1) : allCommands;
  const isCurrentStage = check.scope === 'CURRENT_STAGE';

  return (
    <div className="ops-row">
      <div>
        <strong>{setupReadinessDisplayText(check.name)}</strong>
        <p className="muted">{setupReadinessDisplayText(check.detail)}</p>
        <div className="participant-list admin-mb-8">
          <StatusBadge tone={isCurrentStage ? 'info' : 'neutral'}>
            {isCurrentStage ? 'Current stage' : 'Deferred'}
          </StatusBadge>
          {check.secretSafe && <StatusBadge tone="neutral">Secret-safe</StatusBadge>}
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
            {commandMode === 'summary' && allCommands.length > commands.length ? (
              <StatusBadgeLink tone="neutral" href={`/setup?commands=all#${setupAnchorForReadinessCheck(check)}`}>
                Show {allCommands.length - commands.length} more command(s)
              </StatusBadgeLink>
            ) : null}
          </div>
        )}
      </div>
      <StatusBadge tone={statusBadgeToneFromPillClass(readinessStatusPillClass(check.status))}>{check.status}</StatusBadge>
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
  FCM_SETUP_READINESS_COMMANDS.forEach((command) => commands.add(command));
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

function setupAnchorForReadinessCheck(check: AdminExternalReadiness['checks'][number]) {
  return check.category === 'push' ? 'notifications' : check.category;
}
