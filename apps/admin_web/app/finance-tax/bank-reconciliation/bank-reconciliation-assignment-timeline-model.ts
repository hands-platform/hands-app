import type { AdminFinanceReviewAssignmentHistoryEntry } from '../../../lib/admin-api';

type AssignmentHistory = readonly AdminFinanceReviewAssignmentHistoryEntry[];

export type BankReconciliationAssignmentTimelineItem = {
  readonly assignedAt: string;
  readonly assignedByLabel: string;
  readonly assigneeId: string;
  readonly assigneeLabel: string;
  readonly detail: string;
  readonly elapsedLabel: string;
  readonly id: string;
  readonly previousAssigneeLabel: string;
  readonly statusLabel: 'Current owner' | 'Initial assignment' | 'Reassigned';
  readonly tone: 'danger' | 'info' | 'success' | 'warning';
};

export function buildBankReconciliationAssignmentTimeline(
  history: AssignmentHistory | undefined,
  now = new Date(),
): readonly BankReconciliationAssignmentTimelineItem[] {
  const chronological = [...(history ?? [])]
    .filter((entry) => Number.isFinite(new Date(entry.assignedAt).getTime()))
    .sort((left, right) => new Date(left.assignedAt).getTime() - new Date(right.assignedAt).getTime());

  return chronological
    .map((entry, index) => {
      const isCurrent = index === chronological.length - 1;
      const nextAssignment = chronological[index + 1];
      const assignedAtMs = new Date(entry.assignedAt).getTime();
      const endedAtMs = nextAssignment
        ? new Date(nextAssignment.assignedAt).getTime()
        : Math.max(now.getTime(), assignedAtMs);
      const elapsedMs = Math.max(0, endedAtMs - assignedAtMs);
      const wasInitialAssignment = !entry.previousAssignee;

      return {
        assignedAt: entry.assignedAt,
        assignedByLabel: adminIdentityLabel(entry.assignedBy, 'System'),
        assigneeId: entry.assignee.id,
        assigneeLabel: adminIdentityLabel(entry.assignee, entry.assignee.id),
        detail: entry.reason?.trim() || 'No assignment reason recorded.',
        elapsedLabel: assignmentElapsedLabel(elapsedMs),
        id: entry.id,
        previousAssigneeLabel: adminIdentityLabel(entry.previousAssignee, 'Unassigned'),
        statusLabel: isCurrent
          ? 'Current owner'
          : wasInitialAssignment
            ? 'Initial assignment'
            : 'Reassigned',
        tone: isCurrent ? currentAssignmentTone(elapsedMs) : 'success',
      } satisfies BankReconciliationAssignmentTimelineItem;
    })
    .reverse();
}

function adminIdentityLabel(
  identity:
    | {
        readonly email?: string | null;
        readonly fullName?: string | null;
        readonly id: string;
      }
    | null
    | undefined,
  fallback: string,
) {
  return identity?.fullName?.trim() || identity?.email?.trim() || identity?.id || fallback;
}

function assignmentElapsedLabel(elapsedMs: number) {
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;

  const days = Math.floor(elapsedHours / 24);
  const remainingHours = elapsedHours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function currentAssignmentTone(elapsedMs: number): BankReconciliationAssignmentTimelineItem['tone'] {
  if (elapsedMs >= 48 * 60 * 60_000) return 'danger';
  if (elapsedMs >= 24 * 60 * 60_000) return 'warning';
  return 'info';
}
