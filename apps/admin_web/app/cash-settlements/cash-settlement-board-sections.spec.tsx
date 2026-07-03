import {
  CashSettlementExecutionSection,
  CashSettlementWorkflowSections,
} from './cash-settlement-board-sections';

describe('CashSettlement board sections', () => {
  it('does not duplicate the base pill class for execution command cards', () => {
    const section = CashSettlementExecutionSection({
      executionDesk: [
        {
          action: 'Review settlement evidence.',
          className: 'ops-task-blocked',
          detail: 'Cash debt is blocking payout release.',
          pillClass: 'pill pill-danger',
          status: 'Blocked',
          title: 'Cash debt',
        },
      ],
      priorityBoardRows: [],
    });

    expect(classNamesIn(section)).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
    );
    expect(classNamesIn(section)).toContain('pill pill-danger');
    expect(classNamesIn(section)).not.toContain('pill pill pill-danger');
  });

  it('does not duplicate the base pill class across workflow cards and linked checklist items', () => {
    const section = CashSettlementWorkflowSections({
      commandCards: [
        {
          action: 'Create evidence note.',
          className: 'ops-task-pending',
          detail: 'Waiting for finance review.',
          pillClass: 'pill pill-info',
          status: 'Queued',
          title: 'Command queue',
        },
      ],
      debtCauseCards: [
        {
          action: 'Open payment trace.',
          className: 'ops-task-blocked',
          detail: 'Cash booking has no company-fee deposit.',
          pillClass: 'pill pill-warn',
          status: 'Review',
          title: 'Debt cause',
        },
      ],
      evidenceChecklist: [
        {
          className: 'ops-task-blocked',
          detail: 'Reference is required before release.',
          href: '/bookings/booking-1',
          operatorRule: 'Confirm evidence before release.',
          pillClass: 'pill pill-danger',
          status: 'Missing',
          title: 'Evidence',
        },
      ],
      recoverySteps: [
        {
          detail: 'Partner wallet reopens after clearing.',
          operatorRule: 'Require finance approval.',
          pillClass: 'pill pill-success',
          status: 'Ready',
          title: 'Recovery',
        },
      ],
      settlementHandoff: [
        {
          className: 'ops-task-pending',
          detail: 'Follow the booking settlement trace.',
          href: '/bookings/booking-2',
          operatorRule: 'Open booking evidence.',
          pillClass: 'pill pill-info',
          status: 'Trace',
          title: 'Handoff',
        },
      ],
    });

    const classNames = classNamesIn(section);

    expect(classNames).toEqual(
      expect.arrayContaining(['pill pill-info', 'pill pill-warn', 'pill pill-danger', 'pill pill-success']),
    );
    expect(classNames).not.toEqual(
      expect.arrayContaining([
        'pill pill pill-info',
        'pill pill pill-warn',
        'pill pill pill-danger',
        'pill pill pill-success',
      ]),
    );
  });
});

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
