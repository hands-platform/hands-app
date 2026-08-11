import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminOperationsHandoffOpenCasePage, AdminShiftHandoffPage } from '../../lib/admin-api';
import { OperationsShiftHandoffSection } from './operations-shift-handoff-section';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const openHandoff: AdminShiftHandoffPage = {
  items: [
    {
      acknowledgedAt: null,
      acknowledgedBy: null,
      createdAt: '2026-08-05T01:00:00.000Z',
      id: 'handoff-1',
      incomingOperator: 'Incoming Operator',
      incomingOperatorId: 'incoming-admin',
      note: 'Review refund evidence.',
      outgoingOperator: { fullName: 'Outgoing Operator', id: 'admin-1' },
      outgoingShift: 'Evening shift',
      owner: 'Finance Operator',
      ownerId: 'finance-admin',
      unresolvedCases: [{ caseId: 'refund-17', queueKey: 'refund-review' }],
      unresolvedCaseIds: ['refund-17'],
    },
  ],
  openCount: 1,
  pagination: { page: 1, pageSize: 25, totalPages: 1, totalRows: 1 },
  totalCount: 1,
};
const cases: AdminOperationsHandoffOpenCasePage = {
  items: [
    {
      ageMinutes: 80,
      amount: 1000,
      caseId: 'refund-17',
      currency: 'VND',
      href: '/refunds?q=refund-17',
      occurredAt: '2026-08-05T01:00:00.000Z',
      overdue: true,
      owner: null,
      priority: 3,
      queueKey: 'refund-review',
      queueLabel: 'Refund review',
      requiredCategory: 'FINANCE_SETTLEMENTS',
      slaMinutes: 60,
      state: 'Overdue',
    },
  ],
  openCount: 1,
  pagination: { page: 1, pageSize: 25, totalPages: 1, totalRows: 1 },
};

describe('OperationsShiftHandoffSection', () => {
  it('orders assigned work before waiting work and creation', () => {
    const waiting = {
      ...openHandoff,
      items: [
        {
          ...openHandoff.items[0],
          id: 'handoff-2',
          incomingOperatorId: 'next-admin',
          outgoingOperator: { fullName: 'Incoming Operator', id: 'incoming-admin' },
        },
      ],
    };
    const markup = renderToStaticMarkup(
      <OperationsShiftHandoffSection
        assignedData={openHandoff}
        currentOperator={{ id: 'incoming-admin', label: 'Incoming Operator' }}
        defaultShiftLabel="05 Aug 2026 08:00 Vietnam shift"
        mode="current"
        openCaseBaseHref="/operations-handoff"
        openCases={cases}
        operators={[
          {
            categories: ['FINANCE_SETTLEMENTS'],
            fullName: 'Next Operator',
            id: 'next-admin',
            queueKeys: ['refund-review'],
            roles: ['ADMIN'],
          },
        ]}
        waitingData={waiting}
      />,
    );

    expect(markup.indexOf('Assigned to me')).toBeLessThan(markup.indexOf('Waiting for others'));
    expect(markup.indexOf('Waiting for others')).toBeLessThan(markup.indexOf('Create handoff'));
    expect(markup).toContain('Confirm receipt');
    expect(markup).toContain('Select visible page');
    expect(markup).toContain('Follow-up owner');
    expect(markup).toContain('Refund review');
    expect(markup).toContain('Open refund review');
  });

  it('renders only the handoff ledger in history mode', () => {
    const data = {
      ...openHandoff,
      items: [{ ...openHandoff.items[0], acknowledgedAt: '2026-08-05T01:05:00.000Z' }],
      openCount: 0,
    };
    const markup = renderToStaticMarkup(
      <OperationsShiftHandoffSection
        currentOperator={{ id: null, label: 'Current operator' }}
        data={data}
        mode="history"
      />,
    );

    expect(markup).toContain('>History<');
    expect(markup).toContain('Confirmed');
    expect(markup).toContain('Confirmed at');
    expect(markup).toContain('Open audit record');
    expect(markup).not.toContain('Create handoff');
    expect(markup).not.toContain('Acknowledge handoff');
  });

  it('distinguishes an empty queue from an empty filtered result', () => {
    const props = {
      currentOperator: { id: 'incoming-admin', label: 'Incoming Operator' },
      assignedData: {
        ...openHandoff,
        items: [],
        openCount: 0,
        pagination: { ...openHandoff.pagination!, totalRows: 0 },
        totalCount: 0,
      },
      defaultShiftLabel: '05 Aug 2026 08:00 Vietnam shift',
      mode: 'current' as const,
      operators: [],
      waitingData: {
        ...openHandoff,
        items: [],
        openCount: 0,
        pagination: { ...openHandoff.pagination!, totalRows: 0 },
        totalCount: 0,
      },
    };
    const emptyMarkup = renderToStaticMarkup(
      <OperationsShiftHandoffSection
        {...props}
        openCases={{ ...cases, items: [], openCount: 0, pagination: { ...cases.pagination, totalRows: 0 } }}
      />,
    );
    const filteredMarkup = renderToStaticMarkup(
      <OperationsShiftHandoffSection
        {...props}
        openCases={{ ...cases, items: [], openCount: 1, pagination: { ...cases.pagination, totalRows: 0 } }}
      />,
    );

    expect(emptyMarkup).toContain('No open cases are waiting for handoff.');
    expect(filteredMarkup).toContain('No open cases match this search.');
    expect(filteredMarkup).toContain(
      'Select at least one open case, or resolve the queue before sending a clear handoff.',
    );
  });

  it('renders one History empty state without a table header', () => {
    const markup = renderToStaticMarkup(
      <OperationsShiftHandoffSection
        currentOperator={{ id: null, label: 'Current operator' }}
        data={{ ...openHandoff, items: [], openCount: 0, totalCount: 0 }}
        mode="history"
      />,
    );

    expect(markup).toContain('No handoff history');
    expect(markup).toContain('Reset filters');
    expect(markup).not.toContain('<table');
    expect(markup).not.toContain('Follow-up owner</th>');
  });
});
