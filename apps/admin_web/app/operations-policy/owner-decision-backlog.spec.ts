import { operationsOwnerDecisionBacklog } from './owner-decision-backlog';

describe('operations owner decision backlog', () => {
  it('keeps launch-critical owner decisions visible and actionable', () => {
    const backlog = operationsOwnerDecisionBacklog();
    const titles = backlog.map((item) => item.title);

    expect(titles).toContain('First-pick partner timer');
    expect(titles).toContain('Marketplace partner radius');
    expect(titles).toContain('Negative wallet marketplace policy');
    expect(titles).toContain('Negative wallet direct-request boundary');
    expect(titles).toContain('Payout batch cycle');
    expect(titles).toContain('No-show evidence');
    expect(titles).toContain('Partner alert routing');

    for (const item of backlog) {
      expect(item.owner).toBeTruthy();
      expect(item.question).toBeTruthy();
      expect(item.recommendation).toBeTruthy();
      expect(item.decisionTrigger).toBeTruthy();
      expect(item.href.startsWith('/')).toBe(true);
      expect(item.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the negative wallet direct-request boundary as an owner decision, not hidden behavior', () => {
    const decision = operationsOwnerDecisionBacklog().find(
      (item) => item.title === 'Negative wallet direct-request boundary',
    );

    expect(decision).toBeDefined();
    expect(decision?.href).toBe('/cash-settlements');
    expect(decision?.options.map((option) => option.label)).toEqual([
      'Keep current MVP boundary',
      'Block all new acceptance',
    ]);
  });
});
