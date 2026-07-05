import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';

import { FinancePeriodFilterForm } from './finance-period-filter-form';

describe('FinancePeriodFilterForm', () => {
  it('delegates the form shell to the shared Vuexy form grid atom', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-period-filter-form.tsx'), 'utf8');

    expect(source).toContain('AdminFormGrid');
    expect(source).not.toContain('<form action={action}');
  });

  it('renders finance period filters through the shared Vuexy form atoms', () => {
    const markup = renderToStaticMarkup(
      <FinancePeriodFilterForm
        action="/finance-overview"
        hiddenFields={[{ name: 'range', value: '7d' }]}
        period="2026-07"
        periodLabel="Monthly tax period"
        rows={{ name: 'pageSize', options: [10, 25], value: 25 }}
      />,
    );

    expect(markup).toContain('action="/finance-overview"');
    expect(markup).toContain('method="get"');
    expect(markup).toContain('name="range"');
    expect(markup).toContain('value="7d"');
    expect(markup).toContain(
      'class="admin-form-date admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled"',
    );
    expect(markup).toContain('class="admin-form-label">Monthly tax period');
    expect(markup).toContain('type="month"');
    expect(markup).toContain('value="2026-07"');
    expect(markup).toContain('class="admin-form-select admin-form-control-labeled"');
    expect(markup).toContain('name="pageSize"');
    expect(markup).toContain('value="25" selected=""');
    expect(markup).toContain('class="admin-form-control-button button button-primary"');
  });
});
