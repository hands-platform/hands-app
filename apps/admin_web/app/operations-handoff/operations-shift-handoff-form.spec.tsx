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
    expect(markup).toContain('Advanced follow-up owner override');
    expect(markup).not.toContain('Default case owner');
    expect(markup).toContain('Current state:');
    expect(source).toContain('Changing pages clears the cases selected on this page. Continue?');
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
  });
});
