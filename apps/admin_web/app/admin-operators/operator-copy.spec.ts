import { formatOperatorCount, operatorHistoryActorLabel } from './operator-copy';

describe('Admin operator count copy', () => {
  it.each([
    [0, '0 active sessions'],
    [1, '1 active session'],
    [2, '2 active sessions'],
  ])('formats %i with exact singular or plural wording', (count, expected) => {
    expect(formatOperatorCount(count, 'active session')).toBe(expected);
  });

  it('labels lifecycle events with no retained actor relation as System', () => {
    expect(operatorHistoryActorLabel(null)).toBe('System');
    expect(operatorHistoryActorLabel({ email: 'ops@hands.vn', fullName: null, id: 'ops-1' })).toBe('ops@hands.vn');
  });
});
