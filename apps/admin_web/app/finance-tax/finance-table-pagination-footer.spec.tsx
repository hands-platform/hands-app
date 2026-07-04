import { readFileSync } from 'node:fs';

describe('FinanceTablePaginationFooter', () => {
  it('reuses the shared Admin table pagination footer atom', () => {
    const source = readFileSync('app/finance-tax/finance-table-pagination-footer.tsx', 'utf8');

    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).not.toContain('AdminRoundedPagination');
    expect(source).not.toContain('Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries');
  });
});
