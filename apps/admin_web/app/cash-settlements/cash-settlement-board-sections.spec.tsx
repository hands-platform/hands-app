import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CashSettlementExecutionSection,
  CashSettlementRulesSection,
  CashSettlementWorkflowSections,
} from './cash-settlement-board-sections';

describe('CashSettlement board sections', () => {
  it('uses the shared Vuexy trace summary atom for applied policy cards', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-board-sections.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

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
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
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
    expect(groupedTableCardClassNamesIn(classNames)).toHaveLength(5);
  });

  it('keeps cash operating rules on the grouped Vuexy table-card shell', () => {
    const section = CashSettlementRulesSection({
      appliedPolicyCards: [
        {
          helper: 'Current policy helper',
          label: 'Settlement limit',
          value: '100,000 VND',
        },
      ],
      settlementRuleCards: [
        {
          action: 'Check evidence.',
          className: 'ops-task-pending',
          detail: 'Finance needs deposit evidence.',
          pillClass: 'pill pill-info',
          status: 'Review',
          title: 'Evidence rule',
        },
      ],
    });

    expect(groupedTableCardClassNamesIn(classNamesIn(section))).toHaveLength(1);
  });

  it('uses the shared status badge for the live policy marker', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-board-sections.tsx'),
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain("import Link from 'next/link';");
    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).toContain('AdminSectionHeader');
    expect(source).not.toContain('<span className="pill pill-info">Live policy default</span>');
    expect(source).not.toContain('<div className="ops-section-header admin-mt-14">');
    expect(source).not.toContain('<div className="ops-section-header admin-mt-16">');
  });

  it('keeps cash settlement task cards on shared Vuexy surfaces', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-board-sections.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('<div className="ops-task-grid"');
  });

  it('allows cash settlement command card details to render shared money atoms', () => {
    const typeSource = readFileSync(join(process.cwd(), 'app/cash-settlements/cash-settlement-page-types.ts'), 'utf8');
    const commandSource = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-page-command-cards.ts'),
      'utf8',
    );

    expect(typeSource).toContain("import type { ReactNode } from 'react';");
    expect(typeSource).toContain('detail: ReactNode;');
    expect(commandSource).toContain('MoneyText');
    expect(commandSource).not.toContain('formatMoney(');
  });

  it('allows cash settlement workflow details to render shared money atoms', () => {
    const typeSource = readFileSync(join(process.cwd(), 'app/cash-settlements/cash-settlement-page-types.ts'), 'utf8');
    const workflowSource = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-page-workflow-cards.ts'),
      'utf8',
    );

    expect(typeSource).not.toContain('detail: string;');
    expect(workflowSource).toContain('MoneyText');
    expect(workflowSource).not.toContain('formatMoney(');
  });
});

function groupedTableCardClassNamesIn(classNames: readonly string[]) {
  return classNames.filter(
    (className) =>
      className.includes('vuexy-booking-table-card') && className.includes('vuexy-booking-table-group'),
  );
}

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
