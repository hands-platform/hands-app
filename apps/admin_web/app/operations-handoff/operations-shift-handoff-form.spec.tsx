import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { OperationsShiftHandoffForm } from './operations-shift-handoff-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe('OperationsShiftHandoffForm', () => {
  it('keeps follow-up ownership advanced and makes current-page selection explicit', () => {
    const markup = renderToStaticMarkup(
      <OperationsShiftHandoffForm
        currentOperator={{ id: 'outgoing-admin', label: 'Outgoing Operator' }}
        defaultShiftLabel="Evening shift"
        openCaseBaseHref="/operations-handoff?page=1"
        openCases={{
          items: [],
          openCount: 30,
          pagination: { page: 1, pageSize: 25, totalPages: 2, totalRows: 30 },
        }}
        operators={[]}
      />,
    );
    const source = readFileSync(new URL('./operations-shift-handoff-form.tsx', import.meta.url), 'utf8');

    expect(markup).toContain('Select visible page');
    expect(markup).toContain(
      'Select visible page selects up to 25 cases. Changing pages clears this selection.',
    );
    expect(markup).toContain('Advanced follow-up owner override');
    expect(markup).not.toContain('Default case owner');
    expect(markup).toContain('Current state:');
    expect(source).toContain('Changing pages clears the cases selected on this page. Continue?');
    expect(source).toContain('cases will remain open and require another handoff.');
  });

  it('labels a zero-case send as a clear-shift confirmation', () => {
    const markup = renderToStaticMarkup(
      <OperationsShiftHandoffForm
        currentOperator={{ id: 'outgoing-admin', label: 'Outgoing Operator' }}
        defaultShiftLabel="Evening shift"
        openCaseBaseHref="/operations-handoff"
        openCases={{
          items: [],
          openCount: 0,
          pagination: { page: 1, pageSize: 25, totalPages: 1, totalRows: 0 },
        }}
        operators={[]}
      />,
    );

    expect(markup).toContain('Clear-shift confirmation · No open cases at handoff time');
    expect(markup).toContain('Preview handoff');
    expect(markup).not.toContain('Select visible page');
    expect(markup).not.toContain('<table');
    expect(markup).not.toContain('Open handoff cases pagination');
  });

  it('keeps populated case evidence aligned after removing the misleading source owner column', () => {
    const markup = renderToStaticMarkup(
      <OperationsShiftHandoffForm
        currentOperator={{ id: 'outgoing-admin', label: 'Outgoing Operator' }}
        defaultShiftLabel="Evening shift"
        openCaseBaseHref="/operations-handoff"
        openCases={{
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
        }}
        operators={[]}
      />,
    );

    expect(markup).toContain('Refund review');
    expect(markup).toContain('refund-17');
    expect(markup).toContain('1.000 VND');
    expect(markup).toContain('Overdue');
    expect(markup).toContain('Open refund review');
    expect(markup).not.toContain('>Owner</th>');
    expect(markup).not.toContain('Unassigned');
  });

  it.each([5, 15, 40])('keeps the native labeled operator select for %i active options', (count) => {
    const operators = Array.from({ length: count }, (_, index) => ({
      categories: [],
      email: `operator-${index}@hands.test`,
      fullName: index < 2 ? 'Duplicate Name' : `Operator ${index}`,
      id: `operator-${index}`,
      phone: null,
      queueKeys: [],
      roles: ['ADMIN'],
    }));
    const markup = renderToStaticMarkup(
      <OperationsShiftHandoffForm
        currentOperator={{ id: 'outgoing-admin', label: 'Outgoing Operator' }}
        defaultShiftLabel="Evening shift"
        openCaseBaseHref="/operations-handoff"
        openCases={{
          items: [],
          openCount: 0,
          pagination: { page: 1, pageSize: 25, totalPages: 1, totalRows: 0 },
        }}
        operators={operators}
      />,
    );

    expect(markup).toContain('<span class="admin-form-label">Incoming operator</span>');
    expect(markup).toContain('<select name="incomingOperatorId"');
    expect(markup).toContain('Duplicate Name · Admin · operator-0@hands.test');
    expect(markup).toContain('Duplicate Name · Admin · operator-1@hands.test');
    expect((markup.match(/<option /gu) ?? [])).toHaveLength(count * 2 + 3);
  });
});
