export function buildReleaseReadinessReport(setup, network, financeGovernance) {
  const setupBlockers = (setup.checks ?? [])
    .filter((check) => check.status === 'FAIL' || check.status === 'WARN')
    .map(({ category, name, status }) => ({ category, name, status }));
  const networkBlockers = (network.results ?? [])
    .filter((result) => result.status !== 'PASS')
    .map(({ name, status, error }) => ({ name, status, error }));

  return {
    ok: setup.ok === true && network.ok === true && financeGovernance.ok === true,
    action: 'release-readiness',
    setup: {
      ok: setup.ok === true,
      blockers: setupBlockers,
      nextActions: setup.nextActions ?? [],
    },
    network: {
      ok: network.ok === true,
      blockers: networkBlockers,
    },
    financeGovernance: {
      ok: financeGovernance.ok === true,
      productionViolationCount: financeGovernance.productionViolationCount ?? null,
      fixtureCount: financeGovernance.fixtureCount ?? null,
      unknownCount: financeGovernance.unknownCount ?? null,
      pendingRequestCount: financeGovernance.pendingRequestCount ?? null,
      errorCode: financeGovernance.errorCode ?? null,
    },
  };
}
