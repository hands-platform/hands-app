import {
  externalRegistrationPlan,
  projectControlSequence,
  setupOrder,
  verifiedBaseline,
} from './setup-page-data';

describe('setup page data', () => {
  it('keeps setup order ids unique and required operating groups visible', () => {
    const ids = setupOrder.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'mobile',
        'supabase',
        'operations-policy',
        'payments',
        'notifications',
        'storage',
      ]),
    );
    expect(setupOrder.find((item) => item.id === 'notifications')?.env).toEqual(
      expect.arrayContaining(['PUSH_PROVIDER', 'FIREBASE_PROJECT_ID']),
    );
  });

  it('keeps external registration and baseline handoff data populated', () => {
    expect(externalRegistrationPlan.map((item) => item.id)).toEqual(
      expect.arrayContaining(['github-org', 'operations-policy', 'fcm', 'payments-vn']),
    );
    expect(projectControlSequence.map((item) => item.phase)).toEqual([
      'Phase A',
      'Phase B',
      'Phase C',
      'Phase D',
      'Phase E',
    ]);
    expect(verifiedBaseline).toEqual(
      expect.arrayContaining([
        'API typecheck and build pass.',
        'Secret leak guard passes.',
      ]),
    );
  });
});
