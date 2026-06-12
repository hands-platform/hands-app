import type { AdminExternalReadiness } from '../../lib/admin-api';
import {
  buildCurrentStageStatus,
  buildDeferredOperatorActions,
  buildExternalBacklog,
  buildExternalRegistrationPlan,
  buildGroupStatuses,
  buildNextOperatorActions,
  buildSetupGroupDetails,
  buildSummary,
  isReadinessUnavailable,
  type ExternalRegistrationPlanItem,
  type SetupOrderItem,
} from './setup-page-model';

describe('setup page model', () => {
  it('builds current-stage and deferred setup signals from readiness checks', () => {
    const readiness = readinessFixture({
      checks: [
        {
          category: 'operations-policy',
          name: 'Dispatch policy',
          status: 'BLOCKED',
          configured: ['WALLET_NEGATIVE_BALANCE_GATE'],
          missing: ['MATCHING_BACKUP_OPEN_MODE'],
          detail: 'Dispatch policy must be reviewed.',
          scope: 'CURRENT_STAGE',
          operatorAction: 'Review operations policy before dispatch smoke.',
          commands: ['Open http://localhost:3101/operations-policy'],
        },
        {
          category: 'payments',
          name: 'Gateway sandbox',
          status: 'PARTIAL',
          configured: ['MOMO_PARTNER_CODE'],
          missing: ['MOMO_ACCESS_KEY'],
          detail: 'Payment gateway sandbox is incomplete.',
          scope: 'DEFERRED',
          commands: ['npm.cmd run external:check:payments'],
        },
      ],
    });

    expect(buildSummary(readiness)).toEqual({ ready: 0, partial: 1, blocked: 1, missing: 2 });
    expect(buildGroupStatuses(readiness, setupOrderFixture)).toEqual([
      expect.objectContaining({ id: 'operations-policy', status: 'Blocked' }),
      expect.objectContaining({ id: 'payments', status: 'Partial' }),
    ]);
    expect(buildExternalBacklog(readiness, setupOrderFixture)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupId: 'operations-policy',
          groupTitle: 'Runtime operations policy',
          name: 'MATCHING_BACKUP_OPEN_MODE',
        }),
      ]),
    );
    expect(buildNextOperatorActions(readiness, setupOrderFixture)).toEqual([
      expect.objectContaining({
        groupId: 'operations-policy',
        phase: 'Dispatch policy control',
        action: 'Review operations policy before live dispatch testing.',
      }),
    ]);
    expect(buildDeferredOperatorActions(readiness, setupOrderFixture)).toEqual([
      expect.objectContaining({
        groupId: 'payments',
        action: 'Add sandbox credentials before real payment testing.',
      }),
    ]);
    expect(buildCurrentStageStatus(readiness, setupOrderFixture)).toMatchObject({
      ok: false,
      blockers: 1,
      label: 'Current stage blocked',
    });
    expect(buildSetupGroupDetails(readiness, setupOrderFixture)[0]).toMatchObject({
      id: 'operations-policy',
      status: 'Blocked',
      statusClass: 'signal signal-warn',
      envPills: expect.arrayContaining([
        { name: 'MATCHING_BACKUP_OPEN_MODE', className: 'pill pill-warn' },
        { name: 'WALLET_NEGATIVE_BALANCE_GATE', className: 'pill pill-success' },
      ]),
    });
  });

  it('builds registration plan display state and API-unavailable fallback', () => {
    const unavailable = readinessFixture({ checks: [] });

    expect(isReadinessUnavailable(unavailable)).toBe(true);
    expect(buildSummary(unavailable, true)).toEqual({ ready: 0, partial: 0, blocked: 1, missing: 1 });
    expect(buildExternalBacklog(unavailable, setupOrderFixture, true)).toEqual([
      expect.objectContaining({ groupId: 'live-readiness', name: 'API readiness endpoint' }),
    ]);
    expect(buildDeferredOperatorActions(unavailable, setupOrderFixture, true)).toEqual([]);
    expect(buildCurrentStageStatus(unavailable, setupOrderFixture, true)).toMatchObject({
      ok: false,
      label: 'API unavailable',
    });
    expect(buildExternalRegistrationPlan(unavailable, registrationPlanFixture, true)).toEqual([
      expect.objectContaining({ id: 'ops-policy', status: 'Not checked', statusClass: 'pill-warn' }),
      expect.objectContaining({ id: 'source-control', status: 'Account ready', statusClass: 'pill-success' }),
    ]);
  });
});

const setupOrderFixture: SetupOrderItem[] = [
  {
    id: 'operations-policy',
    title: 'Runtime operations policy',
    phase: 'Dispatch policy control',
    operatorAction: 'Review operations policy before live dispatch testing.',
    exitCriteria: 'Policy review is complete.',
    purpose: 'Required before live dispatch smoke.',
    env: ['MATCHING_BACKUP_OPEN_MODE', 'WALLET_NEGATIVE_BALANCE_GATE'],
    notes: ['Keep operational policy editable from admin.'],
    commands: ['Open http://localhost:3101/operations-policy'],
  },
  {
    id: 'payments',
    title: 'Vietnam payment gateways',
    phase: 'Commercial E2E',
    operatorAction: 'Add sandbox credentials before real payment testing.',
    exitCriteria: 'Payment smoke passes.',
    purpose: 'Required for real payment E2E.',
    env: ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY'],
    notes: ['Use sandbox credentials first.'],
    commands: ['npm.cmd run external:check:payments'],
  },
];

const registrationPlanFixture: ExternalRegistrationPlanItem[] = [
  {
    id: 'ops-policy',
    groupId: 'operations-policy',
    title: 'Runtime policy',
    provider: 'HANDS Admin',
    owner: 'Operations team',
    detail: 'Policy setup state.',
    env: ['MATCHING_BACKUP_OPEN_MODE'],
  },
  {
    id: 'source-control',
    groupId: 'operations-policy',
    title: 'Source control',
    provider: 'GitHub',
    owner: 'Platform team',
    status: 'Account ready',
    statusClass: 'pill-success',
    detail: 'Repository is ready.',
    env: ['GITHUB_OWNER'],
  },
];

function readinessFixture(overrides: Partial<AdminExternalReadiness>): AdminExternalReadiness {
  return {
    ok: false,
    timestamp: new Date(0).toISOString(),
    checks: [],
    ...overrides,
  };
}
