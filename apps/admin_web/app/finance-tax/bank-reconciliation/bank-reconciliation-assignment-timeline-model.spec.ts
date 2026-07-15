import { buildBankReconciliationAssignmentTimeline } from './bank-reconciliation-assignment-timeline-model';

describe('buildBankReconciliationAssignmentTimeline', () => {
  it('separates the initial assignment, reassignment, and current SLA duration', () => {
    const timeline = buildBankReconciliationAssignmentTimeline(
      [
        {
          id: 'assignment-2',
          assignedAt: '2026-07-14T12:00:00.000Z',
          assignee: { id: 'admin-2', fullName: 'Current Owner' },
          assignedBy: { id: 'master-1', fullName: 'Master Admin' },
          previousAssignee: { id: 'admin-1', fullName: 'First Owner' },
          reason: 'Reassigned for the next Finance shift.',
        },
        {
          id: 'assignment-1',
          assignedAt: '2026-07-13T00:00:00.000Z',
          assignee: { id: 'admin-1', email: 'first@hands.test' },
          assignedBy: { id: 'master-1', email: 'master@hands.test' },
          previousAssignee: null,
          reason: 'Initial review assignment.',
        },
      ],
      new Date('2026-07-15T14:00:00.000Z'),
    );

    expect(timeline).toEqual([
      expect.objectContaining({
        assigneeId: 'admin-2',
        assigneeLabel: 'Current Owner',
        elapsedLabel: '1d 2h',
        previousAssigneeLabel: 'First Owner',
        statusLabel: 'Current owner',
        tone: 'warning',
      }),
      expect.objectContaining({
        assignedByLabel: 'master@hands.test',
        assigneeLabel: 'first@hands.test',
        elapsedLabel: '1d 12h',
        previousAssigneeLabel: 'Unassigned',
        statusLabel: 'Initial assignment',
        tone: 'success',
      }),
    ]);
  });

  it('returns an empty timeline for missing or invalid evidence', () => {
    expect(buildBankReconciliationAssignmentTimeline(undefined)).toEqual([]);
    expect(
      buildBankReconciliationAssignmentTimeline([
        {
          id: 'invalid',
          assignedAt: 'invalid',
          assignee: { id: 'admin-1' },
          assignedBy: null,
          previousAssignee: null,
          reason: null,
        },
      ]),
    ).toEqual([]);
  });
});
