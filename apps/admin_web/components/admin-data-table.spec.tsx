import {
  AdminBoundedTableFooter,
  AdminDataTable,
  AdminTableFooter,
  AdminTablePaginationFooter,
  AdminTableScroll,
  adminBoundedTableFooterLabel,
} from './admin-data-table';

describe('AdminDataTable', () => {
  it('renders stable table headers and provided rows', () => {
    const table = AdminDataTable({
      children: (
        <tr>
          <td>WELCOME10</td>
          <td>Active</td>
        </tr>
      ),
      emptyMessage: 'No coupons loaded.',
      headers: ['Code', 'Status'],
      rowCount: 1,
    });

    expect(table.type).toBe('table');
    expect(table.props).toMatchObject({ className: 'table vuexy-data-table vuexy-booking-table' });
    expect(table.props.children[0].props.children.props.children).toHaveLength(2);
    expect(table.props.children[1].props.children[1]).toBeNull();
  });

  it('renders a full-width empty row when there is no data', () => {
    const table = AdminDataTable({
      children: null,
      className: 'vuexy-customer-table',
      emptyMessage: 'No feedback records loaded.',
      headers: ['Feedback', 'Action', 'Status'],
      rowCount: 0,
    });

    expect(table.props).toMatchObject({
      className: 'table vuexy-data-table vuexy-booking-table vuexy-customer-table',
    });
    const emptyRow = table.props.children[1].props.children[1];
    expect(emptyRow.props.children.props).toMatchObject({
      className: 'admin-data-table-empty-cell',
      colSpan: 3,
    });
    const emptyContainer = emptyRow.props.children.props.children;
    expect(emptyContainer.props).toMatchObject({
      className: 'admin-data-table-empty',
    });
    expect(emptyContainer.props.children.props).toMatchObject({
      className: 'empty-state',
    });
    expect(emptyContainer.props.children.props.children[1].props.children).toBe('No feedback records loaded.');
  });

  it('does not render an empty row when the caller provides no empty message', () => {
    const table = AdminDataTable({
      children: null,
      emptyMessage: null,
      headers: ['Role', 'Count'],
      rowCount: 0,
    });

    expect(table.props.children[1].props.children[1]).toBeNull();
  });

  it('does not duplicate Vuexy table classes passed by existing callers', () => {
    const table = AdminDataTable({
      children: null,
      className: 'vuexy-booking-table compact-table',
      emptyMessage: null,
      headers: ['Role'],
      rowCount: 0,
    });

    expect(table.props).toMatchObject({
      className: 'table vuexy-data-table vuexy-booking-table compact-table',
    });
  });

  it('keeps duplicate visible header labels on unique React keys', () => {
    const table = AdminDataTable({
      children: null,
      emptyMessage: null,
      headers: ['Status', 'Status'],
      rowCount: 0,
    });
    const headerCells = table.props.children[0].props.children.props.children;

    expect(headerCells.map((cell: { key: string }) => cell.key)).toEqual(['Status-0', 'Status-1']);
  });

  it('renders a reusable scroll wrapper for wide admin tables', () => {
    const wrapper = AdminTableScroll({
      children: <table className="table" />,
      className: 'vietnam-overview-table-wrap',
    });

    expect(wrapper.type).toBe('div');
    expect(wrapper.props).toMatchObject({ className: 'admin-table-scroll vietnam-overview-table-wrap' });
  });

  it('renders a reusable Vuexy table footer shell', () => {
    const footer = AdminTableFooter({
      children: <span>Showing 1 to 10 of 32 entries</span>,
      className: 'finance-table-footer',
    });

    expect(footer.type).toBe('div');
    expect(footer.props).toMatchObject({
      className: 'vuexy-booking-table-footer finance-table-footer',
    });
  });

  it('renders a reusable bounded Vuexy table footer for fully loaded short lists', () => {
    const footer = AdminBoundedTableFooter({
      className: 'vuexy-partner-table-footer',
      rowCount: 3,
    });

    expect(footer.props.className).toBe('vuexy-booking-table-footer vuexy-partner-table-footer');
    expect(normalizeText(textContent(footer))).toBe('Showing 1 to 3 of 3 entries');
    expect(adminBoundedTableFooterLabel(0)).toBe('Showing 0 entries');
  });

  it('renders a reusable Vuexy pagination footer for server-backed tables', () => {
    const footer = AdminTablePaginationFooter({
      activePage: 2,
      ariaLabel: 'Finance ledger pagination',
      from: 11,
      hrefForPage: (page) => `/finance-tax/general-ledger?page=${page}`,
      to: 20,
      totalPages: 5,
      totalRows: 42,
    });

    expect(footer.props.className).toBe('vuexy-booking-table-footer');
    expect(normalizeText(textContent(footer))).toContain('Showing 11 to 20 of 42 entries');
    expect(classNamesIn(footer)).toEqual(
      expect.arrayContaining(['vuexy-booking-pagination', 'vuexy-booking-page-link is-active']),
    );
    expect(hrefsIn(footer)).toEqual(
      expect.arrayContaining(['/finance-tax/general-ledger?page=1', '/finance-tax/general-ledger?page=2']),
    );
  });

  it('allows callers to preserve a domain-specific pagination item label', () => {
    const footer = AdminTablePaginationFooter({
      activePage: 1,
      ariaLabel: 'Customer chat history pages',
      from: 1,
      itemLabel: 'rooms',
      to: 5,
      totalPages: 2,
      totalRows: 7,
    });

    expect(normalizeText(textContent(footer))).toContain('Showing 1 to 5 of 7 rooms');
  });

  it('allows callers to override summary copy and append trailing context', () => {
    const footer = AdminTablePaginationFooter({
      activePage: 2,
      ariaLabel: 'Referral parent pagination',
      from: 11,
      summaryLabel: 'Showing 11-12 of 12',
      to: 12,
      totalPages: 2,
      totalRows: 12,
      trailing: <span>Page 2 of 2</span>,
    });

    expect(normalizeText(textContent(footer))).toContain('Showing 11-12 of 12');
    expect(normalizeText(textContent(footer))).toContain('Page 2 of 2');
  });
});

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
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

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function normalizeText(value: string) {
  return value.replace(/\s+/gu, ' ').trim();
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
