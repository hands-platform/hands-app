import { renderToStaticMarkup } from 'react-dom/server';

import { FinanceDataTable } from './finance-data-table';

describe('FinanceDataTable', () => {
  it('renders the standard finance table scroll shell and Vuexy table class', () => {
    const markup = renderToStaticMarkup(
      <FinanceDataTable emptyMessage="No finance rows" headers={['Source', 'Status']} rowCount={1}>
        <tr>
          <td>Journal batch</td>
          <td>POSTED</td>
        </tr>
      </FinanceDataTable>,
    );

    expect(markup).toContain('admin-table-scroll');
    expect(markup).toContain('table vuexy-data-table vuexy-booking-table admin-data-table');
    expect(markup).toContain('<th scope="col">Source</th>');
    expect(markup).toContain('Journal batch');
    expect(markup).not.toContain('No finance rows');
  });

  it('keeps the shared empty state behavior from AdminDataTable', () => {
    const markup = renderToStaticMarkup(
      <FinanceDataTable emptyMessage="No finance rows" headers={['Source', 'Status']} rowCount={0}>
        {null}
      </FinanceDataTable>,
    );

    expect(markup).toContain('admin-data-table-empty');
    expect(markup).toContain('No finance rows');
  });

  it('allows pages to keep local spacing on the shared scroll shell', () => {
    const markup = renderToStaticMarkup(
      <FinanceDataTable
        emptyMessage="No finance rows"
        headers={['Source']}
        rowCount={1}
        scrollClassName="admin-mt-12"
      >
        <tr>
          <td>Cash debt priority</td>
        </tr>
      </FinanceDataTable>,
    );

    expect(markup).toContain('admin-table-scroll admin-mt-12');
    expect(markup).toContain('Cash debt priority');
  });
});
