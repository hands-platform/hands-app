import {
  adminQueueAgeLabel,
  readAdminQueueAge,
  readAdminQueueSlaFilter,
  readAdminQueueSort,
} from './admin-queue-list';

describe('admin queue list filters', () => {
  it('normalizes supported age and sort query values', () => {
    expect(readAdminQueueAge('4-24h')).toBe('4-24h');
    expect(readAdminQueueAge('unexpected')).toBe('all');
    expect(readAdminQueueSort('oldest')).toBe('oldest');
    expect(readAdminQueueSort('unexpected')).toBe('newest');
    expect(readAdminQueueSlaFilter('overdue')).toBe('overdue');
    expect(readAdminQueueSlaFilter('within')).toBe('within');
    expect(readAdminQueueSlaFilter('overdue-under-24h')).toBe('overdue-under-24h');
    expect(readAdminQueueSlaFilter('critical')).toBe('critical');
    expect(readAdminQueueSlaFilter('unexpected')).toBe('all');
    expect(adminQueueAgeLabel('over-24h')).toBe('24h+');
  });
});
